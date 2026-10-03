import * as ClipperLib from 'clipper-lib';
import * as THREE from 'three';
import type { GlyphContour, Offset2D } from './types';

// Clipper works in integers for numerical robustness; this scales millimeters
// up before handing coordinates to it (and back down when reading results),
// giving roughly micron precision — far finer than anything that matters at
// print scale.
export const CLIPPER_SCALE = 1000;

const ZERO_OFFSET: Offset2D = { x: 0, y: 0 };

/**
 * A filled 2D region in mm-space, as Clipper paths.
 *
 * Orientation carries the meaning: solid boundaries wind positive, holes wind
 * negative, and every operation here uses Clipper's non-zero fill rule to read
 * them. That combination is what makes overlapping glyphs behave — two letters
 * whose strokes overlap (common in script fonts) union correctly instead of
 * cancelling to empty the way even-odd would, while a hole stays a hole unless
 * some other letter's solid genuinely fills it in.
 */
export type Region = ClipperLib.Paths;

const FILL = ClipperLib.PolyFillType.pftNonZero;

export function toClipperPath(points: THREE.Vector2[]): ClipperLib.Path {
  return points.map((p) => ({ X: Math.round(p.x * CLIPPER_SCALE), Y: Math.round(p.y * CLIPPER_SCALE) }));
}

export function fromClipperPath(path: ClipperLib.Path): THREE.Vector2[] {
  return path.map((p) => new THREE.Vector2(p.X / CLIPPER_SCALE, p.Y / CLIPPER_SCALE));
}

/** Forces a path to wind the way this module's non-zero convention expects — positive for solid, negative for a hole. */
function orient(path: ClipperLib.Path, solid: boolean): ClipperLib.Path {
  if (ClipperLib.Clipper.Orientation(path) !== solid) {
    path.reverse();
  }
  return path;
}

/**
 * The region a set of glyph contours actually fills, optionally shifted — the
 * glyph's true printed area, counters included.
 *
 * Note this is not what outline.ts wants: that grows only the *outer*
 * boundaries and lets Clipper's offsetting rediscover holes, because some
 * script fonts draw a counter as a self-approaching outer contour rather than
 * a separate subpath. Here the holes are taken at face value, which is right
 * for booleans against a glyph's filled area.
 */
export function regionFromContours(contours: readonly GlyphContour[], shift: Offset2D = ZERO_OFFSET): Region {
  const paths: ClipperLib.Path[] = [];
  for (const contour of contours) {
    const move = (p: THREE.Vector2) => new THREE.Vector2(p.x + shift.x, p.y + shift.y);
    paths.push(orient(toClipperPath(contour.outer.map(move)), true));
    for (const hole of contour.holes) {
      paths.push(orient(toClipperPath(hole.map(move)), false));
    }
  }
  return paths;
}

/** An axis-aligned rectangle as a region — the half-plane stand-in a flat-bottom trim intersects against. */
export function rectRegion(minX: number, minY: number, maxX: number, maxY: number): Region {
  return [
    orient(
      toClipperPath([new THREE.Vector2(minX, minY), new THREE.Vector2(maxX, minY), new THREE.Vector2(maxX, maxY), new THREE.Vector2(minX, maxY)]),
      true,
    ),
  ];
}

function execute(clipType: ClipperLib.ClipType, subject: Region, clip: Region): Region {
  if (subject.length === 0) {
    return [];
  }
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  if (clip.length > 0) {
    clipper.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  }
  const solution: ClipperLib.Paths = [];
  clipper.Execute(clipType, solution, FILL, FILL);
  return solution;
}

/** Everything in both regions. */
export function intersectRegions(subject: Region, clip: Region): Region {
  if (clip.length === 0) {
    return [];
  }
  return execute(ClipperLib.ClipType.ctIntersection, subject, clip);
}

/** `subject` with `clip` cut away — how the inlay pocket is carved out of the initial's front face. */
export function subtractRegions(subject: Region, clip: Region): Region {
  if (clip.length === 0) {
    return subject;
  }
  return execute(ClipperLib.ClipType.ctDifference, subject, clip);
}

/** Grows (or, with a negative delta, shrinks) a region by `deltaMm` in every direction — a Minkowski offset, used for the pocket's fit clearance. */
export function growRegion(region: Region, deltaMm: number): Region {
  if (region.length === 0 || deltaMm === 0) {
    return region;
  }
  const offset = new ClipperLib.ClipperOffset();
  offset.AddPaths(region, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const solution: ClipperLib.Paths = [];
  offset.Execute(solution, deltaMm * CLIPPER_SCALE);
  return solution;
}

export function regionIsEmpty(region: Region): boolean {
  return region.every((path) => path.length < 3);
}

/**
 * Clipper's flat `Paths` output never says which contours are holes of which
 * outer, so building a `THREE.Shape` per path (as if each were independently
 * solid) would stack a hole polygon on top of its outer as an opaque smudge
 * instead of a see-through hole. Re-running the same operation into a
 * `PolyTree` keeps that nesting; this walks it (following Clipper's usual
 * outer -> hole -> island -> hole -> ... alternation) into proper `THREE.Shape`s
 * with real `.holes`.
 */
export function shapesFromPolyTree(node: ClipperLib.PolyNode, shapes: THREE.Shape[] = []): THREE.Shape[] {
  if (!node.IsHole() && node.Contour().length > 0) {
    const shape = new THREE.Shape(fromClipperPath(node.Contour()));
    for (const child of node.Childs()) {
      if (child.IsHole()) {
        shape.holes.push(new THREE.Path(fromClipperPath(child.Contour())));
      }
    }
    shapes.push(shape);
  }
  for (const child of node.Childs()) {
    shapesFromPolyTree(child, shapes);
  }
  return shapes;
}

/**
 * A region as extrudable `THREE.Shape`s with correct holes. Goes through a
 * no-op union into a PolyTree purely to recover the outer/hole nesting that a
 * flat `Paths` list has already thrown away (see shapesFromPolyTree).
 */
export function regionToShapes(region: Region): THREE.Shape[] {
  if (region.length === 0) {
    return [];
  }
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(region, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  clipper.Execute(ClipperLib.ClipType.ctUnion, tree, FILL, FILL);
  return shapesFromPolyTree(tree);
}
