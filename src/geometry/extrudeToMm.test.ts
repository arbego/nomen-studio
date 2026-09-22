import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { extrudeShapesToMm } from './extrudeToMm';

function unitSquareShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(200, 0);
  shape.lineTo(200, 100);
  shape.lineTo(0, 100);
  shape.closePath();
  return shape;
}

describe('extrudeShapesToMm', () => {
  it('scales a shape to the target width and flips into y-up, bottom-anchored space', () => {
    const geometry = extrudeShapesToMm([unitSquareShape()], { targetWidthMm: 50, extrudeDepthMm: 4 });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;

    // width was 200 raw units -> targetWidthMm 50 => scale 0.25; height 100 raw -> 25mm
    expect(bb.max.x - bb.min.x).toBeCloseTo(50, 5);
    expect(bb.max.y - bb.min.y).toBeCloseTo(25, 5);
    expect(bb.max.z - bb.min.z).toBeCloseTo(4, 5);

    // bottom-anchored: y starts at 0; x centered around 0
    expect(bb.min.y).toBeCloseTo(0, 5);
    expect(bb.min.x).toBeCloseTo(-25, 5);
    expect(bb.max.x).toBeCloseTo(25, 5);
  });

  it('produces a finite, non-degenerate geometry with no NaNs', () => {
    const geometry = extrudeShapesToMm([unitSquareShape()], { targetWidthMm: 50, extrudeDepthMm: 4 });
    const position = geometry.getAttribute('position');
    let hasNaN = false;
    for (let i = 0; i < position.count * 3; i++) {
      if (Number.isNaN(position.array[i])) hasNaN = true;
    }
    expect(hasNaN).toBe(false);
    expect(position.count).toBeGreaterThan(0);
  });

  it('rejects an empty shape list', () => {
    expect(() => extrudeShapesToMm([], { targetWidthMm: 50, extrudeDepthMm: 4 })).toThrow();
  });
});
