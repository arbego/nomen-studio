import rawCatalog from './googleFontsCatalog.json';
import type { FontCategory, FontDefinition } from './types';

/** One entry of the generated Google Fonts catalogue — see scripts/generate-font-catalog.mjs. */
export interface CatalogFontEntry extends FontDefinition {
  /** Google's own popularity rank — lower is more popular. Used to rank/tie-break search results. */
  popularity: number;
}

// Sorted here (not just relying on the generated JSON already being sorted)
// so every result ordering below only ever has to reason about one thing —
// match quality — with popularity as a stable, always-correct tie-breaker.
const CATALOG: CatalogFontEntry[] = (rawCatalog as { id: string; family: string; category: FontCategory; popularity: number; url: string }[])
  .map((entry) => ({ ...entry, label: entry.family }))
  .sort((a, b) => a.popularity - b.popularity);

const BY_ID = new Map(CATALOG.map((f) => [f.id, f]));

export function getCatalogEntry(id: string): CatalogFontEntry | undefined {
  return BY_ID.get(id);
}

const DEFAULT_RESULT_LIMIT = 60;

/**
 * Searches the full Google Fonts catalogue by family name, optionally
 * restricted to one category. Prefix matches rank above substring matches;
 * within each group, results are ordered by Google's own popularity rank
 * (lower = more popular). Capped at `limit` so the picker UI never has to
 * render/lazy-load previews for more fonts than a person could reasonably
 * browse at once.
 */
export function searchCatalog(query: string, category?: FontCategory, limit = DEFAULT_RESULT_LIMIT): CatalogFontEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  const candidates = category ? CATALOG.filter((f) => f.category === category) : CATALOG;

  if (!normalizedQuery) {
    return candidates.slice(0, limit);
  }

  const prefixMatches: CatalogFontEntry[] = [];
  const substringMatches: CatalogFontEntry[] = [];
  for (const font of candidates) {
    const name = font.family.toLowerCase();
    if (name.startsWith(normalizedQuery)) {
      prefixMatches.push(font);
    } else if (name.includes(normalizedQuery)) {
      substringMatches.push(font);
    }
  }
  return [...prefixMatches, ...substringMatches].slice(0, limit);
}
