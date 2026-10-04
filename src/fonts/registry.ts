import type { FontDefinition } from './types';
import { getCatalogEntry } from './catalog';

// Each entry is one downloaded, self-hosted Google Font (OFL-licensed) plus the
// metadata needed to parse it correctly with opentype.js. To add a font: drop its
// .ttf (+ OFL.txt) under src/assets/fonts/<id>/ and add one entry below — nothing
// else in the app needs to change. These stay pinned as instant, fully-offline
// defaults in the UI; every other Google Fonts family is available too, via the
// generated catalogue (see catalog.ts) — getFontDefinition below falls back to it.
export const FONT_REGISTRY: FontDefinition[] = [
  {
    // What the name display opens on: a soft, rounded display face with enough
    // weight to carry an inlay, which is the other thing a background initial
    // can be — Alfa Slab One below is the same job done bluntly.
    id: 'calistoga',
    label: 'Calistoga',
    family: 'Calistoga',
    category: 'display',
    url: new URL('../assets/fonts/calistoga/Calistoga-Regular.ttf', import.meta.url).href,
  },
  {
    // A display face whose flat feet stand on their own, which is what a
    // background initial wants and no script face can give.
    id: 'alfa-slab-one',
    label: 'Alfa Slab One',
    family: 'Alfa Slab One',
    category: 'display',
    url: new URL('../assets/fonts/alfa-slab-one/AlfaSlabOne-Regular.ttf', import.meta.url).href,
  },
  {
    id: 'dancing-script',
    label: 'Dancing Script',
    family: 'Dancing Script',
    category: 'handwriting',
    url: new URL('../assets/fonts/dancing-script/DancingScript-Regular.ttf', import.meta.url).href,
    variationSettings: { wght: 700 },
  },
  {
    id: 'allura',
    label: 'Allura',
    family: 'Allura',
    category: 'handwriting',
    url: new URL('../assets/fonts/allura/Allura-Regular.ttf', import.meta.url).href,
  },
  {
    id: 'pacifico',
    label: 'Pacifico',
    family: 'Pacifico',
    category: 'handwriting',
    url: new URL('../assets/fonts/pacifico/Pacifico-Regular.ttf', import.meta.url).href,
  },
  {
    id: 'parisienne',
    label: 'Parisienne',
    family: 'Parisienne',
    category: 'handwriting',
    url: new URL('../assets/fonts/parisienne/Parisienne-Regular.ttf', import.meta.url).href,
  },
  {
    id: 'sacramento',
    label: 'Sacramento',
    family: 'Sacramento',
    category: 'handwriting',
    url: new URL('../assets/fonts/sacramento/Sacramento-Regular.ttf', import.meta.url).href,
  },
];

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

const BY_ID = new Map(FONT_REGISTRY.map((f) => [f.id, f]));
const ICONS_BY_ID = new Map(ICON_FONTS.map((f) => [f.id, f]));

/** Looks up a font by id — the curated/self-hosted fonts first, then the icon faces, falling back to the full generated Google Fonts catalogue (see catalog.ts). */
export function getFontDefinition(id: string): FontDefinition {
  const curated = BY_ID.get(id) ?? ICONS_BY_ID.get(id);
  if (curated) {
    return curated;
  }
  const catalogEntry = getCatalogEntry(id);
  if (!catalogEntry) {
    throw new Error(`Unknown font id: ${id}`);
  }
  return catalogEntry;
}
