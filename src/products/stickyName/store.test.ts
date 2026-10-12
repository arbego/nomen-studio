import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MAGNET, DEFAULT_STICKY_NAME_CONFIG as DEFAULT } from './config';
import { parseStickyNameConfig } from './parseConfig';
import { stickyNameProjectIO } from './project';
import { selectStickyNameConfig, stickyNameHistory, useStickyNameStore } from './store';

beforeEach(() => { useStickyNameStore.getState().reset(); stickyNameHistory.clear(); });

describe('Sticky Name designs', () => {
  it('round-trips all settings, including independent repeated letters and explicit positions', () => {
    const config = { ...DEFAULT, name: 'AA', depthMm: 16, bubble: { inflation: 0.5, roundnessMm: 2 },
      magnets: [[{ ...DEFAULT_MAGNET, position: { x: 8, y: 12 } }], [{ ...DEFAULT_MAGNET, diameterMm: 4, heightMm: 2 }]] };
    stickyNameProjectIO.load(JSON.parse(JSON.stringify(config)));
    expect(stickyNameProjectIO.snapshot().design).toEqual(config);
    const s = useStickyNameStore.getState();
    s.updateMagnet(0, 0, { diameterMm: 8 });
    expect(useStickyNameStore.getState().magnets[1][0].diameterMm).toBe(4);
    stickyNameHistory.undo();
    expect(stickyNameProjectIO.snapshot().design).toEqual(config);
    stickyNameHistory.redo();
    expect(useStickyNameStore.getState().magnets[0][0].diameterMm).toBe(8);
  });

  it('resets assignments on text edits and only auto-positions on font/scale edits, undoably', () => {
    const s = useStickyNameStore.getState();
    s.setMagnetCount(0, 2);
    s.updateMagnet(0, 0, { position: { x: 10, y: 10 }, diameterMm: 8 });
    const before = selectStickyNameConfig(useStickyNameStore.getState());
    s.setConfig({ fontId: 'lilita-one' });
    expect(useStickyNameStore.getState().magnets[0][0]).toEqual({ ...before.magnets[0][0], position: null });
    stickyNameHistory.undo();
    expect(selectStickyNameConfig(useStickyNameStore.getState())).toEqual(before);
    s.setConfig({ name: 'A😀 B' });
    expect(useStickyNameStore.getState().magnets).toEqual([[], [], [], []]);
    s.setMagnetCount(2, 5);
    expect(useStickyNameStore.getState().magnets[2]).toEqual([]);
    stickyNameHistory.undo();
    expect(selectStickyNameConfig(useStickyNameStore.getState())).toEqual(before);
  });

  it('bounds malformed data, unknown fonts/themes, nonfinite values and array sizes', () => {
    const parsed = parseStickyNameConfig({ name: 'X'.repeat(50), fontId: 'absent', theme: 'cheese', depthMm: Infinity,
      letterHeightMm: -12, previewColor: 'red', magnets: [Array(100).fill({ diameterMm: NaN, thicknessMm: -1 })] });
    expect(parsed.name).toHaveLength(20);
    expect(parsed.magnets).toHaveLength(20);
    expect(parsed.magnets[0]).toHaveLength(6);
    expect(parsed.magnets[0][0].diameterMm).toBe(6);
    expect(parsed.magnets[0][0].thicknessMm).toBe(0.5);
    expect(parsed.fontId).toBe(DEFAULT.fontId);
    expect(parsed.theme).toBe('bubble');
    expect(parsed.depthMm).toBe(DEFAULT.depthMm);
    expect(parsed.letterHeightMm).toBe(20);
    expect(parseStickyNameConfig(null)).toEqual(DEFAULT);
  });
});
