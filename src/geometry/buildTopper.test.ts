import { describe, expect, it } from 'vitest';
import { buildTopperPicks } from './buildTopper';
import type { TopperConfig } from './types';

const baseConfig: TopperConfig = {
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
  stickOffsets: { word: 0, number: 0, accent: 0 },
  previewColor: '#f0c6d0',
};

describe('buildTopperPicks', () => {
  it('builds a word pick, number pick, and accent pick when an accent is set', async () => {
    const picks = await buildTopperPicks(baseConfig);
    expect(picks.map((p) => p.id)).toEqual(['word', 'number', 'accent']);
    for (const pick of picks) {
      pick.geometry.computeBoundingBox();
      expect(pick.geometry.boundingBox).not.toBeNull();
      expect(pick.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }
  }, 30000);

  it('omits the accent pick when accentShapeId is null', async () => {
    const picks = await buildTopperPicks({ ...baseConfig, accentShapeId: null });
    expect(picks.map((p) => p.id)).toEqual(['word', 'number']);
  }, 30000);

  it("moves a pick's stick to the requested x offset", async () => {
    const picks = await buildTopperPicks({ ...baseConfig, stickOffsets: { word: 15, number: 0, accent: 0 } });
    const wordPick = picks.find((p) => p.id === 'word')!;

    // Below y=0 only the stick exists (the letters start at y=0 and go up), so
    // the bottom tip's x tells us where the stick actually ended up.
    const tipY = -(baseConfig.stickLengthMm - baseConfig.stickEmbedMm);
    const position = wordPick.geometry.getAttribute('position');
    let tipX: number | null = null;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getY(i) - tipY) < 0.05) {
        tipX = position.getX(i);
        break;
      }
    }
    expect(tipX).not.toBeNull();
    expect(tipX).toBeCloseTo(15, 0);
  }, 30000);

  it('clamps an absurd stick offset to stay under the piece instead of floating off to the side', async () => {
    const picks = await buildTopperPicks({ ...baseConfig, stickOffsets: { word: 100000, number: 0, accent: 0 } });
    const wordPick = picks.find((p) => p.id === 'word')!;
    wordPick.geometry.computeBoundingBox();
    const bb = wordPick.geometry.boundingBox!;

    const tipY = -(baseConfig.stickLengthMm - baseConfig.stickEmbedMm);
    const position = wordPick.geometry.getAttribute('position');
    let tipX = -Infinity;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getY(i) - tipY) < 0.05) {
        tipX = Math.max(tipX, position.getX(i));
      }
    }
    // the clamped stick must still sit within the word's own footprint
    expect(tipX).toBeLessThanOrEqual(bb.max.x + 0.01);
  }, 30000);
});
