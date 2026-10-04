/**
 * What clicking a part of the topper in the preview points at in the panel.
 *
 * One module both halves import, so the scene and the controls can't drift into
 * naming the same thing differently — the keys themselves are arbitrary, it is
 * only that they agree that matters. See ui/focusStore.ts.
 */

/** A line of lettering points at its own text field, not at the Text section as a whole: with three lines on the piece, which one you clicked is the answer. */
export function lineFocusKey(lineIndex: number): string {
  return `line-${lineIndex}`;
}

/** Every stick points at the one section — their size and number are set there together, and a stick's own position is set by dragging it rather than in the panel. */
export const STICKS_FOCUS_KEY = 'sticks';
