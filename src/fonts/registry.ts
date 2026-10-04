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
    // The one display face among the curated set: a heavy slab serif whose flat
    // feet stand on their own, which is what the name display's background
    // initial wants and no script face can give.
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
 * The icon face, as a font — which is what it technically is: each icon is one
 * glyph, so the whole text pipeline (parse, outline, extrude, boolean) builds an
 * icon exactly as it builds a letter, for free.
 *
 * Deliberately not in FONT_REGISTRY: it is not a face anyone sets a name in, and
 * nothing that offers the user a choice of fonts should offer this one. Icons
 * are chosen from the icon catalogue instead (see icons/catalog.ts). It is still
 * resolvable by id below, so loadFont and its cache need no special case.
 */
export const ICON_FONT: FontDefinition = {
  id: 'material-icons',
  label: 'Material Icons',
  family: 'Material Icons',
  category: 'icons',
  url: new URL('../assets/icons/material-icons/MaterialIcons-Regular.ttf', import.meta.url).href,
};

const BY_ID = new Map(FONT_REGISTRY.map((f) => [f.id, f]));

/** Looks up a font by id — the curated/self-hosted fonts first, then the icon face, falling back to the full generated Google Fonts catalogue (see catalog.ts). */
export function getFontDefinition(id: string): FontDefinition {
  const curated = BY_ID.get(id);
  if (curated) {
    return curated;
  }
  if (id === ICON_FONT.id) {
    return ICON_FONT;
  }
  const catalogEntry = getCatalogEntry(id);
  if (!catalogEntry) {
    throw new Error(`Unknown font id: ${id}`);
  }
  return catalogEntry;
}
