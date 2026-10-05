import { describe, expect, it, beforeEach } from 'vitest';
import { selectCakeTopperConfig, useCakeTopperStore } from './store';

beforeEach(() => {
  useCakeTopperStore.getState().reset();
});

/**
 * A reset design cut back to a single line.
 *
 * The studio opens on a three-line one (see store.ts), which is right for
 * someone arriving at it and wrong for a test about what adding a line does —
 * that design is already at the cap.
 */
function resetToOneLine() {
  useCakeTopperStore.getState().reset();
  while (useCakeTopperStore.getState().lines.length > 1) {
    useCakeTopperStore.getState().removeLine(useCakeTopperStore.getState().lines.length - 1);
  }
}

describe('topperStore', () => {
  it('starts with one gap slot per pair of adjacent letters in every line', () => {
    const { lines, letterGapsMm } = useCakeTopperStore.getState();
    expect(letterGapsMm).toHaveLength(lines.length);
    lines.forEach((line, i) => {
      expect(letterGapsMm[i], line).toHaveLength(Math.max(line.length - 1, 0));
    });
  });

  it('setLetterGap updates only the targeted gap of the targeted line', () => {
    // Read rather than assumed to be zero: the design the studio opens on has
    // a letter pair already tightened.
    const untouched = useCakeTopperStore.getState().letterGapsMm[0][0];
    useCakeTopperStore.getState().setLetterGap(0, 1, -4);
    expect(useCakeTopperStore.getState().letterGapsMm[0][1]).toBe(-4);
    expect(useCakeTopperStore.getState().letterGapsMm[0][0]).toBe(untouched);
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
    resetToOneLine();
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
    resetToOneLine();
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

  it('fills a whole set of counter holes in at once, and opens them again', () => {
    const keys = ['line-0-letter-1-hole-0', 'line-0-letter-2-hole-0'];
    useCakeTopperStore.getState().setClosedOutlineHoles(keys, true);
    expect(useCakeTopperStore.getState().closedOutlineHoles).toEqual(keys);

    useCakeTopperStore.getState().setClosedOutlineHoles(keys, false);
    expect(useCakeTopperStore.getState().closedOutlineHoles).toEqual([]);
  });

  it('leaves a closed hole the checklist cannot currently see alone', () => {
    // Holes come and go with the grow, and one that is not on screen is not
    // one the user just said anything about by pressing "fill all in".
    useCakeTopperStore.getState().toggleClosedOutlineHole('line-2-letter-0-hole-0');
    useCakeTopperStore.getState().setClosedOutlineHoles(['line-0-letter-1-hole-0'], true);
    expect(useCakeTopperStore.getState().closedOutlineHoles).toContain('line-2-letter-0-hole-0');

    useCakeTopperStore.getState().setClosedOutlineHoles(['line-0-letter-1-hole-0'], false);
    expect(useCakeTopperStore.getState().closedOutlineHoles).toEqual(['line-2-letter-0-hole-0']);
  });

  it('setLineOffset updates only the targeted line', () => {
    resetToOneLine();
    // Read rather than assumed to be the origin: the design the studio opens
    // on has every line dragged into place.
    const untouched = useCakeTopperStore.getState().lineOffsets[0];
    useCakeTopperStore.getState().addLine();
    useCakeTopperStore.getState().setLineOffset(1, { x: 5, y: -10 });
    const state = useCakeTopperStore.getState();
    expect(state.lineOffsets[1]).toEqual({ x: 5, y: -10 });
    expect(state.lineOffsets[0]).toEqual(untouched);
  });
});

describe('topper ornaments', () => {
  it('adds one with an icon, a size and a place to stand', () => {
    const id = useCakeTopperStore.getState().addDecorator('star');
    const { decorators, decoratorPlacements, decoratorColors } = useCakeTopperStore.getState();

    expect(decorators).toHaveLength(1);
    // Handed back so the picker that added it can go on changing that same one
    // rather than adding a second with the next click.
    expect(id).toBe(decorators[0].id);
    expect(decorators[0].iconName).toBe('star');
    expect(decorators[0].widthMm).toBeGreaterThan(0);
    expect(decoratorPlacements[id].angleDeg).toBe(0);
    // In the lettering's filament to begin with, set explicitly so the colour
    // picker opens showing which swatch is in use.
    expect(decoratorColors[id]).toBe(useCakeTopperStore.getState().previewColor);
  });

  it('puts a second one somewhere other than exactly on top of the first', () => {
    const first = useCakeTopperStore.getState().addDecorator('star');
    const second = useCakeTopperStore.getState().addDecorator('favorite');
    const { decoratorPlacements } = useCakeTopperStore.getState();
    expect(decoratorPlacements[first].offset).not.toEqual(decoratorPlacements[second].offset);
  });

  it('takes the placement and the colour away with the ornament', () => {
    const id = useCakeTopperStore.getState().addDecorator('star');
    useCakeTopperStore.getState().removeDecorator(id);

    const state = useCakeTopperStore.getState();
    expect(state.decorators).toHaveLength(0);
    expect(state.decoratorPlacements[id]).toBeUndefined();
    expect(state.decoratorColors[id]).toBeUndefined();
  });

  it('edits, turns and recolours one without touching the others', () => {
    const first = useCakeTopperStore.getState().addDecorator('star');
    const second = useCakeTopperStore.getState().addDecorator('favorite');
    const before = useCakeTopperStore.getState().decorators[0];

    useCakeTopperStore.getState().updateDecorator(second, { widthMm: 60, iconName: 'pets' });
    useCakeTopperStore.getState().setDecoratorAngle(second, -30);
    useCakeTopperStore.getState().setDecoratorColor(second, '#b7c4ac');

    const state = useCakeTopperStore.getState();
    expect(state.decorators[0]).toEqual(before);
    expect(state.decorators[1].widthMm).toBe(60);
    expect(state.decorators[1].iconName).toBe('pets');
    expect(state.decoratorPlacements[second].angleDeg).toBe(-30);
    expect(state.decoratorColors[second]).toBe('#b7c4ac');
    expect(state.decoratorColors[first]).not.toBe('#b7c4ac');
  });

  it('does not hand a newly added ornament an id a loaded one is already using', () => {
    // Loading restores ids like `decorator-2`; a session counter starting from
    // zero would hand the same id out again, and the two would share a
    // placement and a colour.
    const loaded = { ...useCakeTopperStore.getState().decorators };
    useCakeTopperStore.getState().loadConfig({
      ...selectCakeTopperConfig(useCakeTopperStore.getState()),
      decorators: [{ id: 'decorator-7', iconName: 'star', widthMm: 25, depthMm: 3 }],
      decoratorPlacements: { 'decorator-7': { offset: { x: 1, y: 2 }, angleDeg: 0 } },
      decoratorColors: {},
    });
    void loaded;

    const added = useCakeTopperStore.getState().addDecorator('favorite');
    expect(added).not.toBe('decorator-7');
    expect(useCakeTopperStore.getState().decoratorPlacements['decorator-7']).toEqual({ offset: { x: 1, y: 2 }, angleDeg: 0 });
  });
});
