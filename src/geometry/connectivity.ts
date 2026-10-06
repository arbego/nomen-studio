import * as ClipperLib from 'clipper-lib';
import { CLIPPER_SCALE, growRegion, intersectRegions, regionIsEmpty, type Region } from './clipper';

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
 * Granularity is the caller's to choose, and it is the whole question. A piece is
 * taken to be internally connected, so handing over the lettering as one piece
 * asks whether the lettering is held, while handing over a piece per letter asks
 * whether the letters hold each other. Pass what the printed part is, split no
 * further than the parts that could actually come apart.
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

interface Prepared extends SolidPiece {
  /** Grown by half the tolerance, so a bare touch reads as the overlap it will print as. */
  grown: Region;
  bounds: Bounds;
  /** Filled area, for telling which group of pieces is the design and which came off it. */
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

function prepare(piece: SolidPiece): Prepared {
  const grown = growRegion(piece.region, CONTACT_TOLERANCE_MM / 2);
  return { ...piece, grown, bounds: boundsOf(grown), area: filledArea(piece.region) };
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

/** Every piece reachable from `roots` by hopping between pieces in contact. */
function reachableFrom(roots: number[], pieces: Prepared[]): Set<number> {
  const found = new Set(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const from = queue.pop()!;
    pieces.forEach((piece, i) => {
      if (!found.has(i) && touches(pieces[from], piece)) {
        found.add(i);
        queue.push(i);
      }
    });
  }
  return found;
}

/**
 * Which group of pieces is "the design", when the caller marked no anchor: the
 * one covering the most ground. A design that has come apart has a body and a
 * crumb, and the crumb is the news.
 */
function largestGroup(pieces: Prepared[]): Set<number> {
  const ungrouped = new Set(pieces.keys());
  let largest = new Set<number>();
  let largestArea = -1;
  while (ungrouped.size > 0) {
    const [seed] = ungrouped;
    const group = reachableFrom([seed], pieces);
    for (const index of group) {
      ungrouped.delete(index);
    }
    const area = [...group].reduce((sum, index) => sum + pieces[index].area, 0);
    if (area > largestArea) {
      largestArea = area;
      largest = group;
    }
  }
  return largest;
}

/** Which pieces are held, or null when the question has no answer — see the `anchor` case. */
function heldPieces(pieces: Prepared[], attachment: Attachment): Set<number> | null {
  const anchors = [...pieces.keys()].filter((i) => pieces[i].anchor);
  if (attachment === 'anchor') {
    // With no anchor there is nothing for a piece to be loose *from*: every
    // answer would be arbitrary, so none is given.
    if (anchors.length === 0) {
      return null;
    }
    const seated = [...pieces.keys()].filter((i) => anchors.some((anchor) => touches(pieces[i], pieces[anchor])));
    return new Set([...anchors, ...seated]);
  }
  return anchors.length > 0 ? reachableFrom(anchors, pieces) : largestGroup(pieces);
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
  const present = pieces.filter((piece) => !regionIsEmpty(piece.region)).map(prepare);
  if (present.length < 2) {
    return [];
  }
  const held = heldPieces(present, attachment);
  if (held === null) {
    return [];
  }
  return [...new Set(present.filter((_, i) => !held.has(i)).map((piece) => piece.id))];
}
