import { describe, expect, it } from 'vitest';
import { loadFont } from './loadFont';

describe('loadFont', () => {
  it('preserves the bold Dancing Script default using its on-demand font file', async () => {
    const dancingScript = await loadFont('dancing-script');
    expect(dancingScript.tables.os2.usWeightClass).toBe(700);
  });

  it('retains extended Latin characters in the suggested script fonts', async () => {
    for (const id of ['allura', 'dancing-script', 'pacifico', 'parisienne', 'sacramento']) {
      const font = await loadFont(id);
      expect(font.charToGlyphIndex('Ā'), id).toBeGreaterThan(0);
    }
  });

  it('caches a font so repeated loads return the same parsed instance', async () => {
    const a = await loadFont('pacifico');
    const b = await loadFont('pacifico');
    expect(a).toBe(b);
  });

  it('throws for an unknown font id', async () => {
    await expect(loadFont('nonexistent')).rejects.toThrow();
  });
});
