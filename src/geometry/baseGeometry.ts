import * as THREE from 'three';
import type { LineGeometry, TextBlock } from './types';
import { growRegion, intersectRegions, rectRegion, regionFromContours, regionIsEmpty, regionToShapes, subtractRegions, type Region } from './clipper';
import { combineGeometries } from './combine';
import { extrudeMmShapes } from './extrudeToMm';

/**
 * How a design is made to stand up on a table (and, since these pieces print
 * standing up, on the print bed too).
 *
 * - `none`  — nothing added. Right when the font's own bottom is already flat,
 *             as a slab serif's feet are.
 * - `rail`  — a slab under the piece. Works with any font, including a script
 *             whose only contact points would otherwise be a few thin strokes.
 * - `trim`  — cut the piece off flat along a line. Adds no material, but a
 *             script's thin strokes make for a narrow, tippy footprint.
 */
export const STAND_MODES = ['none', 'rail', 'trim'] as const;

export type StandMode = (typeof STAND_MODES)[number];

/** Solid material left under the deepest point of the socket, so the piece lands in a cup rather than over an open hole. */
const RAIL_FLOOR_MM = 2;

/**
 * How far the rail's front and back walls reach into the socket band, so the
 * three slabs the rail is built from genuinely interpenetrate.
 *
 * They are joined by a plain buffer merge, not a CSG union (see combine.ts),
 * which relies on real volumetric overlap. Slabs meeting on an exactly
 * coincident plane would instead share a face with opposing normals and leave
 * interior geometry in the export — the same seam the name display's
 * SLAB_OVERLAP_MM avoids.
 */
const WALL_OVERLAP_MM = 0.01;

export interface BaseRailOptions {
  /** The block's current bounds, in its own local mm space. */
  bounds: THREE.Box3;
  /** The block's baseline — the line the socket is measured from, so every letter sits in it to the same depth. */
  baselineYMm: number;
  /** How far the rail drops below the baseline. Extended automatically if descenders reach lower. */
  heightMm: number;
  /** Front-to-back extent (z). Usually deeper than the lettering itself — that overhang is what stops the piece tipping forward. */
  depthMm: number;
  /** How far the rail extends past the lettering's left and right extremes. */
  marginMm: number;
  /** The lettering's own z depth, so the rail can be centered on it rather than sitting flush with one face. */
  blockDepthMm: number;
  /** The block's own silhouette, in the same local frame as `bounds` — this is what gets cut out of the rail. */
  socketRegion: Region;
  /** How far the piece sinks into the rail: the distance from the baseline up to the rail's top face. */
  socketDepthMm: number;
  /** How much larger than the piece the socket is cut, all round, so the two printed parts actually go together. */
  socketClearanceMm: number;
}

/**
 * A slab under a block with a socket cut into it, shaped like the block itself,
 * so the piece drops into the base instead of running through it.
 *
 * Anchored to the *baseline*, not to the block's lowest point: the socket's
 * depth is measured from there, so every letter of a block sinks in by the same
 * amount rather than only the ones with descenders reaching the rail at all.
 * The bottom always clears the lowest ink by the clearance plus `RAIL_FLOOR_MM`,
 * so a descender ends up inside the socket with material still under it.
 *
 * Built as three slabs stacked front to back rather than as a 3D boolean: the
 * socket is only as deep as the piece is thick, so the rail keeps unbroken
 * front and back walls which locate the piece in z and leave its faces whole.
 * Each is a planar prism — a 2D region extruded — which is all this app ever
 * needs (see clipper.ts).
 */
export function baseRailGeometry(options: BaseRailOptions): THREE.BufferGeometry | null {
  const { bounds, baselineYMm, heightMm, depthMm, marginMm, blockDepthMm, socketRegion, socketDepthMm, socketClearanceMm } = options;
  if (!(heightMm > 0) || !(depthMm > 0) || bounds.isEmpty()) {
    return null;
  }
  const left = bounds.min.x - marginMm;
  const right = bounds.max.x + marginMm;
  if (!(right > left)) {
    return null;
  }

  const top = baselineYMm + Math.max(socketDepthMm, 0);
  const bottom = Math.min(baselineYMm - heightMm, bounds.min.y - socketClearanceMm - RAIL_FLOOR_MM);
  if (!(top > bottom)) {
    return null;
  }

  const outer = rectRegion(left, bottom, right, top);
  const socketed = subtractRegions(outer, growRegion(socketRegion, socketClearanceMm));

  // Where the rail and the socket sit along z. The block runs from 0 to its own
  // depth, and the rail is centered on it.
  const railFront = (blockDepthMm - depthMm) / 2;
  const railBack = railFront + depthMm;
  const socketFront = Math.max(-socketClearanceMm, railFront);
  const socketBack = Math.min(blockDepthMm + socketClearanceMm, railBack);

  const parts: THREE.BufferGeometry[] = [
    // The walls reach a hair into the socket band so the merge has something to
    // bond; a rail no deeper than the piece simply has none.
    slab(outer, railFront, socketFront + WALL_OVERLAP_MM),
    slab(socketed, socketFront, socketBack),
    slab(outer, socketBack - WALL_OVERLAP_MM, railBack),
  ].filter((part): part is THREE.BufferGeometry => part !== null);

  if (parts.length === 0) {
    return null;
  }
  const rail = combineGeometries(parts);
  // Measured up front, as the single BoxGeometry this replaced arrived already
  // measured: callers read the box without asking for it.
  rail.computeBoundingBox();
  return rail;
}

/** One planar prism of the rail: a region extruded from `fromZ` to `toZ`, or null if that band has no thickness. */
function slab(region: Region, fromZ: number, toZ: number): THREE.BufferGeometry | null {
  const thickness = toZ - fromZ;
  if (!(thickness > 0)) {
    return null;
  }
  const geometry = extrudeMmShapes(regionToShapes(region), thickness);
  return geometry ? geometry.translate(0, 0, fromZ) : null;
}

/**
 * Where a flat-bottom trim cuts by default: the block's own typographic
 * baseline, offset by `offsetMm` (positive cuts higher).
 *
 * The baseline is the right default because it is exactly the line a script
 * font's descenders hang below and every other letter already sits on — so the
 * cut flattens the overhang and leaves everything else untouched, and for text
 * with no descenders it removes nothing at all.
 */
export function trimCutY(block: TextBlock, offsetMm: number): number {
  return block.baselineYMm + offsetMm;
}

/**
 * Re-cuts every letter of a block flat at `cutYMm`, discarding whatever hangs
 * below it, and returns a new block. Letter positions, characters and natural
 * anchors are preserved, so gap overrides and line offsets still line up.
 *
 * Works in 2D and re-extrudes, rather than clipping the finished mesh: each
 * letter's silhouette is intersected with a half-plane and extruded again, which
 * gives an exactly flat, still-watertight bottom face. Done here (inside the
 * async build) because it changes the silhouette itself, the same way size and
 * depth do.
 */
export function trimBlockBelow(block: TextBlock, cutYMm: number, extrudeDepthMm: number): TextBlock {
  // Generously larger than any plausible design (10 metres), so the rectangle
  // acts as a half-plane: only its bottom edge ever cuts anything. Kept below
  // clipper-lib's loRange once scaled, so the clip stays on its plain-number
  // arithmetic path instead of switching to emulated 128-bit multiplies.
  const FAR_MM = 1e4;
  const keep = rectRegion(-FAR_MM, cutYMm, FAR_MM, FAR_MM);

  const lines: LineGeometry[] = block.lines.map((line) => ({
    letters: line.letters.map((letter) => {
      const clipped = intersectRegions(regionFromContours(letter.contours), keep);
      if (regionIsEmpty(clipped)) {
        // Entirely below the cut. Kept as an entry (indices feed letter-gap
        // overrides) but with nothing to draw or print; combine.ts skips empty
        // parts and an empty bounding box unions away harmlessly.
        return { ...letter, geometry: new THREE.BufferGeometry(), contours: [] };
      }
      const shapes = regionToShapes(clipped);
      const geometry = extrudeMmShapes(shapes, extrudeDepthMm);
      return {
        ...letter,
        geometry: geometry ?? new THREE.BufferGeometry(),
        contours: shapes.map((shape) => ({
          outer: shape.getPoints(),
          holes: shape.holes.map((hole) => hole.getPoints()),
        })),
      };
    }),
  }));

  return { ...block, lines };
}
