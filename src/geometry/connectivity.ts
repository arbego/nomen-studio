import * as ClipperLib from 'clipper-lib';
import { CLIPPER_SCALE, growRegion, intersectRegions, regionIsEmpty, splitRegion, type Region } from './clipper';

/**
 * How close two pieces have to come before they count as touching.
 *
 * Not zero, because two solids that meet exactly — a letter resting on the card's
 * top edge, a name seated on a face with no pocket cut into it — share a boundary
 * and no area, so an exact intersection comes back empty where the print is
 * plainly fused. Half of this is added to every piece, so the gap actually
 * bridged is this whole figure: far narrower than a single extrusion, which is
 * the real width at which two walls fuse into one.
 */
const CONTACT_TOLERANCE_MM = 0.05;

/**
 * One solid of a design, as far as holding together is concerned: the ground it
 * covers and the depths it spans.
 *
 * Every piece this app builds is a planar prism — a 2D region extruded straight
 * along z, never a 3D boolean — so two of them touch exactly when their
 * footprints meet *and* their depth bands do. That is two cheap tests, where a
 * mesh-level answer would be a solid intersection per pair.
 *
 * A piece is what gets *printed* as one part, not what is connected: its region
 * is split into its separate solids here, because a part is routinely several —
 * the dot and the stem of an "i", the body and the flames of a rocket, a word
 * whose letters have been dragged off each other. Each of those has to be held by
 * something; being named in the same part as something that is held is not being
 * held. What they do get from sharing a part is each other: solids of one piece
 * that touch are fused, whatever `Attachment` says about pieces (see below).
 */
export interface SolidPiece {
  /** Names the piece in the report. The caller's own vocabulary; nothing here reads it. */
  id: string;
  /** Its footprint, in the frame every piece of this design shares. */
  region: Region;
  /** The depths it spans, in mm — back face first. */
  zRange: readonly [number, number];
  /** Marks a piece the design hangs from. See `Attachment`. */
  anchor?: boolean;
}

/**
 * What it takes for a piece to be held — a property of how the design is
 * printed, not of its shapes, so each product says which of the two it is.
 *
 * `chain`: the pieces fuse into one body, so touching anything that is itself
 * held is enough. A cake topper prints as a single object, so its letters, card
 * and sticks hold each other transitively.
 *
 * `anchor`: the pieces print separately and are assembled, so each has to meet an
 * anchor piece itself. A name display's name and ornaments each drop into their
 * own recess in the initial; one resting against another holds nothing, because
 * the two were never joined — they are two parts in a box.
 */
export type Attachment = 'chain' | 'anchor';

/** In Clipper's integer units, like the paths it is measured from. */
interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** One separate solid of one piece — the unit everything below is actually about. */
interface Prepared extends SolidPiece {
  /** Which piece it was split out of. Two solids of one piece are fused where they touch; two pieces may not be. */
  part: number;
  /** Grown by half the tolerance, so a bare touch reads as the overlap it will print as. */
  grown: Region;
  bounds: Bounds;
  /** Filled area, for telling which group of solids is the design and which came off it. */
  area: number;
}

function boundsOf(region: Region): Bounds {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const path of region) {
    for (const point of path) {
      bounds.minX = Math.min(bounds.minX, point.X);
      bounds.minY = Math.min(bounds.minY, point.Y);
      bounds.maxX = Math.max(bounds.maxX, point.X);
      bounds.maxY = Math.max(bounds.maxY, point.Y);
    }
  }
  return bounds;
}

function boundsMeet(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

function depthsMeet(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] <= b[1] + CONTACT_TOLERANCE_MM && b[0] <= a[1] + CONTACT_TOLERANCE_MM;
}

/** A region's own filled area in mm², its holes already subtracted by their winding (see clipper.ts). */
function filledArea(region: Region): number {
  const scaled = region.reduce((sum, path) => sum + ClipperLib.Clipper.Area(path), 0);
  return Math.abs(scaled) / (CLIPPER_SCALE * CLIPPER_SCALE);
}

/** Every piece broken into the separate solids it is actually made of, each still knowing which piece that was. */
function prepare(pieces: readonly SolidPiece[]): Prepared[] {
  return pieces.flatMap((piece, part) =>
    splitRegion(piece.region).map((region) => {
      const grown = growRegion(region, CONTACT_TOLERANCE_MM / 2);
      return { ...piece, part, region, grown, bounds: boundsOf(grown), area: filledArea(region) };
    }),
  );
}

/**
 * Whether contact between these two would actually join them.
 *
 * Within one piece it always does: two solids of one printed part that meet are
 * fused, so a name resting on the initial by its first letter holds the rest of
 * itself, cantilevered. Between pieces it depends on how the design goes
 * together — see `Attachment`. Contact with an anchor always counts, since that
 * is what being seated on it means.
 */
function joins(a: Prepared, b: Prepared, attachment: Attachment): boolean {
  return attachment === 'chain' || a.part === b.part || a.anchor === true || b.anchor === true;
}

/**
 * Whether two pieces are in contact — the one expensive test, which is the reason
 * for the two cheap ones in front of it. Most pairs of a design are nowhere near
 * each other, and rejecting those on their bounding boxes costs nothing next to a
 * polygon intersection.
 */
function touches(a: Prepared, b: Prepared): boolean {
  if (!depthsMeet(a.zRange, b.zRange) || !boundsMeet(a.bounds, b.bounds)) {
    return false;
  }
  return !regionIsEmpty(intersectRegions(a.grown, b.grown));
}

/** Every solid reachable from `roots` by hopping between solids that are in contact and joined by it. */
function reachableFrom(roots: number[], solids: Prepared[], attachment: Attachment): Set<number> {
  const found = new Set(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const from = queue.pop()!;
    solids.forEach((solid, i) => {
      if (!found.has(i) && joins(solids[from], solid, attachment) && touches(solids[from], solid)) {
        found.add(i);
        queue.push(i);
      }
    });
  }
  return found;
}

/**
 * Which group of solids is "the design", when the caller marked no anchor: the
 * one covering the most ground. A design that has come apart has a body and a
 * crumb, and the crumb is the news.
 */
function largestGroup(solids: Prepared[], attachment: Attachment): Set<number> {
  const ungrouped = new Set(solids.keys());
  let largest = new Set<number>();
  let largestArea = -1;
  while (ungrouped.size > 0) {
    const [seed] = ungrouped;
    const group = reachableFrom([seed], solids, attachment);
    for (const index of group) {
      ungrouped.delete(index);
    }
    const area = [...group].reduce((sum, index) => sum + solids[index].area, 0);
    if (area > largestArea) {
      largestArea = area;
      largest = group;
    }
  }
  return largest;
}

/** Which solids are held, or null when the question has no answer — see the `anchor` case. */
function heldSolids(solids: Prepared[], attachment: Attachment): Set<number> | null {
  const anchors = [...solids.keys()].filter((i) => solids[i].anchor);
  // With no anchor there is nothing for a piece to be loose *from*: every answer
  // would be arbitrary, so none is given.
  if (attachment === 'anchor' && anchors.length === 0) {
    return null;
  }
  return anchors.length > 0 ? reachableFrom(anchors, solids, attachment) : largestGroup(solids, attachment);
}

/**
 * The ids of the pieces nothing holds — a design's loose parts, which would come
 * off the plate as a handful of bits rather than as the thing on screen.
 *
 * A piece with no footprint is left out rather than reported: a letter trimmed
 * entirely away by a flat-bottom cut, or an ornament whose text has been cleared,
 * is not a piece that came off, it is a piece that isn't there. A design of one
 * piece has nothing to say either.
 */
export function loosePieceIds(pieces: readonly SolidPiece[], attachment: Attachment = 'chain'): string[] {
  const solids = prepare(pieces.filter((piece) => !regionIsEmpty(piece.region)));
  if (solids.length < 2) {
    return [];
  }
  const held = heldSolids(solids, attachment);
  if (held === null) {
    return [];
  }
  // By piece, not by solid: a piece whose dot has come away is named once, as the
  // thing the panel calls it.
  return [...new Set(solids.filter((_, i) => !held.has(i)).map((solid) => solid.id))];
}
