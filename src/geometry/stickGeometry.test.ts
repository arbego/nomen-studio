import { describe, expect, it } from 'vitest';
import { stickToGeometry } from './stickGeometry';

describe('stickToGeometry', () => {
  it('spans from below y=0 (the handle) to above y=0 (the embedded overlap)', () => {
    const geometry = stickToGeometry({ lengthMm: 70, widthMm: 4, thicknessMm: 3, embedMm: 15 });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;

    expect(bb.min.y).toBeCloseTo(-(70 - 15), 5);
    expect(bb.max.y).toBeCloseTo(15, 5);
    expect(bb.max.y - bb.min.y).toBeCloseTo(70, 5);
    expect(bb.max.x - bb.min.x).toBeCloseTo(4, 5);
    expect(bb.max.z - bb.min.z).toBeCloseTo(3, 5);
  });

  it('rejects an embed depth that would consume the whole stick', () => {
    expect(() => stickToGeometry({ lengthMm: 50, widthMm: 4, thicknessMm: 3, embedMm: 50 })).toThrow();
    expect(() => stickToGeometry({ lengthMm: 50, widthMm: 4, thicknessMm: 3, embedMm: 60 })).toThrow();
  });

  it('is non-indexed, matching the convention combine.ts relies on', () => {
    const geometry = stickToGeometry({ lengthMm: 70, widthMm: 4, thicknessMm: 3, embedMm: 15 });
    expect(geometry.index).toBeNull();
  });
});
