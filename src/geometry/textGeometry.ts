import { loadFont } from '../fonts/loadFont';
import { svgPathDataToShapes } from './svgPathToShapes';
import { extrudeGlyphShapesToMm } from './extrudeToMm';
import { DEFAULT_CURVE_SEGMENTS } from './units';
import type { LetterGeometry } from './types';

const FONT_UNITS_PER_EM_CALL = 1000;
// features:{} disables GSUB substitution (ligatures/contextual alternates) —
// opentype.js's shaping support is incomplete and can throw on some fonts'
// tables; plain per-glyph outlines with kerning are what we need for extrusion.
const GLYPH_OPTIONS = { features: {} };

/**
 * Renders a word in the given font into one independently watertight solid per
 * letter, each already positioned at its natural (font-kerning) resting x and
 * sharing one scale/baseline/center across the whole word — reimplementing
 * opentype.js's own per-glyph layout loop (Font.prototype.forEachGlyph) instead
 * of calling font.getPath on the whole string, specifically so each letter's
 * position is individually known and adjustable (see letterLayout.ts) without
 * needing to re-run font extrusion whenever a letter is nudged.
 */
export async function wordToLetterGeometries(word: string, fontId: string, targetWidthMm: number, extrudeDepthMm: number): Promise<LetterGeometry[]> {
  if (word.length === 0) {
    throw new Error('Cannot generate geometry for empty text');
  }
  const font = await loadFont(fontId);
  const glyphs = font.stringToGlyphs(word, GLYPH_OPTIONS);
  const fontScale = (1 / font.unitsPerEm) * FONT_UNITS_PER_EM_CALL;

  // Natural x (in the same font-render-unit space getPath itself works in) for
  // every glyph, via the exact advance-width + kerning loop opentype.js's own
  // Font.prototype.forEachGlyph uses internally.
  const naturalXFontUnits: number[] = [];
  let x = 0;
  for (let i = 0; i < glyphs.length; i++) {
    naturalXFontUnits.push(x);
    const glyph = glyphs[i];
    if (glyph.advanceWidth) {
      x += glyph.advanceWidth * fontScale;
    }
    if (i < glyphs.length - 1) {
      x += font.getKerningValue(glyph, glyphs[i + 1]) * fontScale;
    }
  }

  const anchoredGlyphs = glyphs.map((glyph, i) => {
    const path = glyph.getPath(naturalXFontUnits[i], 0, FONT_UNITS_PER_EM_CALL);
    return { shapes: svgPathDataToShapes(path.toPathData(3)), anchorX: naturalXFontUnits[i] };
  });

  const extruded = extrudeGlyphShapesToMm(anchoredGlyphs, {
    targetWidthMm,
    extrudeDepthMm,
    curveSegments: DEFAULT_CURVE_SEGMENTS,
  });

  return extruded.map(({ geometry, anchorMm }, i) => ({
    char: word[i] ?? '',
    geometry,
    naturalXMm: anchorMm,
  }));
}
