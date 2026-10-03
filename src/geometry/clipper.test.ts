import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { growRegion, intersectRegions, rectRegion, regionFromContours, regionIsEmpty, regionToShapes, subtractRegions } from './clipper';
import type { GlyphContour } from './types';

function square(minX: number, minY: number, maxX: number, maxY: number): THREE.Vector2[] {
  return [new THREE.Vector2(minX, minY), new THREE.Vector2(maxX, minY), new THREE.Vector2(maxX, maxY), new THREE.Vector2(minX, maxY)];
}

function contour(outer: THREE.Vector2[], holes: THREE.Vector2[][] = []): GlyphContour {
  return { outer, holes };
}

/** The bounding box of every point of every shape, holes included. */
function shapesBounds(shapes: THREE.Shape[]): THREE.Box2 {
  const box = new THREE.Box2();
  for (const shape of shapes) {
    for (const p of shape.getPoints()) box.expandByPoint(p);
    for (const hole of shape.holes) for (const p of hole.getPoints()) box.expandByPoint(p);
  }
  return box;
}

function totalArea(shapes: THREE.Shape[]): number {
  return shapes.reduce((sum, shape) => {
    const outer = Math.abs(THREE.ShapeUtils.area(shape.getPoints()));
    const holes = shape.holes.reduce((h, hole) => h + Math.abs(THREE.ShapeUtils.area(hole.getPoints())), 0);
    return sum + outer - holes;
  }, 0);
}

describe('regionFromContours / regionToShapes', () => {
  it('round-trips a plain square', () => {
    const shapes = regionToShapes(regionFromContours([contour(square(0, 0, 10, 10))]));
    expect(shapes).toHaveLength(1);
    expect(totalArea(shapes)).toBeCloseTo(100, 3);
  });

  it('keeps a counter as a real hole, not a filled-in patch', () => {
    // The "O" case: an outer boundary with its own inner subpath.
    const shapes = regionToShapes(regionFromContours([contour(square(0, 0, 10, 10), [square(3, 3, 7, 7)])]));
    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(1);
    expect(totalArea(shapes)).toBeCloseTo(100 - 16, 3);
  });

  it('unions overlapping glyphs instead of cancelling their overlap', () => {
    // Script fonts routinely overlap adjacent letters. Under an even-odd fill
    // rule the shared area would XOR to empty; the non-zero rule keeps it solid.
    const shapes = regionToShapes(regionFromContours([contour(square(0, 0, 10, 10)), contour(square(5, 0, 15, 10))]));
    expect(totalArea(shapes)).toBeCloseTo(150, 3);
  });

  it('shifts every contour, holes included', () => {
    const region = regionFromContours([contour(square(0, 0, 10, 10), [square(3, 3, 7, 7)])], { translate: { x: 100, y: -50 } });
    const bounds = shapesBounds(regionToShapes(region));
    expect(bounds.min.x).toBeCloseTo(100, 3);
    expect(bounds.max.x).toBeCloseTo(110, 3);
    expect(bounds.min.y).toBeCloseTo(-50, 3);
  });

  it('rotates every contour about the placement pivot', () => {
    // A 10x10 square turned 45° about its own center keeps that center and
    // grows to the diagonal — the transform the tilted name's pocket relies on.
    const region = regionFromContours([contour(square(0, 0, 10, 10))], { rotationRad: Math.PI / 4, pivot: { x: 5, y: 5 } });
    const bounds = shapesBounds(regionToShapes(region));
    const diagonal = Math.SQRT2 * 10;
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(diagonal, 2);
    expect((bounds.min.x + bounds.max.x) / 2).toBeCloseTo(5, 3);
    expect((bounds.min.y + bounds.max.y) / 2).toBeCloseTo(5, 3);
  });
});

describe('intersectRegions', () => {
  it('keeps only the overlap', () => {
    const a = regionFromContours([contour(square(0, 0, 10, 10))]);
    const b = regionFromContours([contour(square(6, 6, 20, 20))]);
    const bounds = shapesBounds(regionToShapes(intersectRegions(a, b)));
    expect(bounds.min.x).toBeCloseTo(6, 3);
    expect(bounds.max.x).toBeCloseTo(10, 3);
    expect(bounds.min.y).toBeCloseTo(6, 3);
    expect(bounds.max.y).toBeCloseTo(10, 3);
  });

  it('is empty when the regions do not touch', () => {
    const a = regionFromContours([contour(square(0, 0, 10, 10))]);
    const b = regionFromContours([contour(square(50, 50, 60, 60))]);
    expect(regionToShapes(intersectRegions(a, b))).toHaveLength(0);
  });

  it('does not reach into a hole of the subject', () => {
    const ring = regionFromContours([contour(square(0, 0, 10, 10), [square(3, 3, 7, 7)])]);
    const middle = regionFromContours([contour(square(4, 4, 6, 6))]);
    expect(regionIsEmpty(intersectRegions(ring, middle))).toBe(true);
  });
});

describe('subtractRegions', () => {
  it('punches an enclosed clip out as a hole', () => {
    const solid = regionFromContours([contour(square(0, 0, 10, 10))]);
    const bite = regionFromContours([contour(square(3, 3, 7, 7))]);
    const shapes = regionToShapes(subtractRegions(solid, bite));
    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(1);
    expect(totalArea(shapes)).toBeCloseTo(100 - 16, 3);
  });

  it('ignores the part of the clip that lies outside the subject', () => {
    // The name display depends on this: the script name overhangs the initial
    // on both sides, and only the overlapping part may cut a pocket.
    const solid = regionFromContours([contour(square(0, 0, 10, 10))]);
    const overhanging = regionFromContours([contour(square(5, 0, 100, 10))]);
    const shapes = regionToShapes(subtractRegions(solid, overhanging));
    expect(shapesBounds(shapes).max.x).toBeCloseTo(5, 3);
    expect(totalArea(shapes)).toBeCloseTo(50, 3);
  });

  it('returns the subject untouched when there is nothing to cut', () => {
    const solid = regionFromContours([contour(square(0, 0, 10, 10))]);
    expect(totalArea(regionToShapes(subtractRegions(solid, [])))).toBeCloseTo(100, 3);
  });
});

describe('growRegion', () => {
  it('expands the silhouette by the delta in every direction', () => {
    const grown = growRegion(regionFromContours([contour(square(0, 0, 10, 10))]), 2);
    const bounds = shapesBounds(regionToShapes(grown));
    expect(bounds.min.x).toBeCloseTo(-2, 1);
    expect(bounds.max.x).toBeCloseTo(12, 1);
    expect(bounds.min.y).toBeCloseTo(-2, 1);
    expect(bounds.max.y).toBeCloseTo(12, 1);
  });

  it('is a no-op at zero', () => {
    const region = regionFromContours([contour(square(0, 0, 10, 10))]);
    expect(totalArea(regionToShapes(growRegion(region, 0)))).toBeCloseTo(100, 3);
  });
});

describe('rectRegion', () => {
  it('clips a shape to a half-plane, which is how a flat-bottom trim cuts', () => {
    const letter = regionFromContours([contour(square(0, -10, 10, 20))]);
    const shapes = regionToShapes(intersectRegions(letter, rectRegion(-1e5, 0, 1e5, 1e5)));
    const bounds = shapesBounds(shapes);
    expect(bounds.min.y).toBeCloseTo(0, 3);
    expect(bounds.max.y).toBeCloseTo(20, 3);
  });
});
