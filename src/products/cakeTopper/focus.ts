/**
 * What clicking a part of the topper in the preview points at in the panel.
 *
 * One module both halves import, so the scene and the controls can't drift into
 * naming the same thing differently — the names themselves are arbitrary, it is
 * only that they agree that matters. See ui/panelStore.ts.
 */

/** The panel's sections, in the order they appear. The first is the one a fresh panel opens on. */
export const SECTIONS = {
  text: 'text',
  size: 'size',
  color: 'color',
  sticks: 'sticks',
  decorators: 'decorators',
  outline: 'outline',
} as const;

/** A line of lettering points at its own text field within the Text section: with three lines on the piece, which one you clicked is the answer. */
export function lineFocusKey(lineIndex: number): string {
  return `line-${lineIndex}`;
}

/** An ornament points at its own card, which is also the card that gets expanded — with several on the piece, which one you clicked is the answer. */
export function decoratorFocusKey(id: string): string {
  return `decorator-${id}`;
}
