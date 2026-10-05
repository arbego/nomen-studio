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
function currentOutlinePaths(block: TextBlock, letterGapsMm: number[][], lineOffsets: Offset2D[], extraContours: ExtraContours = []): ClipperLib.Path[] {
  const paths: ClipperLib.Path[] = [];
  for (const contour of extraContours) {
    paths.push(normalized(toClipperPath(contour)));
  }
  block.lines.forEach((line, lineIndex) => {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, letterGapsMm[lineIndex] ?? []));
    const offset = lineOffsets[lineIndex] ?? ZERO_OFFSET;
    line.letters.forEach((letter, letterIndex) => {
      for (const { outer: contour } of letter.contours) {
        const shifted = contour.map((p) => new THREE.Vector2(p.x + cascade[letterIndex] + offset.x, p.y + offset.y));
        paths.push(normalized(toClipperPath(shifted)));
      }
    });
  });
  return paths;
}

/**
 * ClipperOffset expects consistent outer-contour orientation; every contour fed
 * to it here is an outer boundary as drawn by the font (never a pre-marked
 * hole), so they are all normalized to the same winding rather than trusting
 * the font/SVG pipeline's own — consistent, but arbitrary — convention.
 * (Reversing a Path is just reversing its point order; the installed
 * clipper-lib only exposes that as ReversePaths, plural.)
 */
function normalized(path: ClipperLib.Path): ClipperLib.Path {
  if (!ClipperLib.Clipper.Orientation(path)) {
    path.reverse();
  }
  return path;
}

/**
 * Silhouettes that belong on the card but are not lettering — a topper's
 * ornaments — already placed where they sit.
 *
 * Grown into the card exactly as a letter is, so the card reaches around them
 * and holds them. Only their outer boundaries, so an ornament's own counters
 * come out filled: a hole in a symbol is part of the drawing, not somewhere you
 * were meant to see through the piece, and nothing lists it to be decided
 * about.
 */
export type ExtraContours = readonly THREE.Vector2[][];

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

/**
 * How finely a hole's own outline is sampled.
 *
 * Clipper hands back straight-edged polygons, so this only matters for the
 * rounded joins its offsetting adds — enough to put a clickable patch over the
 * hole that follows its edge rather than cutting the corners.
 */
const HOLE_OUTLINE_SEGMENTS = 16;

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
 * Identifies one hole: which letter of which line it was attributed to (see
 * attributeHoleToLetter), and which of that letter's holes it is.
 *
 * The ordinal is what makes this a hole's name rather than a letter's. A letter
 * routinely ends up with more than one — lines dragged across each other close
 * extra pockets between their strokes, and every one of those is attributed to
 * whichever letter is nearest — and without it they would all share a key and
 * so be filled in and reopened together, which is not what ticking one of them
 * says.
 *
 * Stable across grow/size/color/drag changes, which is what lets it be saved in
 * a project file. Reset by the store whenever any line's text or the font
 * changes, since a different letter at that position invalidates it.
 */
export function outlineHoleKey(lineIndex: number, letterIndex: number, holeIndex: number): string {
  return `line-${lineIndex}-letter-${letterIndex}-hole-${holeIndex}`;
}

export interface OutlineHoleCandidate {
  key: string;
  lineIndex: number;
  letterIndex: number;
  char: string;
  /** Which of that letter's holes this is, counting from the bottom left. 0 for a letter with only the one. */
  holeIndex: number;
  /**
   * The hole's own outline, in the same mm space the card's shapes are built
   * in, so the preview can put something clickable exactly over it.
   *
   * Listed whether or not the hole is currently filled in: a filled one has to
   * stay clickable to be opened again, and by then it is no longer a hole in
   * anything.
   */
  points: THREE.Vector2[];
}

interface AttributedHole {
  key: string;
  ref: LetterRef;
  holeIndex: number;
  points: THREE.Vector2[];
}

/**
 * Every hole in `shapes`, attributed to a letter and numbered within it.
 *
 * One walk, shared by the checklist and by the build that acts on it, so the
 * two can never disagree about which hole a key names.
 */
function attributeHoles(shapes: THREE.Shape[], bounds: THREE.Box2[], refs: LetterRef[], growMm: number, extraContours: ExtraContours = []): Map<THREE.Path, AttributedHole> {
  const found = shapes.flatMap((shape) => shape.holes.map((hole) => ({ hole, points: hole.getPoints(HOLE_OUTLINE_SEGMENTS) })));
  // Numbered by where each hole sits rather than by the order Clipper happened
  // to emit them in: a letter's own holes all move together, so they keep their
  // numbering as the design is dragged about or the card grown.
  const placed = found.map((entry) => ({ ...entry, at: centroid(entry.points) }));
  placed.sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);

  // An ornament's own enclosed areas never become holes: a gap inside a symbol
  // is part of the drawing, not somewhere anyone meant to see through the
  // piece. Left out of the map entirely, so they are neither listed in the
  // checklist nor kept in the card.
  const ornamentAreas = extraContours.map((contour) => new THREE.Box2().setFromPoints([...contour]).expandByScalar(growMm));

  const countPerLetter = new Map<number, number>();
  const attributed = new Map<THREE.Path, AttributedHole>();
  for (const { hole, at, points } of placed) {
    if (ornamentAreas.some((area) => area.containsPoint(at))) {
      continue;
    }
    const letter = attributeHoleToLetter(at, bounds, growMm);
    const holeIndex = countPerLetter.get(letter) ?? 0;
    countPerLetter.set(letter, holeIndex + 1);
    const ref = refs[letter];
    attributed.set(hole, { key: outlineHoleKey(ref.lineIndex, ref.letterIndex, holeIndex), ref, holeIndex, points });
  }
  return attributed;
}

/**
 * Every hole currently present in the natural (un-filled-in) outline at this
 * growMm, each attributed to a line+letter — independent of any manual
 * "closed" override, so the checklist UI can keep listing (and let the user
 * reopen) a hole they already closed. Most letters contribute none; a script
 * font's "a"/"e"/"o"-style counters typically contribute one each.
 */
export function detectOutlineHoleCandidates(
  block: TextBlock,
  letterGapsMm: number[][],
  lineOffsets: Offset2D[],
  growMm: number,
  extraContours: ExtraContours = [],
): OutlineHoleCandidate[] {
  const shapes = naturalOutlineShapes(block, letterGapsMm, lineOffsets, growMm, extraContours);
  if (shapes.length === 0) {
    return [];
  }
  const { bounds, refs } = letterBoundsList(block, letterGapsMm, lineOffsets);
  const attributed = attributeHoles(shapes, bounds, refs, growMm, extraContours);
  const candidates = [...attributed.values()].map(({ key, ref, holeIndex, points }) => ({
    key,
    lineIndex: ref.lineIndex,
    letterIndex: ref.letterIndex,
    char: ref.char,
    holeIndex,
    points,
  }));
  // Listed as the piece reads, line by line and letter by letter, rather than
  // in whatever order the holes came out of the offsetting.
  candidates.sort((a, b) => a.lineIndex - b.lineIndex || a.letterIndex - b.letterIndex || a.holeIndex - b.holeIndex);
  return candidates;
}

/** The outline's natural shapes (every hole Clipper's offsetting actually finds), with no manual "closed" overrides applied yet. */
function naturalOutlineShapes(block: TextBlock, letterGapsMm: number[][], lineOffsets: Offset2D[], growMm: number, extraContours: ExtraContours = []): THREE.Shape[] {
  if (growMm <= 0) {
    return [];
  }
  const naturalPaths = currentOutlinePaths(block, letterGapsMm, lineOffsets, extraContours);
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
 * `closedOutlineHoles` is a list of `outlineHoleKey` strings the user has
 * manually chosen to fill in solid — each names one hole, so each omits that
 * one hole, leaving its area part of the solid card instead of a void.
 */
export function buildOutlineShapes(
  block: TextBlock,
  letterGapsMm: number[][],
  lineOffsets: Offset2D[],
  growMm: number,
  closedOutlineHoles: readonly string[] = [],
  extraContours: ExtraContours = [],
): THREE.Shape[] {
  const shapes = naturalOutlineShapes(block, letterGapsMm, lineOffsets, growMm, extraContours);
  if (shapes.length === 0) {
    return shapes;
  }

  const closed = new Set(closedOutlineHoles);
  const { bounds, refs } = letterBoundsList(block, letterGapsMm, lineOffsets);
  // Attributed over the whole set before anything is removed, so the numbering
  // is the same one the checklist was built from.
  const attributed = attributeHoles(shapes, bounds, refs, growMm, extraContours);
  for (const shape of shapes) {
    // A hole an ornament made is filled whatever the checklist says, since the
    // checklist never offered it: see attributeHoles.
    shape.holes = shape.holes.filter((hole) => {
      const found = attributed.get(hole);
      return found !== undefined && !closed.has(found.key);
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
  extraContours: ExtraContours = [],
): OutlineGeometry | null {
  const shapes = buildOutlineShapes(block, letterGapsMm, lineOffsets, growMm, closedOutlineHoles, extraContours);
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
