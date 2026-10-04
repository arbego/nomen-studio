import type { TextBlock } from '../geometry/types';
import { buildTextBlock } from '../geometry/textGeometry';
import { iconChar, iconFontId } from './catalog';

export interface IconBlockOptions {
  /** Identifies the resulting block, so a product can tell several of them apart. */
  id: string;
  /** An icon id, which says both which glyph and — through its set — which font it is a glyph of. */
  iconName: string;
  /** The icon's finished width across its own ink, in mm. */
  widthMm: number;
  extrudeDepthMm: number;
}

/**
 * One icon as a solid, built through exactly the same path as a letter.
 *
 * An icon is a glyph, so there is nothing here but naming the font its set is a
 * face of and handing over the one character its codepoint maps to: outline
 * parsing, hole detection, millimeter scaling and extrusion are the text
 * pipeline's, unchanged, and the contours it returns are what a pocket boolean
 * needs.
 *
 * Sized by width rather than height because that is the dimension a person
 * judges an ornament by against the piece it sits on — and the icon sets are
 * drawn on a square grid, so width and height track each other anyway.
 */
export function buildIconBlock(options: IconBlockOptions): Promise<TextBlock> {
  const { id, iconName, widthMm, extrudeDepthMm } = options;
  return buildTextBlock({
    id,
    label: iconName,
    lines: [iconChar(iconName)],
    fontId: iconFontId(iconName),
    fit: { mode: 'width', mm: widthMm },
    extrudeDepthMm,
  });
}
