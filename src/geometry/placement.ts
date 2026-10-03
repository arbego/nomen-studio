import type { Offset2D } from './types';

/**
 * Where a block sits relative to the piece it is placed on: a rotation about
 * `pivot`, then a translation. Applied as `R(p - pivot) + pivot + translate`.
 *
 * The same placement has to drive two things that must agree exactly — the
 * preview transform and the 2D boolean that cuts the pocket — so it is
 * expressed once, here, rather than once per consumer.
 */
export interface Placement2D {
  /**
   * Translation applied in the source frame, *before* the rotation — for a
   * shift that belongs to the block's own layout and so should tilt with it,
   * like a letter-gap override moving a letter along its baseline.
   */
  preTranslate?: Offset2D;
  /** Rotation in radians, counter-clockwise, about `pivot`. */
  rotationRad?: number;
  /** The point the rotation turns about, in the source frame. Defaults to the origin. */
  pivot?: Offset2D;
  /** Translation applied after the rotation, in mm — where the rotated block ends up on the piece it's placed on. */
  translate?: Offset2D;
}

const ORIGIN: Offset2D = { x: 0, y: 0 };

/** Rotates an offset counter-clockwise about the origin — e.g. to carry a drag delta measured in a rotated frame back into its parent's. */
export function rotateOffset(offset: Offset2D, rotationRad: number): Offset2D {
  if (rotationRad === 0) {
    return offset;
  }
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  return { x: offset.x * cos - offset.y * sin, y: offset.x * sin + offset.y * cos };
}

/** Applies a placement to one point: `R((p + preTranslate) - pivot) + pivot + translate`. */
export function placePoint(x: number, y: number, placement: Placement2D): Offset2D {
  const { preTranslate = ORIGIN, translate = ORIGIN, rotationRad = 0, pivot = ORIGIN } = placement;
  const rotated = rotateOffset({ x: x + preTranslate.x - pivot.x, y: y + preTranslate.y - pivot.y }, rotationRad);
  return { x: rotated.x + pivot.x + translate.x, y: rotated.y + pivot.y + translate.y };
}

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
