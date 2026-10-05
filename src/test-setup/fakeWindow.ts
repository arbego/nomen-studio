import { act } from 'react';

/**
 * A stand-in for `window`, which this suite deliberately runs without.
 *
 * There is no DOM here on purpose (see browserPolyfills.ts), but anything
 * watching for a key being held listens on the window — a modifier is held
 * before the pointer goes anywhere near what it applies to. So the window is
 * what gets faked, not the document.
 *
 * Install it before rendering and `remove()` it afterwards, or the next test
 * file inherits a window that the thing under test will believe in.
 */
export function installFakeWindow() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  (globalThis as { window?: unknown }).window = {
    addEventListener(type: string, handler: (event: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    },
    removeEventListener(type: string, handler: (event: unknown) => void) {
      listeners.get(type)?.delete(handler);
    },
  };

  return {
    /** Fires an event at everything listening for it, inside an act() so React has committed by the time it returns. */
    fire: async (type: string, event: unknown = {}) => {
      await act(async () => {
        for (const handler of listeners.get(type) ?? []) handler(event);
      });
    },
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
    remove: () => {
      delete (globalThis as { window?: unknown }).window;
    },
  };
}
