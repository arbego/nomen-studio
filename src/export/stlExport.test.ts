import { describe, expect, it } from 'vitest';
import { buildTopperPicks, mergedPickGeometry } from '../geometry/buildTopper';
import type { TopperConfig } from '../geometry/types';
import { pickToStlBinary, outlineToStlBinary, combinedStlBinary, slugifyFilename } from './stlExport';

const config: TopperConfig = {
  lines: ['Emma'],
  wordFontId: 'dancing-script',
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  stickOffsets: { word: [{ x: 0, y: 0 }] },
  letterGapsMm: [[0, 0, 0]],
  lineOffsets: [{ x: 0, y: 0 }],
  previewColor: '#f0c6d0',
  outlineEnabled: false,
  outlineGrowMm: 3,
  outlineColor: '#f7f5f2',
  outlineDepthMm: 1.5,
  closedOutlineHoles: [],
};

describe('STL export', () => {
  it('produces a valid binary STL per pick with a triangle count matching the merged (letters + sticks) geometry', async () => {
    const picks = await buildTopperPicks(config);
    for (const pick of picks) {
      const dv = pickToStlBinary(pick, config);
      // binary STL: 80-byte header, uint32 triangle count, then 50 bytes/triangle
      const triangleCount = dv.getUint32(80, true);
      expect(triangleCount).toBeGreaterThan(0);
      expect(dv.byteLength).toBe(84 + triangleCount * 50);

      const vertexCount = mergedPickGeometry(pick, config).getAttribute('position').count;
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
    const vertexCount = mergedPickGeometry(wordPick, multiStickConfig).getAttribute('position').count;
    expect(triangleCount).toBe(vertexCount / 3);
    expect(dv.byteLength).toBe(84 + triangleCount * 50);
  }, 30000);

  it('exports letter-gap overrides — the STL reflects the tightened layout, not the natural one', async () => {
    const picks = await buildTopperPicks(config);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const tightened: TopperConfig = { ...config, letterGapsMm: [[-5, 0, 0]] };

    const naturalDv = pickToStlBinary(wordPick, config);
    const tightenedDv = pickToStlBinary(wordPick, tightened);
    // Same letters and stick, just moved — same triangle count, different bytes.
    expect(tightenedDv.getUint32(80, true)).toBe(naturalDv.getUint32(80, true));
    expect(tightenedDv.byteLength).toBe(naturalDv.byteLength);
    expect(new Uint8Array(tightenedDv.buffer)).not.toEqual(new Uint8Array(naturalDv.buffer));
  }, 30000);

  it('returns null for the outline when it is disabled', async () => {
    const picks = await buildTopperPicks(config);
    expect(outlineToStlBinary(picks[0], config)).toBeNull();
  }, 30000);

  it('produces a valid binary STL for the outline when enabled', async () => {
    const withOutline: TopperConfig = { ...config, outlineEnabled: true };
    const picks = await buildTopperPicks(withOutline);
    const dv = outlineToStlBinary(picks[0], withOutline);
    expect(dv).not.toBeNull();
    const triangleCount = dv!.getUint32(80, true);
    expect(triangleCount).toBeGreaterThan(0);
    expect(dv!.byteLength).toBe(84 + triangleCount * 50);
  }, 30000);

  it('combines letters, sticks, and (when enabled) the outline into one STL — a single downloadable file, not a zip', async () => {
    const picks = await buildTopperPicks(config);
    const wordPick = picks[0];

    const withoutOutlineDv = combinedStlBinary(wordPick, config);
    const withoutOutlineTriangles = withoutOutlineDv.getUint32(80, true);
    const wordTriangles = pickToStlBinary(wordPick, config).getUint32(80, true);
    expect(withoutOutlineTriangles).toBe(wordTriangles);

    const withOutline: TopperConfig = { ...config, outlineEnabled: true };
    const combinedDv = combinedStlBinary(wordPick, withOutline);
    const combinedTriangles = combinedDv.getUint32(80, true);
    const outlineTriangles = outlineToStlBinary(wordPick, withOutline)!.getUint32(80, true);
    // Same plain buffer merge already used for letters+sticks — the combined
    // file's triangle count is just the sum of its parts.
    expect(combinedTriangles).toBe(wordTriangles + outlineTriangles);
    expect(combinedDv.byteLength).toBe(84 + combinedTriangles * 50);
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
