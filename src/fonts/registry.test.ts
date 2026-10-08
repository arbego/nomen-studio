import { describe, expect, it } from 'vitest';
import { FONT_REGISTRY, getFontDefinition } from './registry';
import { getCatalogEntry } from './catalog';

describe('getFontDefinition', () => {
  it('resolves a suggested font through the on-demand catalog', () => {
    const def = getFontDefinition('pacifico');
    expect(def.family).toBe('Pacifico');
    expect(def).toBe(getCatalogEntry('pacifico'));
    expect(def.url).toMatch(/^https:\/\/fonts\.gstatic\.com\//);
  });

  it('falls back to the generated catalogue when the id is not one of the curated fonts', () => {
    const def = getFontDefinition('roboto');
    expect(def.family).toBe('Roboto');
    expect(def).toBe(getCatalogEntry('roboto'));
  });

  it('throws for an id that is neither curated nor in the catalogue', () => {
    expect(() => getFontDefinition('not-a-real-font')).toThrow();
  });

  it('keeps all seven suggested fonts available with on-demand TTF URLs', () => {
    expect(FONT_REGISTRY.map((font) => font.id)).toEqual(['calistoga', 'alfa-slab-one', 'dancing-script', 'allura', 'pacifico', 'parisienne', 'sacramento']);
    for (const font of FONT_REGISTRY) {
      expect(font.url, font.id).toMatch(/^https:\/\/fonts\.gstatic\.com\/.+\.ttf$/);
      expect(font).toBe(getCatalogEntry(font.id));
    }
  });

  it('offers a display face for a big standalone letter, not only scripts', () => {
    // The name display's background initial needs a face with flat feet that
    // stands on its own; every script face in the set is wrong for that job.
    expect(FONT_REGISTRY.some((font) => font.category === 'display')).toBe(true);
    expect(FONT_REGISTRY.some((font) => font.category === 'handwriting')).toBe(true);
  });
});
