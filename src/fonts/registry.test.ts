import { describe, expect, it, vi } from 'vitest';

vi.mock('./googleFontsCatalog.json', () => ({
  default: [{ id: 'roboto', family: 'Roboto', category: 'sans-serif', popularity: 2, url: 'https://fonts.gstatic.com/roboto.ttf' }],
}));

const { FONT_REGISTRY, getFontDefinition } = await import('./registry');

describe('getFontDefinition', () => {
  it('resolves a curated (self-hosted) font by id', () => {
    const def = getFontDefinition('pacifico');
    expect(def.family).toBe('Pacifico');
    expect(def.url).toContain('assets/fonts');
  });

  it('falls back to the generated catalogue when the id is not one of the curated fonts', () => {
    const def = getFontDefinition('roboto');
    expect(def.family).toBe('Roboto');
    expect(def.url).toBe('https://fonts.gstatic.com/roboto.ttf');
  });

  it('throws for an id that is neither curated nor in the catalogue', () => {
    expect(() => getFontDefinition('not-a-real-font')).toThrow();
  });

  it('every curated font is categorized as handwriting (their real Google Fonts category)', () => {
    for (const font of FONT_REGISTRY) {
      expect(font.category).toBe('handwriting');
    }
  });
});
