/**
 * What clicking a piece of the display in the preview points at in the panel.
 *
 * One module both halves import, so the scene and the controls can't drift into
 * naming the same thing differently — the keys themselves are arbitrary, it is
 * only that they agree that matters. See ui/focusStore.ts.
 */

export const INITIAL_FOCUS_KEY = 'initial';
export const NAME_FOCUS_KEY = 'name';

/** An ornament points at its own card rather than at the Decorators section: with several on the piece, which one you clicked is the answer. */
export function decoratorFocusKey(id: string): string {
  return `decorator-${id}`;
}
