import { describe, expect, it } from 'vitest';
import { loadFont } from './loadFont';

describe('loadFont', () => {
  it('pins the registry-specified weight for a variable font instead of trusting the font default', async () => {
    const dancingScript = await loadFont('dancing-script');
    expect(dancingScript.variation.get()).toMatchObject({ wght: 700 });
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
