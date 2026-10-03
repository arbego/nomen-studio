import { loadFont } from '../fonts/loadFont';
import { svgPathDataToShapes } from './svgPathToShapes';
import { extrudeGlyphShapesToMm } from './extrudeToMm';
import type { AnchoredGlyphShapes } from './extrudeToMm';
import { DEFAULT_CURVE_SEGMENTS } from './units';
import type { BlockId, LineGeometry, TextBlock } from './types';
import type { ExtrudeFit } from './extrudeToMm';

const FONT_UNITS_PER_EM_CALL = 1000;

export interface TextBlockOptions {
  id: BlockId;
  label: string;
  /** 1 or more lines of text, stacked top to bottom, sharing one font and one scale. */
  lines: string[];
  fontId: string;
  /** Whether `fit.mm` sizes the block by its overall width or its overall height — see ExtrudeFit. */
  fit: ExtrudeFit;
  extrudeDepthMm: number;
}

/**
 * Renders one or more stacked lines of text in the given font into one
 * independently watertight solid per letter, each already positioned at its
 * natural (font-kerning, line-stacked) resting (x, y) — reimplementing
 * opentype.js's own per-glyph layout loop (Font.prototype.forEachGlyph)
 * instead of calling font.getPath on the whole string, specifically so each
 * letter's position is individually known and adjustable (see
 * letterLayout.ts) without needing to re-run font extrusion whenever a
 * letter is nudged.
 *
 * Every line is baked into the *same* raw (pre-scale) coordinate frame — line
 * `i`'s glyphs sit `i * lineHeightFontUnits` below line 0's, using the font's
 * own ascender/descender metrics for natural spacing — and all of them are
 * fed into one `extrudeGlyphShapesToMm` call together. That function derives
 * one shared scale from the *combined* raw bounding box, so every line ends
 * up at the same letter size (driven by the whole block's extent mapping to
 * `fit.mm`) instead of each line being independently stretched to fill it on
 * its own — which would make a short line's letters balloon relative to a long
 * line's. With exactly one line this reduces to exactly the single-line math it
 * replaces.
 */
export async function buildTextBlock(options: TextBlockOptions): Promise<TextBlock> {
  const { id, label, lines, fontId, fit, extrudeDepthMm } = options;
  if (lines.every((line) => line.length === 0)) {
    throw new Error('Cannot generate geometry for empty text');
  }
  const font = await loadFont(fontId);
  const fontScale = (1 / font.unitsPerEm) * FONT_UNITS_PER_EM_CALL;
  const lineHeightFontUnits = (font.ascender - font.descender) * fontScale;

  const anchoredGlyphs: AnchoredGlyphShapes[] = [];
  const charactersByLine: string[][] = [];

  lines.forEach((line, lineIndex) => {
    // A plain per-character cmap lookup, not font.stringToGlyphs()'s full
    // Unicode-shaping pipeline: ligatures/contextual alternates aren't wanted
    // anyway (each letter needs its own independent, individually-adjustable
    // position — see letterLayout.ts), and some real-world fonts' `ccmp`
    // (glyph composition) GSUB tables use a lookup format opentype.js's own
    // shaping engine doesn't support and throws on — unconditionally, not
    // gated by any option — even for plain ASCII text (confirmed with
    // Roboto). charToGlyph() bypasses that shaping pipeline entirely.
    const characters = Array.from(line);
    charactersByLine.push(characters);
    const glyphs = characters.map((char) => font.charToGlyph(char));

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

    // Raw space is y-down (see extrudeToMm.ts), so a *larger* raw y ends up
    // lower on screen once the pipeline flips it into Three's y-up — line 0
    // stays on top, later lines stack below it.
    const rawY = lineIndex * lineHeightFontUnits;
    glyphs.forEach((glyph, i) => {
      const path = glyph.getPath(naturalXFontUnits[i], rawY, FONT_UNITS_PER_EM_CALL);
      anchoredGlyphs.push({ shapes: svgPathDataToShapes(path.toPathData(3)), anchorX: naturalXFontUnits[i] });
    });
  });

  const { glyphs: extruded, rawYToMm } = extrudeGlyphShapesToMm(anchoredGlyphs, {
    fit,
    extrudeDepthMm,
    curveSegments: DEFAULT_CURVE_SEGMENTS,
  });

  let cursor = 0;
  const lineGeometries: LineGeometry[] = charactersByLine.map((characters) => {
    const letters = extruded.slice(cursor, cursor + characters.length).map(({ geometry, anchorMm, contours }, i) => ({
      char: characters[i],
      geometry,
      naturalXMm: anchorMm,
      contours,
    }));
    cursor += characters.length;
    return { letters };
  });

  // The *last* line's baseline, i.e. the lowest one — that's the one a
  // flat-bottom trim cuts at, since only the bottom line's descenders can dip
  // below the piece's standing edge. With a single line this is just its own
  // baseline (raw y = 0).
  const lastLineRawY = (lines.length - 1) * lineHeightFontUnits;

  return { id, label, lines: lineGeometries, baselineYMm: rawYToMm(lastLineRawY) };
}
