import * as THREE from 'three';
import type { LineGeometry, TextBlock } from './types';
import { intersectRegions, rectRegion, regionFromContours, regionIsEmpty, regionToShapes } from './clipper';
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

/** How far the rail reaches up into the piece above it, so the plain buffer merge in combine.ts has real volumetric overlap to bond rather than a bare tangent touch — the same trick stickGeometry.ts uses with embedMm. */
const RAIL_EMBED_MM = 1;

export interface BaseRailOptions {
  /** The block's current bounds, in its own local mm space. */
  bounds: THREE.Box3;
  /** The block's baseline — where the rail's top sits, so every letter resting on it is bonded. */
  baselineYMm: number;
  /** How far the rail drops below the baseline. Extended automatically if descenders reach lower. */
  heightMm: number;
  /** Front-to-back extent (z). Usually deeper than the lettering itself — that overhang is what stops the piece tipping forward. */
  depthMm: number;
  /** How far the rail extends past the lettering's left and right extremes. */
  marginMm: number;
  /** The lettering's own z depth, so the rail can be centered on it rather than sitting flush with one face. */
  blockDepthMm: number;
}

/**
 * A plain slab under a block, centered on the block's own depth so the piece
 * is supported equally front and back.
 *
 * Anchored to the *baseline*, not to the block's lowest point. Anchoring it to
 * the lowest point would put the rail under the descenders only, leaving every
 * letter without one (in "Peggy", the P and the e) floating 15mm above it —
 * and since parts are merged, not unioned, the export would be three disjoint
 * shells that fall apart off the print bed. The top is pushed
 * `RAIL_EMBED_MM` above the baseline so the solids genuinely interpenetrate,
 * and the bottom always clears the lowest ink, so descenders end up swallowed
 * by the rail rather than poking out of it.
 */
export function baseRailGeometry(options: BaseRailOptions): THREE.BufferGeometry | null {
  const { bounds, baselineYMm, heightMm, depthMm, marginMm, blockDepthMm } = options;
  if (!(heightMm > 0) || !(depthMm > 0) || bounds.isEmpty()) {
    return null;
  }
  const width = bounds.max.x - bounds.min.x + 2 * marginMm;
  if (!(width > 0)) {
    return null;
  }

  const top = baselineYMm + RAIL_EMBED_MM;
  const bottom = Math.min(baselineYMm - heightMm, bounds.min.y - RAIL_EMBED_MM);
  const height = top - bottom;
  if (!(height > 0)) {
    return null;
  }

  const geometry = new THREE.BoxGeometry(width, height, depthMm).toNonIndexed();
  geometry.translate((bounds.min.x + bounds.max.x) / 2, (top + bottom) / 2, blockDepthMm / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
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
