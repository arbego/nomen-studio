import { describe, expect, it } from 'vitest';
import { loadFont } from './loadFont';

describe('loadFont', () => {
  it('pins the registry-specified weight for variable fonts instead of trusting the font default', async () => {
    // Regression test: Montserrat/Quicksand's own "default instance" resolves to an
    // unexpectedly light weight (100/300) rather than Regular — verified directly
    // against the installed font files. The registry pins wght:600 for both.
    const montserrat = await loadFont('montserrat');
    expect(montserrat.variation.get()).toMatchObject({ wght: 600 });

    const quicksand = await loadFont('quicksand');
    expect(quicksand.variation.get()).toMatchObject({ wght: 600 });
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
