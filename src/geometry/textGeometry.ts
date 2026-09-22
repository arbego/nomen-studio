import * as THREE from 'three';
import { loadFont } from '../fonts/loadFont';
import { svgPathDataToShapes } from './svgPathToShapes';
import { extrudeShapesToMm } from './extrudeToMm';
import { DEFAULT_CURVE_SEGMENTS } from './units';

const FONT_UNITS_PER_EM_CALL = 1000;

/**
 * Renders a word/number string in the given font into a single mm-accurate,
 * printable solid. Assembles the whole string as one path (so connected script
 * fonts join correctly) rather than per-character geometry.
 */
export async function textToGeometry(
  text: string,
  fontId: string,
  targetWidthMm: number,
  extrudeDepthMm: number,
): Promise<THREE.BufferGeometry> {
  if (text.length === 0) {
    throw new Error('Cannot generate geometry for empty text');
  }
  const font = await loadFont(fontId);
  // features:{} disables GSUB substitution (ligatures/contextual alternates) —
  // opentype.js's shaping support is incomplete and can throw on some fonts'
  // tables; plain per-glyph outlines with kerning are what we need for extrusion.
  const otPath = font.getPath(text, 0, 0, FONT_UNITS_PER_EM_CALL, { features: {} });
  const pathData = otPath.toPathData(3);
  const shapes = svgPathDataToShapes(pathData);

  return extrudeShapesToMm(shapes, {
    targetWidthMm,
    extrudeDepthMm,
    curveSegments: DEFAULT_CURVE_SEGMENTS,
  });
}
