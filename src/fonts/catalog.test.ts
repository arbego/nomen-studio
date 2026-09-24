import { describe, expect, it, vi } from 'vitest';

vi.mock('./googleFontsCatalog.json', () => ({
  default: [
    { id: 'roboto', family: 'Roboto', category: 'sans-serif', popularity: 2, url: 'https://fonts.gstatic.com/roboto.ttf' },
    { id: 'robert', family: 'Robert', category: 'sans-serif', popularity: 5, url: 'https://fonts.gstatic.com/robert.ttf' },
    { id: 'zzz-roboto-fake', family: 'Zzz Roboto Fake', category: 'handwriting', popularity: 1, url: 'https://fonts.gstatic.com/zzz.ttf' },
    { id: 'open-sans', family: 'Open Sans', category: 'sans-serif', popularity: 3, url: 'https://fonts.gstatic.com/opensans.ttf' },
    { id: 'lobster', family: 'Lobster', category: 'display', popularity: 50, url: 'https://fonts.gstatic.com/lobster.ttf' },
    { id: 'robotic-mono', family: 'Robotic Mono', category: 'monospace', popularity: 40, url: 'https://fonts.gstatic.com/roboticmono.ttf' },
  ],
}));

const { searchCatalog, getCatalogEntry } = await import('./catalog');

describe('searchCatalog', () => {
  it('ranks prefix matches above substring-only matches, regardless of popularity', () => {
    const results = searchCatalog('rob').map((f) => f.family);
    // "Zzz Roboto Fake" contains "rob" but doesn't start with it, and is more
    // popular (rank 1) than every prefix match — it must still sort last.
    expect(results).toEqual(['Roboto', 'Robert', 'Robotic Mono', 'Zzz Roboto Fake']);
  });

  it('tie-breaks same-bucket matches by popularity, most popular first', () => {
    const results = searchCatalog('rob').map((f) => f.family);
    const rankOf = (family: string) => results.indexOf(family);
    expect(rankOf('Roboto')).toBeLessThan(rankOf('Robert')); // popularity 2 vs 5
  });

  it('matches case-insensitively', () => {
    expect(searchCatalog('ROBOTO').map((f) => f.family)).toContain('Roboto');
  });

  it('is unfiltered by category by default, and filterable when one is given', () => {
    expect(searchCatalog('rob').map((f) => f.family)).toContain('Robotic Mono');
    expect(searchCatalog('rob', 'monospace').map((f) => f.family)).toEqual(['Robotic Mono']);
    expect(searchCatalog('rob', 'sans-serif').map((f) => f.family)).toEqual(['Roboto', 'Robert']);
  });

  it('returns the most popular entries (still unfiltered by query) when the query is empty', () => {
    const results = searchCatalog('');
    expect(results[0].family).toBe('Zzz Roboto Fake'); // popularity 1, the most popular overall
  });

  it('caps results at the given limit', () => {
    expect(searchCatalog('rob', undefined, 2)).toHaveLength(2);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchCatalog('xyznonexistent')).toEqual([]);
  });
});

describe('getCatalogEntry', () => {
  it('finds an entry by id', () => {
    expect(getCatalogEntry('roboto')?.family).toBe('Roboto');
  });

  it('returns undefined for an unknown id', () => {
    expect(getCatalogEntry('not-a-real-font')).toBeUndefined();
  });
});
