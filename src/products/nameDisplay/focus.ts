/**
 * What clicking a piece of the display in the preview points at in the panel.
 *
 * One module both halves import, so the scene and the controls can't drift into
 * naming the same thing differently — the names themselves are arbitrary, it is
 * only that they agree that matters. See ui/panelStore.ts.
 */

/** The panel's sections, in the order they appear. The first is the one a fresh panel opens on. */
export const SECTIONS = {
  initial: 'initial',
  hollow: 'hollow',
  name: 'name',
  inlay: 'inlay',
  decorators: 'decorators',
  standing: 'standing',
} as const;

/**
 * The letter and the name point at their own fields rather than at their whole
 * sections: clicking the letter asks what that letter is, and washing over
 * everything down to its color would say less, not more.
 */
export const INITIAL_FOCUS_KEY = 'initial-text';
export const NAME_FOCUS_KEY = 'name-text';
export const CABLE_HOLE_FOCUS_KEY = 'cable-hole';

/** An ornament points at its own card, which is also the card that gets expanded — with several on the piece, which one you clicked is the answer. */
export function decoratorFocusKey(id: string): string {
  return `decorator-${id}`;
}
