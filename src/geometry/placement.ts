import * as THREE from 'three';
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

/**
 * Moves a built solid out of its own frame and into the one it is placed on:
 * turned about its pivot, shifted to its offset, and seated at `zMm`.
 *
 * The same placement the 2D booleans were cut from, so a piece always lands in
 * the recess that was made for it. Mutates, as THREE's own transforms do.
 */
export function placeGeometry(geometry: THREE.BufferGeometry, placement: Placement2D, zMm = 0): THREE.BufferGeometry {
  const { pivot = ORIGIN, translate = ORIGIN, rotationRad = 0 } = placement;
  // Reads, right to left, as placePoint does: to the pivot, turn, then back out
  // to the pivot plus the offset — with the seating folded into that last step,
  // since a turn about Z leaves z alone.
  const matrix = new THREE.Matrix4()
    .makeTranslation(pivot.x + translate.x, pivot.y + translate.y, zMm)
    .multiply(new THREE.Matrix4().makeRotationZ(rotationRad))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, 0));
  return geometry.applyMatrix4(matrix);
}
