/**
 * Shared UI presets. These are cosmetic/convenience defaults offered by the
 * generic controls (see ui/controls/), so they live here rather than in any one
 * product's store — every product's panel reuses the same swatches and the same
 * size shortcuts.
 */

/** Common finished sizes, in mm, offered as one-click shortcuts next to the free size slider. */
export const SIZE_PRESETS_MM = [100, 120, 150] as const;

/** Which row of the picker a color sits in. Pastels and bolds are different kinds of design, not shades of one, so they are not mixed into one wall of swatches. */
export type ColorFamily = 'pastel' | 'bold';

/** The families in the order the picker lays them out, one row each. */
export const COLOR_FAMILIES: readonly ColorFamily[] = ['pastel', 'bold'] as const;

/**
 * Typical 3D-printer filament colors. Purely a preview aid — the printed color
 * comes from the filament, not the exported file.
 *
 * Two rows. The pastels come first because that is what most of these pieces
 * are: a name display for a nursery, a christening topper. The bolds are there
 * because a birthday "6" in red is not a pastel object, and because a pastel
 * inlay needs something with weight behind it to read at all.
 *
 * Each row is ordered the way a paint chart is: the neutrals, then the warm
 * end, then the cool one, then the darks. That ordering is also why nothing
 * outside this file reaches in by index — use `presetColor` below, so a palette
 * that grows or gets resorted can't silently repaint a product's defaults.
 */
export const COLOR_PRESETS = [
  { id: 'white', label: 'Weiß', hex: '#f7f5f2', family: 'pastel' },
  { id: 'cream', label: 'Creme', hex: '#f3ead7', family: 'pastel' },
  { id: 'beige', label: 'Beige', hex: '#e8d9c3', family: 'pastel' },
  { id: 'vanilla', label: 'Vanille', hex: '#f2e3ab', family: 'pastel' },
  { id: 'apricot', label: 'Apricot', hex: '#f7cdaf', family: 'pastel' },
  { id: 'coral', label: 'Koralle', hex: '#f4b4a4', family: 'pastel' },
  { id: 'rosa', label: 'Rosa', hex: '#f0c6d0', family: 'pastel' },
  { id: 'altrosa', label: 'Altrosa', hex: '#d9a9ab', family: 'pastel' },
  { id: 'mauve', label: 'Mauve', hex: '#c9a6bd', family: 'pastel' },
  { id: 'lilac', label: 'Lavendel', hex: '#cdc2e6', family: 'pastel' },
  { id: 'periwinkle', label: 'Flieder', hex: '#b6bfe4', family: 'pastel' },
  { id: 'sky', label: 'Himmelblau', hex: '#b5d2e8', family: 'pastel' },
  { id: 'aqua', label: 'Aqua', hex: '#aed8d9', family: 'pastel' },
  { id: 'mint', label: 'Mint', hex: '#bfe0cb', family: 'pastel' },
  { id: 'sage', label: 'Sage', hex: '#b7c4ac', family: 'pastel' },
  { id: 'stone', label: 'Hellgrau', hex: '#d6d2cc', family: 'pastel' },

  { id: 'silver', label: 'Silber', hex: '#b4b8bc', family: 'bold' },
  { id: 'gold', label: 'Gold', hex: '#c8a02e', family: 'bold' },
  { id: 'yellow', label: 'Gelb', hex: '#efc02a', family: 'bold' },
  { id: 'orange', label: 'Orange', hex: '#e2742a', family: 'bold' },
  { id: 'red', label: 'Rot', hex: '#cc3a33', family: 'bold' },
  { id: 'pink', label: 'Pink', hex: '#d2488a', family: 'bold' },
  { id: 'purple', label: 'Violett', hex: '#7a52a1', family: 'bold' },
  { id: 'blue', label: 'Blau', hex: '#3368b0', family: 'bold' },
  { id: 'teal', label: 'Türkis', hex: '#1f9a94', family: 'bold' },
  { id: 'green', label: 'Grün', hex: '#3f9655', family: 'bold' },
  { id: 'brown', label: 'Braun', hex: '#8a5a3b', family: 'bold' },
  { id: 'grey', label: 'Anthrazit', hex: '#4a4a4a', family: 'bold' },
  { id: 'black', label: 'Schwarz', hex: '#2b2b2b', family: 'bold' },
] as const;

export type ColorPresetId = (typeof COLOR_PRESETS)[number]['id'];

/** One preset's hex by name, so a default reads as the color it is. The id is a closed union, so a typo is a build error rather than a mystery swatch. */
export function presetColor(id: ColorPresetId): string {
  return COLOR_PRESETS.find((color) => color.id === id)!.hex;
}
