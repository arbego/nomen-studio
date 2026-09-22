import { describe, expect, it } from 'vitest';
import { svgPathDataToShapes, shapesBoundingBox } from './svgPathToShapes';
import { SHAPE_REGISTRY } from '../shapes/registry';

describe('svgPathDataToShapes', () => {
  it('parses the registered heart path into a single closed shape', () => {
    const heart = SHAPE_REGISTRY.find((s) => s.id === 'heart')!;
    const shapes = svgPathDataToShapes(heart.svgPath);
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
