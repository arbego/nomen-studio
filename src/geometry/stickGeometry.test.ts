import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { stickToGeometry, clampStickOffsetToBounds } from './stickGeometry';

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

  it('rejects a non-positive width', () => {
    expect(() => stickToGeometry({ lengthMm: 50, widthMm: 0, thicknessMm: 3, embedMm: 10 })).toThrow();
  });

  it('rounds to a point at the very bottom tip instead of staying full-width like a box', () => {
    const geometry = stickToGeometry({ lengthMm: 70, widthMm: 4, thicknessMm: 3, embedMm: 15 });
    const position = geometry.getAttribute('position');
    const bottomY = -(70 - 15);

    // Collect the x-extent of vertices right at the very bottom tip vs. just
    // below the flat top — the tip should taper to ~0 width, the top should not.
    let tipMaxAbsX = 0;
    let midMaxAbsX = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      if (y < bottomY + 0.05) tipMaxAbsX = Math.max(tipMaxAbsX, Math.abs(x));
      if (Math.abs(y - (bottomY + 2)) < 0.05) midMaxAbsX = Math.max(midMaxAbsX, Math.abs(x));
    }

    expect(tipMaxAbsX).toBeLessThan(0.5);
    expect(midMaxAbsX).toBeGreaterThan(1.5);
  });

  it('is non-indexed, matching the convention combine.ts relies on', () => {
    const geometry = stickToGeometry({ lengthMm: 70, widthMm: 4, thicknessMm: 3, embedMm: 15 });
    expect(geometry.index).toBeNull();
  });

  it('places the tip at the requested horizontal offset', () => {
    const geometry = stickToGeometry({ lengthMm: 70, widthMm: 4, thicknessMm: 3, embedMm: 15, offsetXMm: 12 });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    expect((bb.min.x + bb.max.x) / 2).toBeCloseTo(12, 5);
  });
});

function boxGeometry(minX: number, maxX: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(maxX - minX, 10, 3);
  geometry.translate((minX + maxX) / 2, 0, 0);
  return geometry;
}

describe('clampStickOffsetToBounds', () => {
  it('passes an offset through unchanged when it is already within bounds', () => {
    const main = boxGeometry(-20, 20);
    expect(clampStickOffsetToBounds(main, 5, 4)).toBeCloseTo(5, 5);
  });

  it('clamps an offset that would push the stick past the edge of the piece', () => {
    const main = boxGeometry(-20, 20);
    expect(clampStickOffsetToBounds(main, 1000, 4)).toBeCloseTo(18, 5); // 20 - width/2
    expect(clampStickOffsetToBounds(main, -1000, 4)).toBeCloseTo(-18, 5);
  });

  it('falls back to centering when the piece is narrower than the stick itself', () => {
    const main = boxGeometry(-1, 1); // 2mm wide piece, 4mm wide stick
    expect(clampStickOffsetToBounds(main, 0.5, 4)).toBeCloseTo(0, 5);
  });
});
