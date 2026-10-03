import * as ClipperLib from 'clipper-lib';
import { CLIPPER_SCALE, toClipperPath, shapesFromPolyTree } from './clipper';
import * as THREE from 'three';
import { DEFAULT_CURVE_SEGMENTS } from './units';
import { cumulativeGaps, normalizedLetterGaps } from './letterLayout';
import type { TextBlock, Offset2D } from './types';

const ZERO_OFFSET: Offset2D = { x: 0, y: 0 };

/** Which letter, across every line, a flat index into letterBoundsList's arrays refers to. */
interface LetterRef {
  lineIndex: number;
  letterIndex: number;
  char: string;
}

/**
 * Every letter's outline contours across every line, shifted by that letter's
 * within-line gap cascade *and* its line's own draggable (x, y) offset — the
 * "natural" (un-grown) silhouette the outline is built from.
 */
function currentOutlinePaths(block: TextBlock, letterGapsMm: number[][], lineOffsets: Offset2D[]): ClipperLib.Path[] {
  const paths: ClipperLib.Path[] = [];
  block.lines.forEach((line, lineIndex) => {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, letterGapsMm[lineIndex] ?? []));
    const offset = lineOffsets[lineIndex] ?? ZERO_OFFSET;
    line.letters.forEach((letter, letterIndex) => {
      for (const { outer: contour } of letter.contours) {
        const shifted = contour.map((p) => new THREE.Vector2(p.x + cascade[letterIndex] + offset.x, p.y + offset.y));
        const path = toClipperPath(shifted);
        // ClipperOffset expects consistent outer-contour orientation; every
        // contour here is an outer boundary as drawn by the font (never a
        // pre-marked hole), so normalize them all to the same winding rather
        // than trusting the font/SVG pipeline's own (consistent, but
        // arbitrary) convention. (Reversing a Path is just reversing its point
        // order — the installed clipper-lib only exposes that as
        // ReversePaths, plural.)
        if (!ClipperLib.Clipper.Orientation(path)) {
          path.reverse();
        }
        paths.push(path);
      }
    });
  });
  return paths;
}

/** Every letter's bounding box across every line, in the same cascade- and
 * line-offset-shifted mm-space `buildOutlineShapes` uses — used to attribute
 * a resulting hole (see attributeHoleToLetter) back to the letter it came
 * from. Parallel-indexed with the returned `refs`. */
function letterBoundsList(block: TextBlock, letterGapsMm: number[][], lineOffsets: Offset2D[]): { bounds: THREE.Box2[]; refs: LetterRef[] } {
  const bounds: THREE.Box2[] = [];
  const refs: LetterRef[] = [];
  block.lines.forEach((line, lineIndex) => {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, letterGapsMm[lineIndex] ?? []));
    const offset = lineOffsets[lineIndex] ?? ZERO_OFFSET;
    line.letters.forEach((letter, letterIndex) => {
      const box = new THREE.Box2();
      for (const { outer: contour } of letter.contours) {
        for (const p of contour) {
          box.expandByPoint(new THREE.Vector2(p.x + cascade[letterIndex] + offset.x, p.y + offset.y));
        }
      }
      bounds.push(box);
      refs.push({ lineIndex, letterIndex, char: letter.char });
    });
  });
  return { bounds, refs };
}

function centroid(points: THREE.Vector2[]): THREE.Vector2 {
  const sum = points.reduce((acc, p) => acc.add(p), new THREE.Vector2());
  return sum.divideScalar(points.length);
}

/**
 * Which letter (as a flat index into `bounds`) a hole "belongs to", for the
 * manual close/reopen checklist — whichever letter's own (grown-padded)
 * bounding box contains the hole's centroid, or, failing that, whichever
 * letter's box center is nearest. Every hole gets attributed to some letter
 * this way, even one that (rarely) emerges from two adjacent letters' shapes
 * merging rather than from a single letter's own counter — closing it still
 * concretely removes that specific hole, which is what the checklist
 * promises, whatever produced it.
 */
function attributeHoleToLetter(holeCentroid: THREE.Vector2, bounds: THREE.Box2[], growMm: number): number {
  let containingIndex = -1;
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  bounds.forEach((box, i) => {
    const padded = box.clone().expandByScalar(growMm);
    if (containingIndex < 0 && padded.containsPoint(holeCentroid)) {
      containingIndex = i;
    }
    const center = box.getCenter(new THREE.Vector2());
    const distance = center.distanceTo(holeCentroid);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  });
  return containingIndex >= 0 ? containingIndex : nearestIndex;
}

/**
 * Identifies which letter of which line a hole belongs to (see
 * attributeHoleToLetter), stable across grow/size/color/drag changes — used
 * both to look up a per-hole "manually closed" override and to key the
 * checklist UI that exposes those overrides. Reset by the store whenever any
 * line's text or the font changes, since a different letter at that position
 * invalidates it.
 */
export function outlineHoleKey(lineIndex: number, letterIndex: number): string {
  return `line-${lineIndex}-letter-${letterIndex}`;
}

export interface OutlineHoleCandidate {
  key: string;
  lineIndex: number;
  letterIndex: number;
  char: string;
}

/**
 * Every hole currently present in the natural (un-filled-in) outline at this
 * growMm, each attributed to a line+letter — independent of any manual
 * "closed" override, so the checklist UI can keep listing (and let the user
 * reopen) a hole they already closed. Most letters contribute none; a script
 * font's "a"/"e"/"o"-style counters typically contribute one each.
 */
export function detectOutlineHoleCandidates(block: TextBlock, letterGapsMm: number[][], lineOffsets: Offset2D[], growMm: number): OutlineHoleCandidate[] {
  const shapes = naturalOutlineShapes(block, letterGapsMm, lineOffsets, growMm);
  if (shapes.length === 0) {
    return [];
  }
  const { bounds, refs } = letterBoundsList(block, letterGapsMm, lineOffsets);
  const candidates: OutlineHoleCandidate[] = [];
  for (const shape of shapes) {
    for (const hole of shape.holes) {
      const ref = refs[attributeHoleToLetter(centroid(hole.getPoints(8)), bounds, growMm)];
      candidates.push({ key: outlineHoleKey(ref.lineIndex, ref.letterIndex), lineIndex: ref.lineIndex, letterIndex: ref.letterIndex, char: ref.char });
    }
  }
  return candidates;
}

/** The outline's natural shapes (every hole Clipper's offsetting actually finds), with no manual "closed" overrides applied yet. */
function naturalOutlineShapes(block: TextBlock, letterGapsMm: number[][], lineOffsets: Offset2D[], growMm: number): THREE.Shape[] {
  if (growMm <= 0) {
    return [];
  }
  const naturalPaths = currentOutlinePaths(block, letterGapsMm, lineOffsets);
  if (naturalPaths.length === 0) {
    return [];
  }

  const offset = new ClipperLib.ClipperOffset();
  offset.AddPaths(naturalPaths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const tree = new ClipperLib.PolyTree();
  offset.Execute(tree, growMm * CLIPPER_SCALE);

  const shapes: THREE.Shape[] = [];
  shapesFromPolyTree(tree, shapes);
  return shapes;
}

/**
 * Builds the 2D shapes for a solid backing card under a block's current
 * (gap-adjusted, line-offset-shifted) letter silhouettes across every line —
 * the combined outline, grown outward by `growMm` and filled solid except
 * where a letter's own counter (e.g. the hole in "a") survives the grow as a
 * genuine hole. At a small grow amount, a glyph's disconnected pieces (e.g.
 * an "i"'s dot) grow into separate, unconnected card fragments; growing far
 * enough merges touching fragments — including across lines, if they're
 * close enough — into one connected card, same as it can merge a counter's
 * two sides shut. Both are Clipper's polygon-offsetting doing what it already
 * does — not something detected/handled here.
 *
 * `closedOutlineHoles` is a list of `outlineHoleKey(lineIndex, letterIndex)`
 * strings the user has manually chosen to fill in solid (see
 * attributeHoleToLetter) — any hole attributed to one of those letters is
 * simply omitted, leaving that area part of the solid card instead of a void.
 */
export function buildOutlineShapes(
  block: TextBlock,
  letterGapsMm: number[][],
  lineOffsets: Offset2D[],
  growMm: number,
  closedOutlineHoles: readonly string[] = [],
): THREE.Shape[] {
  const shapes = naturalOutlineShapes(block, letterGapsMm, lineOffsets, growMm);
  if (shapes.length === 0 || closedOutlineHoles.length === 0) {
    return shapes;
  }

  const closed = new Set(closedOutlineHoles);
  const { bounds, refs } = letterBoundsList(block, letterGapsMm, lineOffsets);
  for (const shape of shapes) {
    shape.holes = shape.holes.filter((hole) => {
      const ref = refs[attributeHoleToLetter(centroid(hole.getPoints(8)), bounds, growMm)];
      return !closed.has(outlineHoleKey(ref.lineIndex, ref.letterIndex));
    });
  }
  return shapes;
}

export interface OutlineGeometry {
  mainGeometry: THREE.BufferGeometry;
  bounds: THREE.Box3;
}

/** The outline's extruded solid (see buildOutlineShapes), or null when there's nothing to show — disabled, not grown at all, or the block has no letters yet. */
export function buildOutlineGeometry(
  block: TextBlock,
  letterGapsMm: number[][],
  lineOffsets: Offset2D[],
  growMm: number,
  extrudeDepthMm: number,
  closedOutlineHoles: readonly string[] = [],
): OutlineGeometry | null {
  const shapes = buildOutlineShapes(block, letterGapsMm, lineOffsets, growMm, closedOutlineHoles);
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
