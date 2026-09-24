import { describe, expect, it, beforeEach } from 'vitest';
import { useTopperStore } from './topperStore';

beforeEach(() => {
  useTopperStore.getState().reset();
});

describe('topperStore', () => {
  it('starts with one line and one zeroed gap per pair of adjacent letters in it', () => {
    const { lines, letterGapsMm } = useTopperStore.getState();
    expect(lines).toHaveLength(1);
    expect(letterGapsMm).toEqual([new Array(lines[0].length - 1).fill(0)]);
  });

  it('setLetterGap updates only the targeted gap of the targeted line', () => {
    useTopperStore.getState().setLetterGap(0, 1, -4);
    expect(useTopperStore.getState().letterGapsMm[0][1]).toBe(-4);
    expect(useTopperStore.getState().letterGapsMm[0][0]).toBe(0);
  });

  it('resetLetterGaps zeroes every line back out', () => {
    useTopperStore.getState().setLetterGap(0, 0, -3);
    useTopperStore.getState().setLetterGap(0, 2, 5);
    useTopperStore.getState().resetLetterGaps();
    expect(useTopperStore.getState().letterGapsMm[0].every((gap) => gap === 0)).toBe(true);
  });

  it('editing a line resets just that line\'s gaps to match the new length, discarding old overrides', () => {
    useTopperStore.getState().setLetterGap(0, 1, -4);
    useTopperStore.getState().setLineText(0, 'Theodore');
    expect(useTopperStore.getState().letterGapsMm[0]).toEqual(new Array('Theodore'.length - 1).fill(0));
  });

  it('editing a line clears only that line\'s closed-outline-hole keys', () => {
    useTopperStore.getState().addLine();
    useTopperStore.getState().toggleClosedOutlineHole('line-0-letter-1');
    useTopperStore.getState().toggleClosedOutlineHole('line-1-letter-0');
    useTopperStore.getState().setLineText(0, 'Bob');
    expect(useTopperStore.getState().closedOutlineHoles).toEqual(['line-1-letter-0']);
  });

  it('setConfig changes unrelated to lines do not touch letter gaps', () => {
    useTopperStore.getState().setLetterGap(0, 0, -2);
    useTopperStore.getState().setConfig({ sizeMm: 120 });
    expect(useTopperStore.getState().letterGapsMm[0][0]).toBe(-2);
  });

  it('shrinking the word thinner than the outline card shrinks the card down to match', () => {
    useTopperStore.getState().setConfig({ outlineDepthMm: 2 });
    useTopperStore.getState().setConfig({ extrudeDepthMm: 1 });
    expect(useTopperStore.getState().outlineDepthMm).toBe(1);
  });

  it('shrinking the word while still thicker than the outline card leaves the card alone', () => {
    useTopperStore.getState().setConfig({ outlineDepthMm: 1 });
    useTopperStore.getState().setConfig({ extrudeDepthMm: 2.5 });
    expect(useTopperStore.getState().outlineDepthMm).toBe(1);
  });

  it('addLine appends an empty line, up to a cap of 3, with matching gap/offset entries', () => {
    useTopperStore.getState().addLine();
    useTopperStore.getState().addLine();
    let state = useTopperStore.getState();
    expect(state.lines).toEqual([state.lines[0], '', '']);
    expect(state.letterGapsMm).toHaveLength(3);
    expect(state.lineOffsets).toHaveLength(3);

    useTopperStore.getState().addLine(); // already at the cap of 3
    state = useTopperStore.getState();
    expect(state.lines).toHaveLength(3);
  });

  it('removeLine drops a line and its gap/offset entries, but never below 1 line', () => {
    useTopperStore.getState().addLine();
    useTopperStore.getState().addLine();
    useTopperStore.getState().setLineOffset(1, { x: 3, y: 4 });
    useTopperStore.getState().removeLine(0);
    let state = useTopperStore.getState();
    expect(state.lines).toHaveLength(2);
    expect(state.lineOffsets).toHaveLength(2);
    // What used to be line 1's offset is now line 0's.
    expect(state.lineOffsets[0]).toEqual({ x: 3, y: 4 });

    useTopperStore.getState().removeLine(0);
    useTopperStore.getState().removeLine(0); // already down to 1 line
    state = useTopperStore.getState();
    expect(state.lines).toHaveLength(1);
  });

  it('setLineOffset updates only the targeted line', () => {
    useTopperStore.getState().addLine();
    useTopperStore.getState().setLineOffset(1, { x: 5, y: -10 });
    const state = useTopperStore.getState();
    expect(state.lineOffsets[1]).toEqual({ x: 5, y: -10 });
    expect(state.lineOffsets[0]).toEqual({ x: 0, y: 0 });
  });
});
