import type { FontDefinition } from './types';
import { getCatalogEntry } from './catalog';

// Suggested fonts use the same on-demand catalog as every other text font.
// Keep these IDs stable so saved projects and product defaults still resolve.
export const FONT_REGISTRY: FontDefinition[] = [
  'calistoga', 'alfa-slab-one', 'dancing-script', 'allura',
  'pacifico', 'parisienne', 'sacramento',
].map((id) => {
  const font = getCatalogEntry(id);
  if (!font) throw new Error(`Suggested font missing from catalog: ${id}`);
  return font;
});

/**
 * The icon faces, as fonts — which is what they technically are: each icon is
 * one glyph, so the whole text pipeline (parse, outline, extrude, boolean)
 * builds an icon exactly as it builds a letter, for free.
 *
 * Deliberately not in FONT_REGISTRY: these are not faces anyone sets a name in,
 * and nothing that offers the user a choice of fonts should offer them. Icons
 * are chosen from the icon catalogues instead (see icons/catalog.ts), which is
 * also what says which of these each icon belongs to. They are still resolvable
 * by id below, so loadFont and its cache need no special case.
 *
 * `family` is the name the stylesheet declares each one under, so the picker can
 * draw an icon with the same file its geometry is built from — see index.css.
 */
export const ICON_FONTS: FontDefinition[] = [
  {
    id: 'material-icons',
    label: 'Material Icons',
    family: 'Material Icons',
    category: 'icons',
    url: new URL('../assets/icons/material-icons/MaterialIcons-Regular.ttf', import.meta.url).href,
  },
  {
    id: 'phosphor-fill',
    label: 'Phosphor Fill',
    family: 'Phosphor Fill',
    category: 'icons',
    url: new URL('../assets/icons/phosphor-fill/Phosphor-Fill.ttf', import.meta.url).href,
  },
  {
    id: 'noto-emoji',
    label: 'Noto Emoji',
    family: 'Noto Emoji',
    category: 'icons',
    url: new URL('../assets/icons/noto-emoji/NotoEmoji-Regular.ttf', import.meta.url).href,
  },
];

const ICONS_BY_ID = new Map(ICON_FONTS.map((f) => [f.id, f]));

/** Looks up a self-hosted icon face or an on-demand Google Fonts family. */
export function getFontDefinition(id: string): FontDefinition {
  const icon = ICONS_BY_ID.get(id);
  if (icon) {
    return icon;
  }
  const catalogEntry = getCatalogEntry(id);
  if (!catalogEntry) {
    throw new Error(`Unknown font id: ${id}`);
  }
  return catalogEntry;
}
