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
  letterGapsMm: [0, 0, 0],
  previewColor: '#f0c6d0',
};

function letterVertexTotal(pick: Awaited<ReturnType<typeof buildTopperPicks>>[number]): number {
  return pick.letters.reduce((sum, letter) => sum + letter.geometry.getAttribute('position').count, 0);
}

describe('buildTopperPicks', () => {
  it('builds a single word pick, with one letter geometry per character', async () => {
    const picks = await buildTopperPicks(baseConfig);
    expect(picks.map((p) => p.id)).toEqual(['word']);
    const [wordPick] = picks;
    expect(wordPick.letters).toHaveLength(baseConfig.word.length);
    for (const letter of wordPick.letters) {
      letter.geometry.computeBoundingBox();
      expect(letter.geometry.boundingBox).not.toBeNull();
      expect(letter.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }
  }, 30000);

  it('never includes a stick — letters alone stay bottom-anchored at y=0', async () => {
    const picks = await buildTopperPicks(baseConfig);
    for (const pick of picks) {
      for (const letter of pick.letters) {
        letter.geometry.computeBoundingBox();
        expect(letter.geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.01);
      }
    }
  }, 30000);
});

describe('sticksForPick / mergedPickGeometry', () => {
  it("moves a pick's stick to its configured (x, y) attach offset", async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const config = { ...baseConfig, stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: 15, y: 5 }] } };

    const [stick] = sticksForPick(wordPick, config);
    stick.computeBoundingBox();
    const bb = stick.boundingBox!;
    expect((bb.min.x + bb.max.x) / 2).toBeCloseTo(15, 1);
    expect(bb.max.y).toBeCloseTo(5 + config.stickEmbedMm, 1);
  }, 30000);

  it('clamps an absurd stick offset to stay under the piece instead of floating off to the side', async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const wordMaxX = Math.max(
      ...wordPick.letters.map((letter) => {
        letter.geometry.computeBoundingBox();
        return letter.geometry.boundingBox!.max.x;
      }),
    );
    const config = { ...baseConfig, stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: 100000, y: 0 }] } };

    const [stick] = sticksForPick(wordPick, config);
    stick.computeBoundingBox();
    const stickBb = stick.boundingBox!;
    expect(stickBb.max.x).toBeLessThanOrEqual(wordMaxX + 0.01);
  }, 30000);

  it('merges letters and a stick into one printable solid with the combined vertex count', async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const [stick] = sticksForPick(wordPick, baseConfig);
    const merged = mergedPickGeometry(wordPick, baseConfig);

    expect(merged.getAttribute('position').count).toBe(letterVertexTotal(wordPick) + stick.getAttribute('position').count);
  }, 30000);

  it('keeps every stick tip in a pick level with the others, even when they attach at different heights', async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const config = {
      ...baseConfig,
      stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: -20, y: -8 }, { x: 0, y: 4 }, { x: 20, y: 12 }] },
    };

    const sticks = sticksForPick(wordPick, config);
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

    const sticks = sticksForPick(wordPick, config);
    expect(sticks).toHaveLength(3);

    const merged = mergedPickGeometry(wordPick, config);
    const expectedCount = letterVertexTotal(wordPick) + sticks.reduce((sum, s) => sum + s.getAttribute('position').count, 0);
    expect(merged.getAttribute('position').count).toBe(expectedCount);
  }, 30000);

  it('shifts a letter in the exported geometry by its configured gap override', async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const naturalGeometry = mergedPickGeometry(wordPick, baseConfig);
    naturalGeometry.computeBoundingBox();
    const naturalWidth = naturalGeometry.boundingBox!.max.x - naturalGeometry.boundingBox!.min.x;

    const tightened = { ...baseConfig, letterGapsMm: [-5, 0, 0] };
    const tightenedGeometry = mergedPickGeometry(wordPick, tightened);
    tightenedGeometry.computeBoundingBox();
    const tightenedWidth = tightenedGeometry.boundingBox!.max.x - tightenedGeometry.boundingBox!.min.x;

    // Closing the first gap by 5mm pulls every letter after it left by 5mm,
    // shrinking the word's overall width by the same amount, without changing
    // vertex counts (same letters, just moved).
    expect(tightenedWidth).toBeCloseTo(naturalWidth - 5, 3);
    expect(tightenedGeometry.getAttribute('position').count).toBe(naturalGeometry.getAttribute('position').count);
  }, 30000);

  it("clamps a stick against the letters' current gap-adjusted bounds, not their natural ones", async () => {
    const picks = await buildTopperPicks(baseConfig);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const natural = { ...baseConfig, stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: 100000, y: 0 }] } };
    const tightened = { ...natural, letterGapsMm: [-5, -5, -5] };

    const [naturalStick] = sticksForPick(wordPick, natural);
    const [tightenedStick] = sticksForPick(wordPick, tightened);
    naturalStick.computeBoundingBox();
    tightenedStick.computeBoundingBox();

    // Both clamp to the rightmost edge of the word, but that edge moved left
    // once every gap was tightened, so the clamped stick should follow it.
    expect(tightenedStick.boundingBox!.max.x).toBeLessThan(naturalStick.boundingBox!.max.x);
  }, 30000);
});
