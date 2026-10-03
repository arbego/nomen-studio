import { describe, expect, it, beforeEach } from 'vitest';
import { useCakeTopperStore } from './store';

beforeEach(() => {
  useCakeTopperStore.getState().reset();
});

describe('topperStore', () => {
  it('starts with one line and one zeroed gap per pair of adjacent letters in it', () => {
    const { lines, letterGapsMm } = useCakeTopperStore.getState();
    expect(lines).toHaveLength(1);
    expect(letterGapsMm).toEqual([new Array(lines[0].length - 1).fill(0)]);
  });

  it('setLetterGap updates only the targeted gap of the targeted line', () => {
    useCakeTopperStore.getState().setLetterGap(0, 1, -4);
    expect(useCakeTopperStore.getState().letterGapsMm[0][1]).toBe(-4);
    expect(useCakeTopperStore.getState().letterGapsMm[0][0]).toBe(0);
  });

  it('resetLetterGaps zeroes every line back out', () => {
    useCakeTopperStore.getState().setLetterGap(0, 0, -3);
    useCakeTopperStore.getState().setLetterGap(0, 2, 5);
    useCakeTopperStore.getState().resetLetterGaps();
    expect(useCakeTopperStore.getState().letterGapsMm[0].every((gap) => gap === 0)).toBe(true);
  });

  it('editing a line resets just that line\'s gaps to match the new length, discarding old overrides', () => {
    useCakeTopperStore.getState().setLetterGap(0, 1, -4);
    useCakeTopperStore.getState().setLineText(0, 'Theodore');
    expect(useCakeTopperStore.getState().letterGapsMm[0]).toEqual(new Array('Theodore'.length - 1).fill(0));
  });

  it('editing a line clears only that line\'s closed-outline-hole keys', () => {
    useCakeTopperStore.getState().addLine();
    useCakeTopperStore.getState().toggleClosedOutlineHole('line-0-letter-1');
    useCakeTopperStore.getState().toggleClosedOutlineHole('line-1-letter-0');
    useCakeTopperStore.getState().setLineText(0, 'Bob');
    expect(useCakeTopperStore.getState().closedOutlineHoles).toEqual(['line-1-letter-0']);
  });

  it('setConfig changes unrelated to lines do not touch letter gaps', () => {
    useCakeTopperStore.getState().setLetterGap(0, 0, -2);
    useCakeTopperStore.getState().setConfig({ sizeMm: 120 });
    expect(useCakeTopperStore.getState().letterGapsMm[0][0]).toBe(-2);
  });

  it('shrinking the word thinner than the outline card shrinks the card down to match', () => {
    useCakeTopperStore.getState().setConfig({ outlineDepthMm: 2 });
    useCakeTopperStore.getState().setConfig({ extrudeDepthMm: 1 });
    expect(useCakeTopperStore.getState().outlineDepthMm).toBe(1);
  });

  it('shrinking the word while still thicker than the outline card leaves the card alone', () => {
    useCakeTopperStore.getState().setConfig({ outlineDepthMm: 1 });
    useCakeTopperStore.getState().setConfig({ extrudeDepthMm: 2.5 });
    expect(useCakeTopperStore.getState().outlineDepthMm).toBe(1);
  });

  it('addLine appends an empty line, up to a cap of 3, with matching gap/offset entries', () => {
    useCakeTopperStore.getState().addLine();
    useCakeTopperStore.getState().addLine();
    let state = useCakeTopperStore.getState();
    expect(state.lines).toEqual([state.lines[0], '', '']);
    expect(state.letterGapsMm).toHaveLength(3);
    expect(state.lineOffsets).toHaveLength(3);

    useCakeTopperStore.getState().addLine(); // already at the cap of 3
    state = useCakeTopperStore.getState();
    expect(state.lines).toHaveLength(3);
  });

  it('removeLine drops a line and its gap/offset entries, but never below 1 line', () => {
    useCakeTopperStore.getState().addLine();
    useCakeTopperStore.getState().addLine();
    useCakeTopperStore.getState().setLineOffset(1, { x: 3, y: 4 });
    useCakeTopperStore.getState().removeLine(0);
    let state = useCakeTopperStore.getState();
    expect(state.lines).toHaveLength(2);
    expect(state.lineOffsets).toHaveLength(2);
    // What used to be line 1's offset is now line 0's.
    expect(state.lineOffsets[0]).toEqual({ x: 3, y: 4 });

    useCakeTopperStore.getState().removeLine(0);
    useCakeTopperStore.getState().removeLine(0); // already down to 1 line
    state = useCakeTopperStore.getState();
    expect(state.lines).toHaveLength(1);
  });

  it('setLineOffset updates only the targeted line', () => {
    useCakeTopperStore.getState().addLine();
    useCakeTopperStore.getState().setLineOffset(1, { x: 5, y: -10 });
    const state = useCakeTopperStore.getState();
    expect(state.lineOffsets[1]).toEqual({ x: 5, y: -10 });
    expect(state.lineOffsets[0]).toEqual({ x: 0, y: 0 });
  });
});
