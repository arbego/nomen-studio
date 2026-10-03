import * as THREE from 'three';
import type { Offset2D } from './types';

export interface StickOptions {
  /** Total visible length of the stick, in mm (handle + embedded portion). */
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  /** How far the stick extends upward past the attach point to overlap into the piece above it. */
  embedMm: number;
  /** Where the stick attaches to the piece above it, in the piece's local mm space. */
  offset?: Offset2D;
  /** Number of segments used to approximate the rounded tip's curve. */
  curveSegments?: number;
}

const DEFAULT_CURVE_SEGMENTS = 12;
const DEFAULT_OFFSET: Offset2D = { x: 0, y: 0 };
// Requiring the drag range to keep the *full* embed depth inside the piece (often
// 15mm+) left very little vertical room to drag on typical letter heights, making
// vertical dragging feel broken even though it worked. A smaller minimum overlap
// is enough for a solid bond and gives the drag much more usable range — the
// generated stick still always uses the full embedMm, only the allowed *range of
// attach points* is more permissive near the top and bottom edges.
//
// This is the single knob that bounds how far below (or above) the piece the
// attach point can go: max travel = embedMm - MIN_Y_OVERLAP_MM, since the
// embedded interval can never be longer than embedMm itself. A larger overlap
// requirement here directly eats into that travel — e.g. the old 5mm value
// capped downward drag to just 10mm below the piece on a 15mm embed, which
// still read as "stuck" almost immediately. 1mm is enough to keep the stick
// genuinely bonded (this is a coarse bounding-box heuristic, not a precise
// solid-overlap check, so demanding more precision here buys little) while
// leaving nearly the full embedMm as real, usable drag range.
const MIN_Y_OVERLAP_MM = 1;
// However short a stick's computed length ends up after leveling (see
// stickLengthForLevelTip below), it must still stick out past its embed
// portion by a real, printable amount.
const MIN_VISIBLE_STICK_MM = 5;

/**
 * A block stick with a flat top (embedded in the piece above, so its shape doesn't
 * matter) and a rounded, bullet-nose bottom tip — both easier and safer to push
 * into a cake, and free of the sharp edges a plain box tip leaves.
 *
 * `offset` is the attach point, anywhere on the piece above (not just its bottom
 * center) — the stick spans from `offset.y - (lengthMm - embedMm)` up to
 * `offset.y + embedMm`, so it always has real volumetric overlap with the piece
 * it's merged with (see combine.ts) rather than a bare tangent touch, no matter
 * where on the piece it attaches.
 */
export function stickToGeometry(options: StickOptions): THREE.BufferGeometry {
  const { lengthMm, widthMm, thicknessMm, embedMm, offset = DEFAULT_OFFSET, curveSegments = DEFAULT_CURVE_SEGMENTS } = options;
  if (embedMm >= lengthMm) {
    throw new Error('embedMm must be smaller than the total stick lengthMm');
  }
  const radius = widthMm / 2;
  if (radius <= 0) {
    throw new Error('widthMm must be positive');
  }

  // Local profile: straight sides from the rounded tip (local y=0) up to the
  // flat top (local y=lengthMm), y-up, tip centered on x=0.
  const shape = new THREE.Shape();
  shape.moveTo(-radius, lengthMm);
  shape.lineTo(-radius, radius);
  shape.absarc(0, radius, radius, Math.PI, 2 * Math.PI, false);
  shape.lineTo(radius, lengthMm);
  shape.closePath();

  let geometry: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: thicknessMm,
    bevelEnabled: false,
    curveSegments,
  });
  if (geometry.index) {
    geometry = geometry.toNonIndexed();
  }

  const bottomY = offset.y - (lengthMm - embedMm);
  geometry.translate(offset.x, bottomY, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The extruded length to actually use for a stick attached at `offsetY`, so that
 * every stick on the same block has its rounded tip land at the same absolute
 * height — level with each other, like legs of the same height — no matter how
 * high or low each one was individually dragged. Without this, two sticks at
 * different attach heights but the same `baseLengthMm` would have tips at
 * different elevations, so the printed piece would rock instead of standing flat.
 *
 * A stick attached at `offsetY = 0` (the piece's bottom-anchor — see
 * extrudeToMm.ts) is the reference: it always uses exactly `baseLengthMm`. Every
 * other attach height adds or subtracts that same `offsetY` from the extruded
 * length so its tip lines up with that same reference elevation, which is also
 * what moving the length slider raises or lowers for every stick at once.
 */
export function stickLengthForLevelTip(baseLengthMm: number, embedMm: number, offsetY: number): number {
  return Math.max(baseLengthMm + offsetY, embedMm + MIN_VISIBLE_STICK_MM);
}

/**
 * Keeps a (possibly stale, e.g. from before the word/size changed, or a drag that
 * momentarily went past the edge) stick offset within the piece it's attached to:
 * x is clamped so the stick's full width stays under the piece. y is clamped
 * symmetrically at top and bottom so the embedded interval [y, y+embedMm]
 * always overlaps the piece's vertical extent by at least MIN_Y_OVERLAP_MM (or
 * the full embedMm, if that's smaller) — not the full embed depth, which would
 * leave almost no drag room on a typical letter (see the constant's comment).
 * This lets the attach point go a real distance below the piece's bottom edge
 * too, not just up near its top. Falls back to centering on an axis where the
 * piece is smaller than the stick needs.
 *
 * Takes the piece's bounds directly (rather than a geometry to derive them
 * from) since callers may need to clamp against a combined bounds spanning
 * several separately-generated solids — e.g. a word's letters, whose combined
 * extent shifts as letter-gap overrides move individual letters around.
 */
export function clampStickOffsetToBounds(bb: THREE.Box3, offset: Offset2D, stickWidthMm: number, embedMm: number): Offset2D {
  const xMargin = stickWidthMm / 2;
  const xMin = bb.min.x + xMargin;
  const xMax = bb.max.x - xMargin;
  const x = xMin > xMax ? (bb.min.x + bb.max.x) / 2 : Math.min(Math.max(offset.x, xMin), xMax);

  const yMargin = Math.min(embedMm, MIN_Y_OVERLAP_MM);
  const yMin = bb.min.y + yMargin - embedMm;
  const yMax = bb.max.y - yMargin;
  const y = yMin > yMax ? (bb.min.y + bb.max.y) / 2 : Math.min(Math.max(offset.y, yMin), yMax);

  return { x, y };
}
