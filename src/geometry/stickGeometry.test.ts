import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { stickToGeometry, clampStickOffsetToBounds } from './stickGeometry';

describe('stickToGeometry', () => {
  it('spans from below the attach point (the handle) to above it (the embedded overlap)', () => {
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

  it('places the tip at the requested (x, y) attach offset', () => {
    const geometry = stickToGeometry({ lengthMm: 70, widthMm: 4, thicknessMm: 3, embedMm: 15, offset: { x: 12, y: 8 } });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    expect((bb.min.x + bb.max.x) / 2).toBeCloseTo(12, 5);
    expect(bb.max.y).toBeCloseTo(8 + 15, 5);
    expect(bb.min.y).toBeCloseTo(8 - (70 - 15), 5);
  });
});

function boxGeometry(minX: number, maxX: number, minY: number, maxY: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(maxX - minX, maxY - minY, 3);
  geometry.translate((minX + maxX) / 2, (minY + maxY) / 2, 0);
  return geometry;
}

describe('clampStickOffsetToBounds', () => {
  it('passes an offset through unchanged when it is already within bounds', () => {
    const main = boxGeometry(-20, 20, -5, 5);
    expect(clampStickOffsetToBounds(main, { x: 5, y: 1 }, 4, 2)).toMatchObject({ x: 5, y: 1 });
  });

  it('clamps x that would push the stick past the side of the piece', () => {
    const main = boxGeometry(-20, 20, -5, 5);
    expect(clampStickOffsetToBounds(main, { x: 1000, y: 0 }, 4, 2).x).toBeCloseTo(18, 5); // 20 - width/2
    expect(clampStickOffsetToBounds(main, { x: -1000, y: 0 }, 4, 2).x).toBeCloseTo(-18, 5);
  });

  it('clamps y so the whole embed depth stays within the piece, and allows attaching below the piece', () => {
    const main = boxGeometry(-20, 20, -5, 5);
    // embed=2: attach point y can range from the piece's bottom (-5) up to (top - embed) = 5-2=3
    expect(clampStickOffsetToBounds(main, { x: 0, y: 1000 }, 4, 2).y).toBeCloseTo(3, 5);
    expect(clampStickOffsetToBounds(main, { x: 0, y: -1000 }, 4, 2).y).toBeCloseTo(-5, 5);
    expect(clampStickOffsetToBounds(main, { x: 0, y: 1 }, 4, 2).y).toBeCloseTo(1, 5);
  });

  it('falls back to centering on an axis where the piece is smaller than the stick needs', () => {
    const narrow = boxGeometry(-1, 1, -5, 5); // 2mm wide piece, 4mm wide stick
    expect(clampStickOffsetToBounds(narrow, { x: 0.5, y: 0 }, 4, 2).x).toBeCloseTo(0, 5);

    const short = boxGeometry(-20, 20, -1, 1); // 2mm tall piece, 3mm embed doesn't fit at all
    expect(clampStickOffsetToBounds(short, { x: 0, y: 0.5 }, 4, 3).y).toBeCloseTo(0, 5);
  });
});
