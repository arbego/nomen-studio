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

  it('is entirely self-hosted, so the curated fonts work with no network', () => {
    for (const font of FONT_REGISTRY) {
      expect(font.url, font.id).toContain('assets/fonts');
    }
  });

  it('offers a display face for a big standalone letter, not only scripts', () => {
    // The name display's background initial needs a face with flat feet that
    // stands on its own; every script face in the set is wrong for that job.
    expect(FONT_REGISTRY.some((font) => font.category === 'display')).toBe(true);
    expect(FONT_REGISTRY.some((font) => font.category === 'handwriting')).toBe(true);
  });
});
