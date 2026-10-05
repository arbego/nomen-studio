import { useEffect, useRef, useState } from 'react';

/**
 * Whether a modifier key is being held down right now.
 *
 * On `window` rather than on the canvas, because a modifier is held before the
 * pointer goes anywhere near the thing it applies to — a canvas listener would
 * only hear about it once you had already clicked something.
 *
 * `onRelease` fires when it goes back up, for state that only makes sense while
 * it is down: letting go has to clear it there and then, since nothing else
 * will say when it happened.
 */
export function useKeyHeld(key: string, onRelease?: () => void): boolean {
  const [held, setHeld] = useState(false);
  // Kept in a ref so a caller can pass a fresh closure every render without
  // tearing the listeners down and putting them back each time. Written after
  // the render rather than during it, which is the only safe moment.
  const release = useRef(onRelease);
  useEffect(() => {
    release.current = onRelease;
  });

  useEffect(() => {
    // Not in the headless scene tests, which have no DOM at all.
    if (typeof window === 'undefined') return;

    const letGo = () => {
      setHeld((wasHeld) => {
        if (wasHeld) release.current?.();
        return false;
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === key) setHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === key) letGo();
    };
    // A key released over another window, or the tab going to the background
    // mid-press, would otherwise leave it held forever.
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', letGo);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', letGo);
    };
  }, [key]);

  return held;
}
