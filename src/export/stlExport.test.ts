import { describe, expect, it } from 'vitest';
import { buildTopperPicks, mergedPickGeometry } from '../geometry/buildTopper';
import type { TopperConfig } from '../geometry/types';
import { pickToStlBinary, slugifyFilename } from './stlExport';

const config: TopperConfig = {
  word: 'Emma',
  wordFontId: 'dancing-script',
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  stickOffsets: { word: [{ x: 0, y: 0 }] },
  previewColor: '#f0c6d0',
};

describe('STL export', () => {
  it('produces a valid binary STL per pick with a triangle count matching the merged (main + stick) geometry', async () => {
    const picks = await buildTopperPicks(config);
    for (const pick of picks) {
      const dv = pickToStlBinary(pick, config);
      // binary STL: 80-byte header, uint32 triangle count, then 50 bytes/triangle
      const triangleCount = dv.getUint32(80, true);
      expect(triangleCount).toBeGreaterThan(0);
      expect(dv.byteLength).toBe(84 + triangleCount * 50);

      const vertexCount = mergedPickGeometry(pick.mainGeometry, config, pick.id).getAttribute('position').count;
      expect(triangleCount).toBe(vertexCount / 3);
    }
  }, 30000);

  it('exports a pick with multiple sticks as one merged, valid STL', async () => {
    const multiStickConfig: TopperConfig = {
      ...config,
      stickOffsets: { ...config.stickOffsets, word: [{ x: -20, y: 0 }, { x: 20, y: 0 }] },
    };
    const picks = await buildTopperPicks(multiStickConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;

    const dv = pickToStlBinary(wordPick, multiStickConfig);
    const triangleCount = dv.getUint32(80, true);
    const vertexCount = mergedPickGeometry(wordPick.mainGeometry, multiStickConfig, 'word').getAttribute('position').count;
    expect(triangleCount).toBe(vertexCount / 3);
    expect(dv.byteLength).toBe(84 + triangleCount * 50);
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
