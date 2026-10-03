import * as THREE from 'three';
import { DEFAULT_CURVE_SEGMENTS } from './units';
import { shapesBoundingBox } from './svgPathToShapes';
import type { GlyphContour } from './types';

/**
 * How the raw shapes are scaled to real millimeters: either the combined
 * silhouette's width or its height is mapped to `mm`, and the other axis
 * follows proportionally.
 *
 * Width is the right handle for a word, whose length is what has to fit the
 * cake; height is the right handle for a single large letter, where "a 120mm
 * tall initial" is the dimension that matters and whose width varies wildly
 * between an "I" and a "W".
 */
export interface ExtrudeFit {
  mode: 'width' | 'height';
  mm: number;
}

export interface ExtrudeToMmOptions {
  fit: ExtrudeFit;
  extrudeDepthMm: number;
  curveSegments?: number;
}

/**
 * Negating exactly one axis (as the y-flip below does) mirrors the geometry,
 * which reverses every triangle's effective winding — but only in the sense
 * that matters for face culling (the on-screen orientation of its vertices).
 * `BufferGeometry.scale()` bakes the mirror into vertex positions without
 * touching vertex *order*, so nothing about the triangle list itself changes;
 * left alone, every face (including the front cap) ends up "facing" the
 * wrong way and gets backface-culled — normally invisible against an empty
 * background (an extrusion's back cap ends up flipped to face front instead
 * and looks identical from a distance), but not once something else, like an
 * outline card, sits behind it where the missing front cap should have been.
 * Swapping each triangle's last two vertices restores correct winding
 * without changing the geometry's shape. Must run on a non-indexed geometry
 * (every 3 consecutive vertices are one triangle) — call after toNonIndexed().
 */
function reverseTriangleWinding(geometry: THREE.BufferGeometry): void {
  for (const name of Object.keys(geometry.attributes)) {
    const attribute = geometry.getAttribute(name);
    const itemSize = attribute.itemSize;
    const array = attribute.array;
    const triangleCount = array.length / itemSize / 3;
    for (let tri = 0; tri < triangleCount; tri++) {
      const v1 = (tri * 3 + 1) * itemSize;
      const v2 = (tri * 3 + 2) * itemSize;
      for (let k = 0; k < itemSize; k++) {
        const tmp = array[v1 + k];
        array[v1 + k] = array[v2 + k];
        array[v2 + k] = tmp;
      }
    }
    attribute.needsUpdate = true;
  }
}

/** The mm-per-raw-unit scale that maps a raw bounding box onto the requested fit. */
function scaleForFit(rawBox: THREE.Box2, fit: ExtrudeFit): number {
  const rawExtent = fit.mode === 'width' ? rawBox.max.x - rawBox.min.x : rawBox.max.y - rawBox.min.y;
  if (!(rawExtent > 0)) {
    throw new Error(`Cannot extrude an empty or zero-${fit.mode} shape set`);
  }
  return fit.mm / rawExtent;
}

/**
 * Extrudes flat (SVG-space, y-down) shapes into a solid sized to real millimeters,
 * flipped into Three.js's y-up world, and anchored at local origin = bottom-center
 * of the piece — the convention every block's geometry shares, so a stick or a
 * base rail can always be attached starting at y=0 growing downward.
 */
export function extrudeShapesToMm(shapes: THREE.Shape[], options: ExtrudeToMmOptions): THREE.BufferGeometry {
  const curveSegments = options.curveSegments ?? DEFAULT_CURVE_SEGMENTS;
  const rawBox = shapesBoundingBox(shapes, curveSegments);
  const scale = scaleForFit(rawBox, options.fit);

  let geometry: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shapes, {
    depth: options.extrudeDepthMm / scale,
    bevelEnabled: false,
    curveSegments,
  });
  if (geometry.index) {
    geometry = geometry.toNonIndexed();
  }

  // SVG/font space is y-down; negate y to become Three's y-up, and scale to mm.
  geometry.scale(scale, -scale, scale);
  reverseTriangleWinding(geometry);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  geometry.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, 0);
  geometry.computeVertexNormals();

  return geometry;
}

export interface AnchoredGlyphShapes {
  shapes: THREE.Shape[];
  /** This glyph's natural x offset, in the same raw (pre-scale) coordinate space as `shapes` — normally where the shapes were already positioned when generated (e.g. via glyph.getPath(x, ...)). */
  anchorX: number;
}

export interface ExtrudedGlyph {
  geometry: THREE.BufferGeometry;
  /** `anchorX` carried through the same scale/center this function derives internally — the mm-space x a caller can treat as this glyph's natural resting position, since it's not otherwise recoverable from the geometry's own bounding box (which reflects the glyph's shape extent, not its layout anchor). */
  anchorMm: number;
  /** Each of this glyph's shapes — outer boundary plus any counters the font drew as their own subpaths — transformed into the same final mm-space as `geometry`. Almost always one; a glyph like "i"/"j" has two. */
  contours: GlyphContour[];
}

export interface ExtrudedGlyphSet {
  glyphs: ExtrudedGlyph[];
  /**
   * Converts a y in the input's raw (pre-scale, y-down) space into its final mm
   * y. Lets a caller locate something this function itself knew nothing about —
   * most importantly a line's typographic baseline, which sits at raw y=0 for
   * the first line and one whole line height lower for each line after it.
   */
  rawYToMm: (rawY: number) => number;
}

/**
 * Like extrudeShapesToMm, but for several glyphs (one word's individual letters)
 * that must share a single scale and baseline instead of each being
 * independently centered/anchored — otherwise every letter would end up
 * re-centered on top of the others. The scale and anchor are computed once from
 * every glyph's combined raw bounding box (so this produces the same result as
 * extrudeShapesToMm's single-shape case when there's only one glyph), then
 * applied identically to each. A glyph's own raw shape coordinates — already
 * positioned at its natural x offset via opentype.js's own per-glyph layout —
 * are preserved relative to that shared frame, so the returned geometries sit
 * at their correct natural positions with no further per-glyph translation
 * needed.
 */
export function extrudeGlyphShapesToMm(glyphs: AnchoredGlyphShapes[], options: ExtrudeToMmOptions): ExtrudedGlyphSet {
  const curveSegments = options.curveSegments ?? DEFAULT_CURVE_SEGMENTS;
  const rawBox = shapesBoundingBox(
    glyphs.flatMap((g) => g.shapes),
    curveSegments,
  );
  const scale = scaleForFit(rawBox, options.fit);
  const depth = options.extrudeDepthMm / scale;

  // Same translation extrudeShapesToMm derives from its own (single-shape) bb,
  // just computed once from the shared raw box and reused for every glyph.
  const centerXMm = (-(rawBox.min.x + rawBox.max.x) / 2) * scale;
  const bottomYMm = rawBox.max.y * scale; // y is negated by the scale below, so the raw max (SVG-space bottom) becomes the new min

  const extruded = glyphs.map(({ shapes, anchorX }) => {
    let geometry: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments });
    if (geometry.index) {
      geometry = geometry.toNonIndexed();
    }
    geometry.scale(scale, -scale, scale);
    reverseTriangleWinding(geometry);
    geometry.translate(centerXMm, bottomYMm, 0);
    geometry.computeVertexNormals();

    // Same (scale, -scale) + translate transform as the geometry above, applied
    // to each shape's own boundary points instead of to a full extrusion.
    const toMm = (p: { x: number; y: number }) => new THREE.Vector2(p.x * scale + centerXMm, -p.y * scale + bottomYMm);
    const contours: GlyphContour[] = shapes.map((shape) => ({
      outer: shape.getPoints(curveSegments).map(toMm),
      holes: shape.holes.map((hole) => hole.getPoints(curveSegments).map(toMm)),
    }));

    return { geometry, anchorMm: anchorX * scale + centerXMm, contours };
  });

  return { glyphs: extruded, rawYToMm: (rawY: number) => -rawY * scale + bottomYMm };
}
