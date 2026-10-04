/**
 * Shared UI presets. These are cosmetic/convenience defaults offered by the
 * generic controls (see ui/controls/), so they live here rather than in any one
 * product's store — every product's panel reuses the same swatches and the same
 * size shortcuts.
 */

/** Common finished sizes, in mm, offered as one-click shortcuts next to the free size slider. */
export const SIZE_PRESETS_MM = [100, 120, 150] as const;

/**
 * Typical 3D-printer filament colors. Purely a preview aid — the printed color
 * comes from the filament, not the exported file.
 *
 * Ordered the way a paint chart is: the neutrals, then warm pastels, then cool
 * ones, then the one dark. That ordering is also why nothing outside this file
 * reaches in by index — use `presetColor` below, so a palette that grows or gets
 * resorted can't silently repaint a product's defaults.
 */
export const COLOR_PRESETS = [
  { id: 'white', label: 'Weiß', hex: '#f7f5f2' },
  { id: 'cream', label: 'Creme', hex: '#f3ead7' },
  { id: 'beige', label: 'Beige', hex: '#e8d9c3' },
  { id: 'vanilla', label: 'Vanille', hex: '#f2e3ab' },
  { id: 'apricot', label: 'Apricot', hex: '#f7cdaf' },
  { id: 'coral', label: 'Koralle', hex: '#f4b4a4' },
  { id: 'rosa', label: 'Rosa', hex: '#f0c6d0' },
  { id: 'altrosa', label: 'Altrosa', hex: '#d9a9ab' },
  { id: 'mauve', label: 'Mauve', hex: '#c9a6bd' },
  { id: 'lilac', label: 'Lavendel', hex: '#cdc2e6' },
  { id: 'periwinkle', label: 'Flieder', hex: '#b6bfe4' },
  { id: 'sky', label: 'Himmelblau', hex: '#b5d2e8' },
  { id: 'aqua', label: 'Aqua', hex: '#aed8d9' },
  { id: 'mint', label: 'Mint', hex: '#bfe0cb' },
  { id: 'sage', label: 'Sage', hex: '#b7c4ac' },
  { id: 'stone', label: 'Hellgrau', hex: '#d6d2cc' },
  { id: 'black', label: 'Schwarz', hex: '#2b2b2b' },
] as const;

export type ColorPresetId = (typeof COLOR_PRESETS)[number]['id'];

/** One preset's hex by name, so a default reads as the color it is. The id is a closed union, so a typo is a build error rather than a mystery swatch. */
export function presetColor(id: ColorPresetId): string {
  return COLOR_PRESETS.find((color) => color.id === id)!.hex;
}
