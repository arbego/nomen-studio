import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { combinePickGeometry } from './combine';
import { stickToGeometry } from './stickGeometry';
import { extrudeShapesToMm } from './extrudeToMm';

function letterLikeShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(50, 0);
  shape.lineTo(50, 80);
  shape.lineTo(0, 80);
  shape.closePath();
  return shape;
}

describe('combinePickGeometry', () => {
  it('merges an indexed and a non-indexed geometry without throwing', () => {
    const main = extrudeShapesToMm([letterLikeShape()], { targetWidthMm: 30, extrudeDepthMm: 3 });
    const stick = stickToGeometry({ lengthMm: 70, widthMm: 4, thicknessMm: 3, embedMm: 15 });

    const merged = combinePickGeometry(main, stick);
    expect(merged.getAttribute('position').count).toBe(
      main.getAttribute('position').count + stick.getAttribute('position').count,
    );
  });

  it('produces a geometry spanning both the piece above and the stick below y=0', () => {
    const main = extrudeShapesToMm([letterLikeShape()], { targetWidthMm: 30, extrudeDepthMm: 3 });
    const stick = stickToGeometry({ lengthMm: 70, widthMm: 4, thicknessMm: 3, embedMm: 15 });
    const merged = combinePickGeometry(main, stick);
    merged.computeBoundingBox();
    const bb = merged.boundingBox!;

    expect(bb.min.y).toBeLessThan(0); // stick handle extends below
    expect(bb.max.y).toBeGreaterThan(30); // letter extends well above
  });
});
