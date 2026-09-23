import * as ClipperLib from 'clipper-lib';
import * as THREE from 'three';
import { DEFAULT_CURVE_SEGMENTS } from './units';
import { cumulativeGaps, normalizedLetterGaps } from './letterLayout';
import type { Pick } from './types';

// Clipper works in integers for numerical robustness; this scales millimeters
// up before handing coordinates to it (and back down when reading results),
// giving roughly micron precision — far finer than anything that matters at
// print scale.
const CLIPPER_SCALE = 1000;

function toClipperPath(points: THREE.Vector2[]): ClipperLib.Path {
  return points.map((p) => ({ X: Math.round(p.x * CLIPPER_SCALE), Y: Math.round(p.y * CLIPPER_SCALE) }));
}

function fromClipperPath(path: ClipperLib.Path): THREE.Vector2[] {
  return path.map((p) => new THREE.Vector2(p.X / CLIPPER_SCALE, p.Y / CLIPPER_SCALE));
}

/** Every letter's outline contours, shifted by that letter's current inter-letter gap cascade — the "natural" (un-grown) silhouette the outline is built from. */
function currentOutlinePaths(pick: Pick, letterGapsMm: number[]): ClipperLib.Path[] {
  const cascade = cumulativeGaps(normalizedLetterGaps(pick.letters.length, letterGapsMm));
  const paths: ClipperLib.Path[] = [];
  pick.letters.forEach((letter, i) => {
    for (const contour of letter.outlineContours) {
      const shifted = contour.map((p) => new THREE.Vector2(p.x + cascade[i], p.y));
      const path = toClipperPath(shifted);
      // ClipperOffset expects consistent outer-contour orientation; every
      // contour here is an outer boundary (never a hole — see LetterGeometry's
      // outlineContours doc), so normalize them all to the same winding rather
      // than trusting the font/SVG pipeline's own (consistent, but arbitrary)
      // convention. (Reversing a Path is just reversing its point order —
      // the installed clipper-lib only exposes that as ReversePaths, plural.)
      if (!ClipperLib.Clipper.Orientation(path)) {
        path.reverse();
      }
      paths.push(path);
    }
  });
  return paths;
}

/**
 * Builds the 2D shapes for a solid backing card under a pick's current
 * (gap-adjusted) letter silhouettes — the letters' combined outline, grown
 * outward by `growMm` and filled solid (no hole where the letters are; they
 * sit on top of/in front of this, not beside it). At a small grow amount, a
 * glyph's disconnected pieces (e.g. an "i"'s dot) grow into separate,
 * unconnected card fragments; growing far enough merges touching fragments
 * into one connected card. That merging is Clipper's polygon-offsetting
 * doing what it already does — not something detected/handled here.
 */
export function buildOutlineShapes(pick: Pick, letterGapsMm: number[], growMm: number): THREE.Shape[] {
  if (growMm <= 0) {
    return [];
  }
  const naturalPaths = currentOutlinePaths(pick, letterGapsMm);
  if (naturalPaths.length === 0) {
    return [];
  }

  const offset = new ClipperLib.ClipperOffset();
  offset.AddPaths(naturalPaths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const grown: ClipperLib.Paths = [];
  offset.Execute(grown, growMm * CLIPPER_SCALE);

  return grown.map((path) => new THREE.Shape(fromClipperPath(path)));
}

export interface OutlineGeometry {
  mainGeometry: THREE.BufferGeometry;
  bounds: THREE.Box3;
}

/** The outline's extruded solid (see buildOutlineShapes), or null when there's nothing to show — disabled, not grown at all, or the word has no letters yet. */
export function buildOutlineGeometry(pick: Pick, letterGapsMm: number[], growMm: number, extrudeDepthMm: number): OutlineGeometry | null {
  const shapes = buildOutlineShapes(pick, letterGapsMm, growMm);
  if (shapes.length === 0) {
    return null;
  }
  let geometry: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shapes, {
    depth: extrudeDepthMm,
    bevelEnabled: false,
    curveSegments: DEFAULT_CURVE_SEGMENTS,
  });
  if (geometry.index) {
    geometry = geometry.toNonIndexed();
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return { mainGeometry: geometry, bounds: geometry.boundingBox!.clone() };
}
