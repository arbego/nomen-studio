import { useEffect, useRef } from 'react';
import { create } from 'zustand';

/**
 * How long the flash runs — the length of the `focus-flash` animation in
 * index.css, which the two have to agree on. Only used to let the request go
 * once it is spent: nothing stays lit, because nothing here is selected, the
 * preview is still the thing being edited.
 */
export const FLASH_MS = 3400;

/** The class index.css hangs that animation on. Added by hand rather than through React — see below. */
const FLASH_CLASS = 'focus-flash';

/**
 * How many frames the panel has to hold still before the scroll counts as
 * finished. Three, because a smooth scroll does not necessarily start in the
 * very first frame after it is asked for, and one early frame at the old
 * position would otherwise read as "already arrived".
 */
const SETTLED_FRAMES = 3;

/** Longest the flash will wait for a scroll before going ahead anyway, so a panel that somehow never settles can't swallow it. */
const SETTLE_TIMEOUT_MS = 1000;

interface FocusRequest {
  /** Which target to reveal. Products name their own — see each one's focus.ts. */
  key: string;
}

interface FocusStore {
  request: FocusRequest | null;
  /** Reveal the control for `key`: scroll it into the panel and light it briefly. */
  focus: (key: string) => void;
}

/**
 * Which control the preview last asked for, for as long as it is lit.
 *
 * Global rather than per-product because it is about the shell's two halves,
 * not about any design: the scene and the panel are mounted in separate
 * subtrees (see AppShell), and this is the one thing they have to say to each
 * other. Products never share a key — only one is ever mounted — so each names
 * its own however reads best.
 *
 * The store holds the flash's lifetime itself, rather than every target running
 * a timer of its own, so a target's own "am I lit" is a plain derivation from
 * state instead of state that has to be kept in step with it. A fresh object on
 * every call, deliberately: clicking the same thing twice has to scroll to it
 * twice, and identity is what the effect below wakes on.
 */
export const useFocusStore = create<FocusStore>((set) => ({
  request: null,
  focus: (key) => {
    clearTimeout(flashTimer);
    set({ request: { key } });
    flashTimer = setTimeout(() => set({ request: null }), FLASH_MS);
  },
}));

// Module-level because there is only ever one flash: a second click supersedes
// the first rather than lighting two things at once.
let flashTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Makes an element the answer to clicking something in the preview: when the
 * scene asks for `key`, the element scrolls into the middle of the panel and
 * lights up for a moment.
 *
 * `key` may be undefined, for a control that happens to have nothing pointing
 * at it — it then simply never matches.
 */
export function useFocusTarget(key: string | undefined) {
  const request = useFocusStore((s) => s.request);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || key === undefined || request?.key !== key) return;
    // 'center' rather than 'nearest': the point is to say "here", and a control
    // that happened to be in view already would otherwise not move at all,
    // leaving only the flash to carry the message.
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Only once the panel has come to rest: a long smooth scroll takes most of
    // a second, and a flash that ran during it would be over, or nearly, by the
    // time the control arrived under the eye.
    return whenScrollSettles(element, () => flash(element));
  }, [request, key]);

  return ref;
}

/**
 * Replays the flash on an element.
 *
 * Driven through the DOM rather than through a className, because the same
 * control can be asked for twice running and a CSS animation only replays if it
 * is taken off and put back on. Reading a layout property in between is what
 * makes the browser treat that as a new animation rather than as nothing having
 * happened. React never writes this class, so it can't clobber it on a
 * re-render.
 */
function flash(element: HTMLElement): void {
  element.classList.remove(FLASH_CLASS);
  element.getBoundingClientRect();
  element.classList.add(FLASH_CLASS);
  // Taken off again once it is spent, so only ever one control carries it and
  // the DOM says what is true. Replacing it mid-flash cancels the animation
  // rather than ending it, so this listener survives to clean up after the one
  // that replaced it — which is the same thing done once more.
  element.addEventListener('animationend', () => element.classList.remove(FLASH_CLASS), { once: true });
}

/**
 * Calls back once the panel around `element` has stopped scrolling, and returns
 * a function that calls it off.
 *
 * Watched frame by frame rather than through the `scrollend` event, which is
 * still missing in Safari — and polling the one number is cheap next to getting
 * this wrong, which is a flash nobody sees.
 */
function whenScrollSettles(element: HTMLElement, done: () => void): () => void {
  if (typeof requestAnimationFrame !== 'function') {
    done();
    return () => {};
  }
  const scroller = scrollingAncestor(element);
  let last = scroller?.scrollTop;
  let stillFor = 0;
  let frame = 0;
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;

  const tick = () => {
    const now = scroller?.scrollTop;
    stillFor = now === last ? stillFor + 1 : 0;
    last = now;
    if (stillFor >= SETTLED_FRAMES || Date.now() > deadline) {
      done();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/** The panel this control scrolls inside — the first ancestor with anything to scroll. */
function scrollingAncestor(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}
