import { describe, expect, it } from 'vitest';
import { buildTopperPicks } from '../geometry/buildTopper';
import type { TopperConfig } from '../geometry/types';
import { pickToStlBinary, picksToCombinedStlBinary, slugifyFilename } from './stlExport';

const config: TopperConfig = {
  word: 'Emma',
  wordFontId: 'dancing-script',
  number: '6',
  numberFontId: 'quicksand',
  accentShapeId: 'heart',
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  previewColor: '#f0c6d0',
};

describe('STL export', () => {
  it('produces a valid binary STL per pick with a triangle count matching the geometry', async () => {
    const picks = await buildTopperPicks(config);
    for (const pick of picks) {
      const dv = pickToStlBinary(pick);
      // binary STL: 80-byte header, uint32 triangle count, then 50 bytes/triangle
      const triangleCount = dv.getUint32(80, true);
      expect(triangleCount).toBeGreaterThan(0);
      expect(dv.byteLength).toBe(84 + triangleCount * 50);

      const vertexCount = pick.geometry.getAttribute('position').count;
      expect(triangleCount).toBe(vertexCount / 3);
    }
  }, 30000);

  it('combines all picks into one STL with a triangle count equal to the sum of the parts', async () => {
    const picks = await buildTopperPicks(config);
    const combined = picksToCombinedStlBinary(picks);
    const triangleCount = combined.getUint32(80, true);

    const expectedTotal = picks.reduce((sum, p) => sum + p.geometry.getAttribute('position').count / 3, 0);
    expect(triangleCount).toBe(expectedTotal);
  }, 30000);
});

describe('slugifyFilename', () => {
  it('lowercases, strips accents/punctuation, and hyphenates', () => {
    expect(slugifyFilename('Emma-6')).toBe('emma-6');
    expect(slugifyFilename('  Théo!! ')).toBe('th-o');
  });

  it('falls back to "topper" for an empty/unusable name', () => {
    expect(slugifyFilename('')).toBe('topper');
    expect(slugifyFilename('!!!')).toBe('topper');
  });
});
