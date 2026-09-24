import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  cumulativeGaps,
  letterPositionsMm,
  gapForDesiredPosition,
  clampDesiredLetterPosition,
  normalizedLetterGaps,
  combinedLetterBounds,
  combinedPickBounds,
} from './letterLayout';
import type { LetterGeometry, Pick } from './types';

describe('cumulativeGaps', () => {
  it('starts at 0 and accumulates each gap in order', () => {
    expect(cumulativeGaps([2, -1, 3])).toEqual([0, 2, 1, 4]);
  });

  it('is just [0] for a single letter (no gaps)', () => {
    expect(cumulativeGaps([])).toEqual([0]);
  });
});

describe('letterPositionsMm', () => {
  it('adds each letter natural x to the cumulative gap sum before it', () => {
    expect(letterPositionsMm([0, 10, 20, 30], [0, 0, 0])).toEqual([0, 10, 20, 30]);
    expect(letterPositionsMm([0, 10, 20, 30], [-3, 0, 2])).toEqual([0, 7, 17, 29]);
  });
});

describe('gapForDesiredPosition', () => {
  it('solves for the gap that puts the letter exactly at the desired x, with no prior overrides', () => {
    const naturalXsMm = [0, 10, 20, 30];
    const gaps = [0, 0, 0];
    expect(gapForDesiredPosition(1, 7, naturalXsMm, gaps)).toBeCloseTo(-3, 10);
  });

  it('accounts for the cumulative effect of gaps before the one being solved', () => {
    const naturalXsMm = [0, 10, 20, 30];
    const gaps = [-3, 0, 0]; // letter 1 already pulled in by 3mm
    // Letter 2's natural x is 20; with gap[0]=-3 already applied, letter 1 sits
    // at 7. Dragging letter 2 to x=15 means gap[1] alone must supply the rest.
    const gap1 = gapForDesiredPosition(2, 15, naturalXsMm, gaps);
    expect(letterPositionsMm(naturalXsMm, [gaps[0], gap1, gaps[2]])[2]).toBeCloseTo(15, 10);
  });

  it('round-trips through letterPositionsMm for an arbitrary gap array', () => {
    const naturalXsMm = [0, 12, 19, 33, 40];
    const gaps = [1.5, -2, 0.25, 4];
    const positions = letterPositionsMm(naturalXsMm, gaps);
    // Re-deriving gap[2] from its resulting position should reproduce it.
    const rederived = gapForDesiredPosition(3, positions[3], naturalXsMm, gaps);
    expect(rederived).toBeCloseTo(gaps[2], 10);
  });
});

describe('clampDesiredLetterPosition', () => {
  it('passes a desired position through unchanged when it does not cross the left neighbor', () => {
    const naturalXsMm = [0, 10, 20];
    const gaps = [0, 0];
    expect(clampDesiredLetterPosition(1, 8, naturalXsMm, gaps)).toBe(8);
  });

  it('clamps a desired position that would cross or collapse onto the left (non-moving) neighbor', () => {
    const naturalXsMm = [0, 10, 20];
    const gaps = [0, 0];
    const clamped = clampDesiredLetterPosition(1, -5, naturalXsMm, gaps);
    expect(clamped).toBeGreaterThan(naturalXsMm[0]); // letter 0's position
    expect(clamped).toBeLessThan(10); // still less than the unclamped desired value's neighborhood sanity check
  });
});

describe('normalizedLetterGaps', () => {
  it('passes an already-correctly-sized array through unchanged', () => {
    const gaps = [1, 2, 3];
    expect(normalizedLetterGaps(4, gaps)).toBe(gaps);
  });

  it('pads a too-short array with zeros', () => {
    expect(normalizedLetterGaps(4, [5])).toEqual([5, 0, 0]);
  });

  it('truncates a too-long array', () => {
    expect(normalizedLetterGaps(2, [5, 6, 7, 8])).toEqual([5]);
  });

  it('is empty for a single letter', () => {
    expect(normalizedLetterGaps(1, [1, 2])).toEqual([]);
  });
});

function fakeLetter(minX: number, maxX: number, minY: number, maxY: number): LetterGeometry {
  const geometry = new THREE.BoxGeometry(maxX - minX, maxY - minY, 3);
  geometry.translate((minX + maxX) / 2, (minY + maxY) / 2, 0);
  return { char: '?', geometry, naturalXMm: minX, outlineContours: [] };
}

describe('combinedLetterBounds', () => {
  it('unions every letter bounding box at its natural position when there are no gap overrides', () => {
    const letters = [fakeLetter(0, 10, 0, 20), fakeLetter(15, 25, 0, 20)];
    const bounds = combinedLetterBounds(letters, [0]);
    expect(bounds.min.x).toBeCloseTo(0, 5);
    expect(bounds.max.x).toBeCloseTo(25, 5);
  });

  it('shifts letters after a closed gap when computing the combined bounds', () => {
    const letters = [fakeLetter(0, 10, 0, 20), fakeLetter(15, 25, 0, 20)];
    const bounds = combinedLetterBounds(letters, [-5]);
    expect(bounds.max.x).toBeCloseTo(20, 5); // second letter pulled in by 5mm
  });
});

describe('combinedPickBounds', () => {
  it('unions every line\'s own combined bounds, each shifted by that line\'s offset', () => {
    const pick: Pick = {
      id: 'word',
      label: 'test',
      lines: [{ letters: [fakeLetter(0, 10, 0, 20)] }, { letters: [fakeLetter(0, 10, 0, 20)] }],
    };
    // Line 0 stays put; line 1 is shifted 30mm right and 40mm down.
    const bounds = combinedPickBounds(pick, [[], []], [{ x: 0, y: 0 }, { x: 30, y: -40 }]);
    expect(bounds.min.x).toBeCloseTo(0, 5);
    expect(bounds.max.x).toBeCloseTo(40, 5); // line 1's right edge (10) + 30
    expect(bounds.min.y).toBeCloseTo(-40, 5); // line 1's bottom (0) - 40
    expect(bounds.max.y).toBeCloseTo(20, 5); // line 0's top, untouched
  });
});
