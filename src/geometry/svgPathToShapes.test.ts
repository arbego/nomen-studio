import { describe, expect, it } from 'vitest';
import { svgPathDataToShapes, shapesBoundingBox } from './svgPathToShapes';

// A heart-shaped path, standing in for the kind of multi-curve outline this
// parser needs to handle correctly (used elsewhere for glyph outlines).
const HEART_PATH =
  'M 50 92 C 50 92 8 58 8 30 C 8 14 21 3 37 3 C 45 3 50 10 50 19 C 50 10 55 3 63 3 C 79 3 92 14 92 30 C 92 58 50 92 50 92 Z';

describe('svgPathDataToShapes', () => {
  it('parses a multi-curve path into a single closed shape', () => {
    const shapes = svgPathDataToShapes(HEART_PATH);
    expect(shapes.length).toBeGreaterThan(0);

    const box = shapesBoundingBox(shapes, 12);
    expect(box.max.x - box.min.x).toBeGreaterThan(50);
    expect(box.max.y - box.min.y).toBeGreaterThan(50);
  });

  it('assigns an inner contour with opposite winding as a hole, not a separate shape', () => {
    const outer = 'M0,0 L100,0 L100,100 L0,100 Z';
    const inner = 'M25,25 L25,75 L75,75 L75,25 Z';
    const shapes = svgPathDataToShapes(`${outer} ${inner}`);

    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(1);
  });

  it('treats same-winding contours as two separate solid shapes, not a hole', () => {
    const a = 'M0,0 L100,0 L100,100 L0,100 Z';
    const b = 'M200,0 L300,0 L300,100 L200,100 Z';
    const shapes = svgPathDataToShapes(`${a} ${b}`);

    expect(shapes).toHaveLength(2);
    expect(shapes[0].holes).toHaveLength(0);
    expect(shapes[1].holes).toHaveLength(0);
  });
});
