import * as THREE from 'three';
import { DEFAULT_CURVE_SEGMENTS } from './units';
import { shapesBoundingBox } from './svgPathToShapes';

export interface ExtrudeToMmOptions {
  targetWidthMm: number;
  extrudeDepthMm: number;
  curveSegments?: number;
}

/**
 * Extrudes flat (SVG-space, y-down) shapes into a solid sized to real millimeters,
 * flipped into Three.js's y-up world, and anchored at local origin = bottom-center
 * of the piece — the convention every pick's geometry shares, so a stick can always
 * be attached starting at y=0 growing downward.
 */
export function extrudeShapesToMm(shapes: THREE.Shape[], options: ExtrudeToMmOptions): THREE.BufferGeometry {
  const curveSegments = options.curveSegments ?? DEFAULT_CURVE_SEGMENTS;
  const rawBox = shapesBoundingBox(shapes, curveSegments);
  const rawWidth = rawBox.max.x - rawBox.min.x;
  if (!(rawWidth > 0)) {
    throw new Error('Cannot extrude an empty or zero-width shape set');
  }
  const scale = options.targetWidthMm / rawWidth;

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
  /** The outer boundary of each of this glyph's shapes (ignoring holes), transformed into the same final mm-space as `geometry` — raw material for building a growable outline around the word (see outline.ts). Almost always one contour; a glyph like "i"/"j" has two. */
  outlineContours: THREE.Vector2[][];
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
export function extrudeGlyphShapesToMm(glyphs: AnchoredGlyphShapes[], options: ExtrudeToMmOptions): ExtrudedGlyph[] {
  const curveSegments = options.curveSegments ?? DEFAULT_CURVE_SEGMENTS;
  const rawBox = shapesBoundingBox(
    glyphs.flatMap((g) => g.shapes),
    curveSegments,
  );
  const rawWidth = rawBox.max.x - rawBox.min.x;
  if (!(rawWidth > 0)) {
    throw new Error('Cannot extrude an empty or zero-width shape set');
  }
  const scale = options.targetWidthMm / rawWidth;
  const depth = options.extrudeDepthMm / scale;

  // Same translation extrudeShapesToMm derives from its own (single-shape) bb,
  // just computed once from the shared raw box and reused for every glyph.
  const centerXMm = (-(rawBox.min.x + rawBox.max.x) / 2) * scale;
  const bottomYMm = rawBox.max.y * scale; // y is negated by the scale below, so the raw max (SVG-space bottom) becomes the new min

  return glyphs.map(({ shapes, anchorX }) => {
    let geometry: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments });
    if (geometry.index) {
      geometry = geometry.toNonIndexed();
    }
    geometry.scale(scale, -scale, scale);
    geometry.translate(centerXMm, bottomYMm, 0);
    geometry.computeVertexNormals();

    // Same (scale, -scale) + translate transform as the geometry above, applied
    // to each shape's own outer boundary points instead of a full extrusion.
    const outlineContours = shapes.map((shape) =>
      shape.getPoints(curveSegments).map((p) => new THREE.Vector2(p.x * scale + centerXMm, -p.y * scale + bottomYMm)),
    );

    return { geometry, anchorMm: anchorX * scale + centerXMm, outlineContours };
  });
}
