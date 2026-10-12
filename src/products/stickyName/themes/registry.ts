import { bubbleTheme } from './bubble';
import type { LetterTheme } from './types';

export const LETTER_THEMES: readonly LetterTheme[] = [bubbleTheme];
export function getLetterTheme(id: string): LetterTheme {
  const theme = LETTER_THEMES.find((entry) => entry.id === id);
  if (!theme) throw new Error(`Unknown letter theme: ${id}`);
  return theme;
}
