import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { stickToGeometry, clampStickOffsetToBounds, stickLengthForLevelTip } from './stickGeometry';

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

describe('stickLengthForLevelTip', () => {
  it('uses the base length unchanged for a stick attached at the reference offset (y=0)', () => {
    expect(stickLengthForLevelTip(70, 15, 0)).toBe(70);
  });

  it('lengthens a stick attached higher up, by exactly the extra height, so its tip stays level', () => {
    expect(stickLengthForLevelTip(70, 15, 10)).toBe(80);
  });

  it('shortens a stick attached lower down, by exactly the difference, so its tip stays level', () => {
    expect(stickLengthForLevelTip(70, 15, -10)).toBe(60);
  });

  it('two sticks with different attach offsets produce tips at the same absolute height', () => {
    const embedMm = 15;
    const base = 70;
    const higher = { offsetY: 12, lengthMm: stickLengthForLevelTip(base, embedMm, 12) };
    const lower = { offsetY: -8, lengthMm: stickLengthForLevelTip(base, embedMm, -8) };

    const tipY = (s: typeof higher) => s.offsetY - (s.lengthMm - embedMm);
    expect(tipY(higher)).toBeCloseTo(tipY(lower), 10);
  });

  it('never collapses to less than a small, still-printable stub even for an extreme downward offset', () => {
    const result = stickLengthForLevelTip(70, 15, -1000);
    expect(result).toBeGreaterThan(15); // must still exceed embedMm
  });
});

function box3(minX: number, maxX: number, minY: number, maxY: number): THREE.Box3 {
  return new THREE.Box3(new THREE.Vector3(minX, minY, -1.5), new THREE.Vector3(maxX, maxY, 1.5));
}

describe('clampStickOffsetToBounds', () => {
  it('passes an offset through unchanged when it is already within bounds', () => {
    const main = box3(-20, 20, -5, 5);
    expect(clampStickOffsetToBounds(main, { x: 5, y: 1 }, 4, 2)).toMatchObject({ x: 5, y: 1 });
  });

  it('clamps x that would push the stick past the side of the piece', () => {
    const main = box3(-20, 20, -5, 5);
    expect(clampStickOffsetToBounds(main, { x: 1000, y: 0 }, 4, 2).x).toBeCloseTo(18, 5); // 20 - width/2
    expect(clampStickOffsetToBounds(main, { x: -1000, y: 0 }, 4, 2).x).toBeCloseTo(-18, 5);
  });

  it('clamps y so the whole embed depth stays within the piece, and allows attaching below the piece', () => {
    const main = box3(-20, 20, -5, 5);
    // embed=1 (at MIN_Y_OVERLAP_MM, so the full embed must fit): attach point y
    // can range from the piece's bottom (-5) up to (top - embed) = 5-1=4
    expect(clampStickOffsetToBounds(main, { x: 0, y: 1000 }, 4, 1).y).toBeCloseTo(4, 5);
    expect(clampStickOffsetToBounds(main, { x: 0, y: -1000 }, 4, 1).y).toBeCloseTo(-5, 5);
    expect(clampStickOffsetToBounds(main, { x: 0, y: 1 }, 4, 1).y).toBeCloseTo(1, 5);
  });

  it('only requires a small minimum overlap near the top, not the full embed depth, so a tall embed still leaves real drag room', () => {
    const main = box3(-20, 20, 0, 30); // 30mm-tall piece
    // embedMm=15 would (with the old "full embed must fit" rule) cap yMax at 30-15=15;
    // the actual cap should now use the much smaller MIN_Y_OVERLAP_MM instead.
    const clamped = clampStickOffsetToBounds(main, { x: 0, y: 1000 }, 4, 15);
    expect(clamped.y).toBeGreaterThan(20); // well above the old, over-conservative cap of 15
    expect(clamped.y).toBeLessThan(30); // but still leaves a nonzero overlap under the top
  });

  it('symmetrically allows the attach point well below the bottom edge too, not just near the top', () => {
    const main = box3(-20, 20, 0, 30); // 30mm-tall piece, bottom edge at y=0
    // With the old "full embed must fit" rule this would be clamped to 0 exactly
    // (no room below the piece at all). The new rule allows going well below,
    // symmetric to the top-side relaxation, while keeping a minimum overlap.
    const clamped = clampStickOffsetToBounds(main, { x: 0, y: -1000 }, 4, 15);
    expect(clamped.y).toBeLessThan(-5); // real room below the piece's bottom edge
    // the embedded interval [y, y+15] must still overlap the piece by >= MIN_Y_OVERLAP_MM
    expect(clamped.y + 15).toBeGreaterThanOrEqual(1 - 1e-6);
  });

  it('falls back to centering on an axis where the piece is smaller than the stick needs', () => {
    const narrow = box3(-1, 1, -5, 5); // 2mm wide piece, 4mm wide stick
    expect(clampStickOffsetToBounds(narrow, { x: 0.5, y: 0 }, 4, 2).x).toBeCloseTo(0, 5);

    const short = box3(-20, 20, -1, 1); // 2mm tall piece, 3mm embed doesn't fit at all
    expect(clampStickOffsetToBounds(short, { x: 0, y: 0.5 }, 4, 3).y).toBeCloseTo(0, 5);
  });
});
