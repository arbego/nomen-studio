import * as THREE from 'three';
import { getShapeDefinition } from '../shapes/registry';
import { svgPathDataToShapes } from './svgPathToShapes';
import { extrudeShapesToMm } from './extrudeToMm';
import { DEFAULT_CURVE_SEGMENTS } from './units';

/** Renders a registered accent shape (heart, and future shapes) into a printable solid. */
export function accentShapeToGeometry(
  shapeId: string,
  targetWidthMm: number,
  extrudeDepthMm: number,
): THREE.BufferGeometry {
  const def = getShapeDefinition(shapeId);
  const shapes = svgPathDataToShapes(def.svgPath);

  return extrudeShapesToMm(shapes, {
    targetWidthMm,
    extrudeDepthMm,
    curveSegments: DEFAULT_CURVE_SEGMENTS,
  });
}
