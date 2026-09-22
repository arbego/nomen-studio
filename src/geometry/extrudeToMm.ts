import * as THREE from 'three';
import { DEFAULT_CURVE_SEGMENTS } from './units';
import { shapesBoundingBox } from './svgPathToShapes';

export interface ExtrudeToMmOptions {
  targetWidthMm: number;
  extrudeDepthMm: number;
  curveSegments?: number;
}

/**
 * Extrudes flat (SVG-space, y-down) shapes into a solid sized to real millimeters,
 * flipped into Three.js's y-up world, and anchored at local origin = bottom-center
 * of the piece — the convention every pick's geometry shares, so a stick can always
 * be attached starting at y=0 growing downward.
 */
export function extrudeShapesToMm(shapes: THREE.Shape[], options: ExtrudeToMmOptions): THREE.BufferGeometry {
  const curveSegments = options.curveSegments ?? DEFAULT_CURVE_SEGMENTS;
  const rawBox = shapesBoundingBox(shapes, curveSegments);
  const rawWidth = rawBox.max.x - rawBox.min.x;
  if (!(rawWidth > 0)) {
    throw new Error('Cannot extrude an empty or zero-width shape set');
  }
  const scale = options.targetWidthMm / rawWidth;

  let geometry: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shapes, {
    depth: options.extrudeDepthMm / scale,
    bevelEnabled: false,
    curveSegments,
  });
  if (geometry.index) {
    geometry = geometry.toNonIndexed();
  }

  // SVG/font space is y-down; negate y to become Three's y-up, and scale to mm.
  geometry.scale(scale, -scale, scale);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  geometry.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, 0);
  geometry.computeVertexNormals();

  return geometry;
}
