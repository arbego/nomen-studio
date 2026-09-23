import { describe, expect, it } from 'vitest';
import { buildTopperPicks, sticksForPick, mergedPickGeometry } from './buildTopper';
import type { TopperConfig } from './types';

const baseConfig: TopperConfig = {
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

describe('buildTopperPicks', () => {
  it('builds a single word pick', async () => {
    const picks = await buildTopperPicks(baseConfig);
    expect(picks.map((p) => p.id)).toEqual(['word']);
    for (const pick of picks) {
      pick.mainGeometry.computeBoundingBox();
      expect(pick.mainGeometry.boundingBox).not.toBeNull();
      expect(pick.mainGeometry.getAttribute('position').count).toBeGreaterThan(0);
    }
  }, 30000);

  it('never includes a stick — main geometry alone stays bottom-anchored at y=0', async () => {
    const picks = await buildTopperPicks(baseConfig);
    for (const pick of picks) {
      pick.mainGeometry.computeBoundingBox();
      expect(pick.mainGeometry.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.01);
    }
  }, 30000);
});

describe('sticksForPick / mergedPickGeometry', () => {
  it("moves a pick's stick to its configured (x, y) attach offset", async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const config = { ...baseConfig, stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: 15, y: 5 }] } };

    const [stick] = sticksForPick(wordPick.mainGeometry, config, 'word');
    stick.computeBoundingBox();
    const bb = stick.boundingBox!;
    expect((bb.min.x + bb.max.x) / 2).toBeCloseTo(15, 1);
    expect(bb.max.y).toBeCloseTo(5 + config.stickEmbedMm, 1);
  }, 30000);

  it('clamps an absurd stick offset to stay under the piece instead of floating off to the side', async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    wordPick.mainGeometry.computeBoundingBox();
    const mainBb = wordPick.mainGeometry.boundingBox!;
    const config = { ...baseConfig, stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: 100000, y: 0 }] } };

    const [stick] = sticksForPick(wordPick.mainGeometry, config, 'word');
    stick.computeBoundingBox();
    const stickBb = stick.boundingBox!;
    expect(stickBb.max.x).toBeLessThanOrEqual(mainBb.max.x + 0.01);
  }, 30000);

  it('merges main geometry and its stick into one printable solid with more vertices than either alone', async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const [stick] = sticksForPick(wordPick.mainGeometry, baseConfig, 'word');
    const merged = mergedPickGeometry(wordPick.mainGeometry, baseConfig, 'word');

    const mainCount = wordPick.mainGeometry.getAttribute('position').count;
    const stickCount = stick.getAttribute('position').count;
    expect(merged.getAttribute('position').count).toBe(mainCount + stickCount);
  }, 30000);

  it('keeps every stick tip in a pick level with the others, even when they attach at different heights', async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const config = {
      ...baseConfig,
      stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: -20, y: -8 }, { x: 0, y: 4 }, { x: 20, y: 12 }] },
    };

    const sticks = sticksForPick(wordPick.mainGeometry, config, 'word');
    const tipYs = sticks.map((s) => {
      s.computeBoundingBox();
      return s.boundingBox!.min.y;
    });
    expect(tipYs[1]).toBeCloseTo(tipYs[0], 5);
    expect(tipYs[2]).toBeCloseTo(tipYs[0], 5);
  }, 30000);

  it('builds and merges multiple independently-positioned sticks for a single pick', async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const config = {
      ...baseConfig,
      stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: -20, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 5 }] },
    };

    const sticks = sticksForPick(wordPick.mainGeometry, config, 'word');
    expect(sticks).toHaveLength(3);

    const merged = mergedPickGeometry(wordPick.mainGeometry, config, 'word');
    const expectedCount =
      wordPick.mainGeometry.getAttribute('position').count + sticks.reduce((sum, s) => sum + s.getAttribute('position').count, 0);
    expect(merged.getAttribute('position').count).toBe(expectedCount);
  }, 30000);
});
