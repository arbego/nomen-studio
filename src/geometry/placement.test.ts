import { describe, expect, it } from 'vitest';
import { degToRad, placePoint, rotateOffset } from './placement';

describe('rotateOffset', () => {
  it('turns counter-clockwise', () => {
    const r = rotateOffset({ x: 10, y: 0 }, degToRad(90));
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(10, 6);
  });

  it('returns the offset untouched at zero', () => {
    const offset = { x: 3, y: -7 };
    expect(rotateOffset(offset, 0)).toBe(offset);
  });

  it('is undone by the opposite rotation — the round trip a drag in a rotated frame relies on', () => {
    const there = rotateOffset({ x: 12, y: -5 }, degToRad(20));
    const back = rotateOffset(there, degToRad(-20));
    expect(back.x).toBeCloseTo(12, 6);
    expect(back.y).toBeCloseTo(-5, 6);
  });
});

describe('placePoint', () => {
  it('leaves the pivot itself fixed, whatever the angle', () => {
    const pivot = { x: 25, y: 40 };
    const placed = placePoint(pivot.x, pivot.y, { pivot, rotationRad: degToRad(33) });
    expect(placed.x).toBeCloseTo(pivot.x, 6);
    expect(placed.y).toBeCloseTo(pivot.y, 6);
  });

  it('applies the translation after the rotation', () => {
    const placed = placePoint(10, 0, { rotationRad: degToRad(90), translate: { x: 5, y: 5 } });
    expect(placed.x).toBeCloseTo(5, 6);
    expect(placed.y).toBeCloseTo(15, 6);
  });

  it('applies preTranslate before the rotation, so a gap shift tilts with the block', () => {
    // A letter nudged 10mm along a block tilted 90° should end up 10mm *up*,
    // not 10mm to the right.
    const placed = placePoint(0, 0, { preTranslate: { x: 10, y: 0 }, rotationRad: degToRad(90) });
    expect(placed.x).toBeCloseTo(0, 6);
    expect(placed.y).toBeCloseTo(10, 6);
  });

  it('is a plain shift when there is no rotation', () => {
    const placed = placePoint(3, 4, { translate: { x: 100, y: -50 }, pivot: { x: 7, y: 7 } });
    expect(placed.x).toBeCloseTo(103, 6);
    expect(placed.y).toBeCloseTo(-46, 6);
  });
});
