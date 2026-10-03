/**
 * Shared UI presets. These are cosmetic/convenience defaults offered by the
 * generic controls (see ui/controls/), so they live here rather than in any one
 * product's store — every product's panel reuses the same swatches and the same
 * size shortcuts.
 */

/** Common finished sizes, in mm, offered as one-click shortcuts next to the free size slider. */
export const SIZE_PRESETS_MM = [100, 120, 150] as const;

/** Typical 3D-printer filament colors. Purely a preview aid — the printed color comes from the filament, not the exported file. */
export const COLOR_PRESETS = [
  { id: 'white', label: 'Weiß', hex: '#f7f5f2' },
  { id: 'beige', label: 'Beige', hex: '#e8d9c3' },
  { id: 'rosa', label: 'Rosa', hex: '#f0c6d0' },
  { id: 'altrosa', label: 'Altrosa', hex: '#d9a9ab' },
  { id: 'sage', label: 'Sage', hex: '#b7c4ac' },
  { id: 'black', label: 'Schwarz', hex: '#2b2b2b' },
] as const;
