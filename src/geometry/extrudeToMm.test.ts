import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { extrudeShapesToMm, extrudeGlyphShapesToMm } from './extrudeToMm';

function unitSquareShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(200, 0);
  shape.lineTo(200, 100);
  shape.lineTo(0, 100);
  shape.closePath();
  return shape;
}

/** The z-component of a vertex normal at the geometry's own front cap (max z) — should be ~+1 for a correctly-wound extrusion, since the front cap should face the camera (+z). */
function frontCapNormalZ(geometry: THREE.BufferGeometry): number {
  geometry.computeBoundingBox();
  const maxZ = geometry.boundingBox!.max.z;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getZ(i) - maxZ) < 1e-6) {
      return normal.getZ(i);
    }
  }
  throw new Error('No vertex found at the front cap');
}

describe('extrudeShapesToMm', () => {
  it('scales a shape to the target width and flips into y-up, bottom-anchored space', () => {
    const geometry = extrudeShapesToMm([unitSquareShape()], { fit: { mode: 'width', mm: 50 }, extrudeDepthMm: 4 });
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

  it('winds the front cap so its normal faces the camera (+z), not backward', () => {
    // Regression test: the y-mirror needed to flip SVG/font space (y-down) into
    // Three's y-up bakes an orientation-reversing scale into the geometry,
    // which silently inverts every face's effective winding unless corrected
    // — normally invisible (a mirrored extrusion's back cap ends up facing
    // front instead, and looks the same from a distance), but very visible
    // once anything else sits directly behind the "hole" left where the
    // actual front cap should have been.
    const geometry = extrudeShapesToMm([unitSquareShape()], { fit: { mode: 'width', mm: 50 }, extrudeDepthMm: 4 });
    expect(frontCapNormalZ(geometry)).toBeCloseTo(1, 5);
  });

  it('produces a finite, non-degenerate geometry with no NaNs', () => {
    const geometry = extrudeShapesToMm([unitSquareShape()], { fit: { mode: 'width', mm: 50 }, extrudeDepthMm: 4 });
    const position = geometry.getAttribute('position');
    let hasNaN = false;
    for (let i = 0; i < position.count * 3; i++) {
      if (Number.isNaN(position.array[i])) hasNaN = true;
    }
    expect(hasNaN).toBe(false);
    expect(position.count).toBeGreaterThan(0);
  });

  it('rejects an empty shape list', () => {
    expect(() => extrudeShapesToMm([], { fit: { mode: 'width', mm: 50 }, extrudeDepthMm: 4 })).toThrow();
  });
});

describe('extrudeGlyphShapesToMm', () => {
  it('winds every glyph so its front cap faces the camera (+z), same fix as extrudeShapesToMm', () => {
    const glyphs = [{ shapes: [unitSquareShape()], anchorX: 0 }];
    const { glyphs: [{ geometry }] } = extrudeGlyphShapesToMm(glyphs, { fit: { mode: 'width', mm: 50 }, extrudeDepthMm: 4 });
    expect(frontCapNormalZ(geometry)).toBeCloseTo(1, 5);
  });
});
