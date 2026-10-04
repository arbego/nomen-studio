import rawCatalog from './materialIconsCatalog.json';

/** One icon of the self-hosted Material Icons font — see scripts/generate-icon-catalog.mjs. */
export interface IconEntry {
  /** Google's own name for the icon, which is also what the picker searches. */
  name: string;
  /** Where its glyph lives in the font. Icons are addressed by codepoint rather than by ligature, since reading ligatures back out of GSUB is far more work for the same answer. */
  codepoint: number;
}

// Generated already sorted by name, but sorted here too so the ordering is a
// property of this module rather than of whenever the file was last generated.
const CATALOG: IconEntry[] = (rawCatalog as IconEntry[]).slice().sort((a, b) => a.name.localeCompare(b.name));

const BY_NAME = new Map(CATALOG.map((icon) => [icon.name, icon]));

export function getIcon(name: string): IconEntry {
  const icon = BY_NAME.get(name);
  if (!icon) {
    throw new Error(`Unknown icon: ${name}`);
  }
  return icon;
}

/** The single character that renders this icon, both in the font-backed picker and as the "text" its glyph is built from. */
export function iconChar(name: string): string {
  return String.fromCodePoint(getIcon(name).codepoint);
}

const DEFAULT_RESULT_LIMIT = 90;

/**
 * Searches the icon set by name. Prefix matches rank above substring matches,
 * and within each group the order is alphabetical, which for icon names — where
 * a shared prefix means a shared family, like `favorite` and `favorite_border` —
 * keeps related icons next to each other. Capped at `limit`, since no one
 * browses two thousand icons at once.
 */
export function searchIcons(query: string, limit = DEFAULT_RESULT_LIMIT): IconEntry[] {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, '_');
  if (!normalized) {
    return CATALOG.slice(0, limit);
  }

  const prefixMatches: IconEntry[] = [];
  const substringMatches: IconEntry[] = [];
  for (const icon of CATALOG) {
    if (icon.name.startsWith(normalized)) {
      prefixMatches.push(icon);
    } else if (icon.name.includes(normalized)) {
      substringMatches.push(icon);
    }
  }
  return [...prefixMatches, ...substringMatches].slice(0, limit);
}

/** A handful of icons that suit a name display, offered before the user has searched for anything. */
export const SUGGESTED_ICONS = ['favorite', 'star', 'pets', 'cake', 'music_note', 'celebration', 'auto_awesome', 'local_florist'];
