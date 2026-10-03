/**
 * Identifies one text block within a product's design (e.g. the cake topper's
 * 'word', or the name display's 'initial' and 'name'). Products choose their own
 * ids; nothing in the shared core interprets them.
 */
export type BlockId = string;

/** A plain (x, y) offset in millimeters — a line's draggable position, a stick's attach point, a block's placement. */
export interface Offset2D {
  x: number;
  y: number;
}

/**
 * One closed boundary of a glyph: its outer contour plus any counters (the hole
 * in "a"/"o"/"B") the font draws as their own subpaths. Both are in the same
 * final mm-space and natural-position convention as the letter's own `geometry`.
 */
export interface GlyphContour {
  outer: import('three').Vector2[];
  /**
   * Note that some script fonts instead draw a counter as a single
   * self-approaching *outer* contour, so an empty `holes` does not mean the
   * glyph has no visual hole — see outline.ts, which relies on Clipper
   * rediscovering those from `outer` alone.
   */
  holes: import('three').Vector2[][];
}

export interface LetterGeometry {
  char: string;
  /**
   * This glyph's own watertight solid — already scaled to mm and positioned at
   * its natural (font-kerning) resting x, sharing the whole word's baseline and
   * center the same way the word used to be anchored as a single combined
   * piece. Renders correctly with zero extra transform; a letter-gap override
   * shifts it (and, cascading, everything after it) via an additional x
   * translation rather than by rebuilding this geometry — see letterLayout.ts.
   */
  geometry: import('three').BufferGeometry;
  /** This letter's natural resting x (mm), before any gap override. */
  naturalXMm: number;
  /**
   * The boundary of each of this glyph's disconnected shapes, in the same
   * mm-space/natural-position convention as `geometry`. Almost always one
   * contour; a glyph like "i"/"j" has two (the stem and the dot).
   *
   * Consumers that grow the silhouette outward (outline.ts) read only `outer`
   * and let Clipper rediscover the holes; consumers that need the glyph's true
   * filled area — the name display's inlay pocket, which must not fill in the
   * counter of an "A" or "O" — need `holes` as well.
   */
  contours: GlyphContour[];
}

export interface LineGeometry {
  /** This line's letters, in reading order — no gap/line-offset overrides baked in. */
  letters: LetterGeometry[];
}

/**
 * One printable piece of lettering: one or more stacked lines of text sharing a
 * single font, scale and baseline (see textGeometry.ts). Within-line gap
 * overrides and per-line position offsets are applied as a position offset at
 * render/export time — both cheap and synchronous, so neither has to re-run font
 * extrusion. Whatever a product adds on top (a cake topper's sticks, a name
 * display's base rail) is generated separately and merged in at export.
 */
export interface TextBlock {
  id: BlockId;
  label: string;
  lines: LineGeometry[];
  /**
   * The y (mm) of the text's typographic baseline in this block's own local
   * space. Descenders dip below it, which is exactly where a flat-bottom trim
   * wants to cut by default — see baseGeometry.ts.
   */
  baselineYMm: number;
}
