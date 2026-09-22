import { describe, expect, it } from 'vitest';
import { accentShapeToGeometry } from './shapeGeometry';

describe('accentShapeToGeometry', () => {
  it('extrudes the heart accent to the requested width in mm', () => {
    const geometry = accentShapeToGeometry('heart', 25, 3);
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;

    expect(bb.max.x - bb.min.x).toBeCloseTo(25, 5);
    expect(bb.max.z - bb.min.z).toBeCloseTo(3, 5);
    expect(bb.min.y).toBeCloseTo(0, 5);
  });

  it('throws for an unknown shape id', () => {
    expect(() => accentShapeToGeometry('nonexistent', 25, 3)).toThrow();
  });
});
