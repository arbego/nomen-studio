import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

/**
 * Converts raw SVG path `d` data into hole-aware THREE.Shape objects, reusing
 * Three.js's own SVGLoader (via a throwaway in-memory <svg>) instead of
 * hand-rolling winding/hole-detection — glyph counters (the holes in e/a/o/g)
 * and multi-contour accent shapes both need that logic to be correct.
 */
export function svgPathDataToShapes(pathData: string): THREE.Shape[] {
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${pathData}"/></svg>`;
  const loader = new SVGLoader();
  const result = loader.parse(svgString);

  const shapes: THREE.Shape[] = [];
  for (const path of result.paths) {
    shapes.push(...path.toShapes());
  }
  return shapes;
}

/** Bounding box (in the shapes' own local units) across every shape's outer contour. */
export function shapesBoundingBox(shapes: THREE.Shape[], curveSegments: number): THREE.Box2 {
  const box = new THREE.Box2();
  for (const shape of shapes) {
    const points = shape.getPoints(curveSegments);
    for (const p of points) {
      box.expandByPoint(p);
    }
  }
  return box;
}
