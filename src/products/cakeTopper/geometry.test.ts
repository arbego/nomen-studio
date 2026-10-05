import { describe, expect, it } from 'vitest';
import { buildCakeTopperBlocks, sticksForBlock, mergedBlockGeometry, stickThicknessMm } from './geometry';
import type { TextBlock } from '../../geometry/types';
import type { CakeTopperConfig } from './config';

const baseConfig: CakeTopperConfig = {
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
  decorators: [],
  decoratorPlacements: {},
  decoratorColors: {},
};

function allLetters(block: TextBlock) {
  return block.lines.flatMap((line) => line.letters);
}

function letterVertexTotal(block: TextBlock): number {
  return allLetters(block).reduce((sum, letter) => sum + letter.geometry.getAttribute('position').count, 0);
}

describe('buildCakeTopperBlocks', () => {
  it('builds a single word block, with one letter geometry per character', async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    expect(blocks.map((p) => p.id)).toEqual(['word']);
    const [wordBlock] = blocks;
    expect(allLetters(wordBlock)).toHaveLength(baseConfig.lines[0].length);
    for (const letter of allLetters(wordBlock)) {
      letter.geometry.computeBoundingBox();
      expect(letter.geometry.boundingBox).not.toBeNull();
      expect(letter.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }
  }, 30000);

  it('never includes a stick — letters alone stay bottom-anchored at y=0', async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    for (const block of blocks) {
      for (const letter of allLetters(block)) {
        letter.geometry.computeBoundingBox();
        expect(letter.geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.01);
      }
    }
  }, 30000);

  it('builds one TextBlock with one entry per line, each with its own letters', async () => {
    const config = { ...baseConfig, lines: ['Hi', 'Bye'], letterGapsMm: [[0], [0, 0]], lineOffsets: [{ x: 0, y: 0 }, { x: 0, y: -40 }] };
    const blocks = await buildCakeTopperBlocks(config);
    const [wordBlock] = blocks;
    expect(wordBlock.lines).toHaveLength(2);
    expect(wordBlock.lines[0].letters).toHaveLength(2);
    expect(wordBlock.lines[1].letters).toHaveLength(3);
  }, 30000);
});

describe('sticksForBlock / mergedBlockGeometry', () => {
  it("moves a block's stick to its configured (x, y) attach offset", async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    const wordBlock = blocks.find((p) => p.id === 'word')!;
    const config = { ...baseConfig, stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: 15, y: 5 }] } };

    const [stick] = sticksForBlock(wordBlock, config);
    stick.computeBoundingBox();
    const bb = stick.boundingBox!;
    expect((bb.min.x + bb.max.x) / 2).toBeCloseTo(15, 1);
    expect(bb.max.y).toBeCloseTo(5 + config.stickEmbedMm, 1);
  }, 30000);

  it('clamps an absurd stick offset to stay under the piece instead of floating off to the side', async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    const wordBlock = blocks.find((p) => p.id === 'word')!;
    const wordMaxX = Math.max(
      ...allLetters(wordBlock).map((letter) => {
        letter.geometry.computeBoundingBox();
        return letter.geometry.boundingBox!.max.x;
      }),
    );
    const config = { ...baseConfig, stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: 100000, y: 0 }] } };

    const [stick] = sticksForBlock(wordBlock, config);
    stick.computeBoundingBox();
    const stickBb = stick.boundingBox!;
    expect(stickBb.max.x).toBeLessThanOrEqual(wordMaxX + 0.01);
  }, 30000);

  it('merges letters and a stick into one printable solid with the combined vertex count', async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    const wordBlock = blocks.find((p) => p.id === 'word')!;
    const [stick] = sticksForBlock(wordBlock, baseConfig);
    const merged = mergedBlockGeometry(wordBlock, baseConfig);

    expect(merged.getAttribute('position').count).toBe(letterVertexTotal(wordBlock) + stick.getAttribute('position').count);
  }, 30000);

  it('keeps every stick tip in a block level with the others, even when they attach at different heights', async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    const wordBlock = blocks.find((p) => p.id === 'word')!;
    const config = {
      ...baseConfig,
      stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: -20, y: -8 }, { x: 0, y: 4 }, { x: 20, y: 12 }] },
    };

    const sticks = sticksForBlock(wordBlock, config);
    const tipYs = sticks.map((s) => {
      s.computeBoundingBox();
      return s.boundingBox!.min.y;
    });
    expect(tipYs[1]).toBeCloseTo(tipYs[0], 5);
    expect(tipYs[2]).toBeCloseTo(tipYs[0], 5);
  }, 30000);

  it('builds and merges multiple independently-positioned sticks for a single block', async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    const wordBlock = blocks.find((p) => p.id === 'word')!;
    const config = {
      ...baseConfig,
      stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: -20, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 5 }] },
    };

    const sticks = sticksForBlock(wordBlock, config);
    expect(sticks).toHaveLength(3);

    const merged = mergedBlockGeometry(wordBlock, config);
    const expectedCount = letterVertexTotal(wordBlock) + sticks.reduce((sum, s) => sum + s.getAttribute('position').count, 0);
    expect(merged.getAttribute('position').count).toBe(expectedCount);
  }, 30000);

  it('shifts a letter in the exported geometry by its configured gap override', async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    const wordBlock = blocks.find((p) => p.id === 'word')!;
    const naturalGeometry = mergedBlockGeometry(wordBlock, baseConfig);
    naturalGeometry.computeBoundingBox();
    const naturalWidth = naturalGeometry.boundingBox!.max.x - naturalGeometry.boundingBox!.min.x;

    const tightened = { ...baseConfig, letterGapsMm: [[-5, 0, 0]] };
    const tightenedGeometry = mergedBlockGeometry(wordBlock, tightened);
    tightenedGeometry.computeBoundingBox();
    const tightenedWidth = tightenedGeometry.boundingBox!.max.x - tightenedGeometry.boundingBox!.min.x;

    // Closing the first gap by 5mm pulls every letter after it left by 5mm,
    // shrinking the word's overall width by the same amount, without changing
    // vertex counts (same letters, just moved).
    expect(tightenedWidth).toBeCloseTo(naturalWidth - 5, 3);
    expect(tightenedGeometry.getAttribute('position').count).toBe(naturalGeometry.getAttribute('position').count);
  }, 30000);

  it("clamps a stick against the letters' current gap-adjusted bounds, not their natural ones", async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    const wordBlock = blocks.find((p) => p.id === 'word')!;
    const natural = { ...baseConfig, stickOffsets: { ...baseConfig.stickOffsets, word: [{ x: 100000, y: 0 }] } };
    const tightened = { ...natural, letterGapsMm: [[-5, -5, -5]] };

    const [naturalStick] = sticksForBlock(wordBlock, natural);
    const [tightenedStick] = sticksForBlock(wordBlock, tightened);
    naturalStick.computeBoundingBox();
    tightenedStick.computeBoundingBox();

    // Both clamp to the rightmost edge of the word, but that edge moved left
    // once every gap was tightened, so the clamped stick should follow it.
    expect(tightenedStick.boundingBox!.max.x).toBeLessThan(naturalStick.boundingBox!.max.x);
  }, 30000);

  it("matches the outline card's thickness when one is present, the word's own thickness otherwise", () => {
    expect(stickThicknessMm(baseConfig)).toBe(baseConfig.extrudeDepthMm);

    const withOutline = { ...baseConfig, outlineEnabled: true };
    expect(stickThicknessMm(withOutline)).toBe(withOutline.outlineDepthMm);
    expect(stickThicknessMm(withOutline)).not.toBe(withOutline.extrudeDepthMm);
  });

  it('builds a stick as thick as the outline card, not the letters, once one is enabled', async () => {
    const blocks = await buildCakeTopperBlocks(baseConfig);
    const wordBlock = blocks.find((p) => p.id === 'word')!;
    const withOutline: CakeTopperConfig = { ...baseConfig, outlineEnabled: true };

    const [stick] = sticksForBlock(wordBlock, withOutline);
    stick.computeBoundingBox();
    const thicknessMm = stick.boundingBox!.max.z - stick.boundingBox!.min.z;
    expect(thicknessMm).toBeCloseTo(withOutline.outlineDepthMm, 5);
  }, 30000);

  it("shifts a whole line's letters together via lineOffsets, independent of other lines", async () => {
    const config = { ...baseConfig, lines: ['Hi', 'Bye'], letterGapsMm: [[0], [0, 0]], lineOffsets: [{ x: 0, y: 0 }, { x: 0, y: 0 }] };
    const blocks = await buildCakeTopperBlocks(config);
    const wordBlock = blocks.find((p) => p.id === 'word')!;
    const natural = mergedBlockGeometry(wordBlock, config);
    natural.computeBoundingBox();

    // Shift line 0 (the top line) *up*, not line 1 down — the default stick
    // (lengthMm=70, embedMm=15) already extends ~55mm below the letters'
    // natural bottom, which would otherwise dominate the combined bounding
    // box's min.y and mask a downward shift of the lower line entirely.
    const shifted = { ...config, lineOffsets: [{ x: 0, y: 40 }, { x: 0, y: 0 }] };
    const shiftedGeometry = mergedBlockGeometry(wordBlock, shifted);
    shiftedGeometry.computeBoundingBox();

    // Only line 0 moved, 40mm further up, so the combined bounds' top edge
    // rises by exactly that amount while vertex count stays the same.
    expect(shiftedGeometry.boundingBox!.max.y).toBeCloseTo(natural.boundingBox!.max.y + 40, 3);
    expect(shiftedGeometry.getAttribute('position').count).toBe(natural.getAttribute('position').count);
  }, 30000);
});
