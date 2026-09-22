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
});
