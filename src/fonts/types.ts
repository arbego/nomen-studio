/** Google Fonts' own family categories, plus `icons` for the icon face — which is a font only in the technical sense, and is never offered as one to set text in. */
export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace' | 'icons';

export interface FontDefinition {
  id: string;
  label: string;
  category: FontCategory;
  /** Resolved asset URL of the .ttf file, produced via `new URL(..., import.meta.url)`. */
  url: string;
  /** Google Fonts family name, for display/attribution. */
  family: string;
  /**
   * Explicit variable-font axis values to pin after parsing (e.g. `{ wght: 600 }`).
   * Required for any variable font whose default named instance can't be trusted —
   * some Google Fonts variable files resolve their "default" instance to an
   * unexpectedly light weight (verified empirically for Montserrat/Quicksand).
   * Omit for static fonts.
   */
  variationSettings?: Record<string, number>;
}
