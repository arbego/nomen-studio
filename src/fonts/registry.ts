import type { FontDefinition } from './types';

// Each entry is one downloaded, self-hosted Google Font (OFL-licensed) plus the
// metadata needed to parse it correctly with opentype.js. To add a font: drop its
// .ttf (+ OFL.txt) under src/assets/fonts/<id>/ and add one entry below — nothing
// else in the app needs to change.
export const FONT_REGISTRY: FontDefinition[] = [
  {
    id: 'dancing-script',
    label: 'Dancing Script',
    family: 'Dancing Script',
    category: 'script',
    url: new URL('../assets/fonts/dancing-script/DancingScript-Regular.ttf', import.meta.url).href,
    variationSettings: { wght: 700 },
  },
  {
    id: 'allura',
    label: 'Allura',
    family: 'Allura',
    category: 'script',
    url: new URL('../assets/fonts/allura/Allura-Regular.ttf', import.meta.url).href,
  },
  {
    id: 'pacifico',
    label: 'Pacifico',
    family: 'Pacifico',
    category: 'script',
    url: new URL('../assets/fonts/pacifico/Pacifico-Regular.ttf', import.meta.url).href,
  },
  {
    id: 'parisienne',
    label: 'Parisienne',
    family: 'Parisienne',
    category: 'script',
    url: new URL('../assets/fonts/parisienne/Parisienne-Regular.ttf', import.meta.url).href,
  },
  {
    id: 'sacramento',
    label: 'Sacramento',
    family: 'Sacramento',
    category: 'script',
    url: new URL('../assets/fonts/sacramento/Sacramento-Regular.ttf', import.meta.url).href,
  },
];

const BY_ID = new Map(FONT_REGISTRY.map((f) => [f.id, f]));

export function getFontDefinition(id: string): FontDefinition {
  const def = BY_ID.get(id);
  if (!def) {
    throw new Error(`Unknown font id: ${id}`);
  }
  return def;
}

export function fontsByCategory(category: FontDefinition['category']): FontDefinition[] {
  return FONT_REGISTRY.filter((f) => f.category === category);
}
