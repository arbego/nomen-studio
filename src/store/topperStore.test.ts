import { describe, expect, it, beforeEach } from 'vitest';
import { useTopperStore } from './topperStore';

beforeEach(() => {
  useTopperStore.getState().reset();
});

describe('topperStore', () => {
  it('starts with one zeroed gap per pair of adjacent letters in the default word', () => {
    const { word, letterGapsMm } = useTopperStore.getState();
    expect(letterGapsMm).toEqual(new Array(word.length - 1).fill(0));
  });

  it('setLetterGap updates only the targeted gap', () => {
    useTopperStore.getState().setLetterGap(1, -4);
    expect(useTopperStore.getState().letterGapsMm[1]).toBe(-4);
    expect(useTopperStore.getState().letterGapsMm[0]).toBe(0);
  });

  it('resetLetterGaps zeroes every gap back out', () => {
    useTopperStore.getState().setLetterGap(0, -3);
    useTopperStore.getState().setLetterGap(2, 5);
    useTopperStore.getState().resetLetterGaps();
    expect(useTopperStore.getState().letterGapsMm.every((gap) => gap === 0)).toBe(true);
  });

  it('editing the word resets letter gaps to match the new length, discarding old overrides', () => {
    useTopperStore.getState().setLetterGap(1, -4);
    useTopperStore.getState().setConfig({ word: 'Theodore' });
    expect(useTopperStore.getState().letterGapsMm).toEqual(new Array('Theodore'.length - 1).fill(0));
  });

  it('setConfig changes unrelated to word do not touch letter gaps', () => {
    useTopperStore.getState().setLetterGap(0, -2);
    useTopperStore.getState().setConfig({ sizeMm: 120 });
    expect(useTopperStore.getState().letterGapsMm[0]).toBe(-2);
  });
});
