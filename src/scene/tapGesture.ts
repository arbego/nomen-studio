import { useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';

/**
 * How far the pointer may travel between press and release and still count as
 * a tap (CSS pixels). Generous enough for the wobble of a real click — a mouse
 * moves a pixel or two under the finger — and far below any drag meant as one.
 */
const TAP_SLOP_PX = 4;

export interface TapGesture {
  press: (event: ThreeEvent<PointerEvent>) => void;
  /**
   * Whether the pointer went down on this object and came back up without
   * really moving. Consumes the press either way, so a drag can't leave one
   * behind for the next release to pick up.
   */
  release: (event: ThreeEvent<PointerEvent>) => boolean;
}

/**
 * Telling a click apart from a drag, on an object that is draggable.
 *
 * Measured in screen pixels rather than in the model's own millimetres,
 * because this is about what the hand did, not about what moved: the same
 * wobble is a huge drag on a design zoomed right in and nothing at all on one
 * zoomed out.
 *
 * Deliberately not React Three Fiber's own `onClick`, which fires on every
 * release over an object however far it travelled first — on a draggable
 * object that would mean every drag also ends in a click.
 */
export function useTapGesture(): TapGesture {
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  return {
    press: (event) => {
      pressedAt.current = { x: event.clientX, y: event.clientY };
    },
    release: (event) => {
      const from = pressedAt.current;
      pressedAt.current = null;
      return from !== null && Math.hypot(event.clientX - from.x, event.clientY - from.y) <= TAP_SLOP_PX;
    },
  };
}
