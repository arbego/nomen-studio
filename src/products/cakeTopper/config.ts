import type { Offset2D } from '../../geometry/types';

/** The cake topper is a single block of lettering; the id is kept as a named union so every per-block map stays exhaustively typed. */
export type CakeTopperBlockId = 'word';

export const CAKE_TOPPER_BLOCK_IDS: CakeTopperBlockId[] = ['word'];

/** The fields that drive the expensive, async, font-dependent geometry build. Stick
 * fields are deliberately excluded — repositioning/resizing a stick must stay cheap
 * and never re-trigger font extrusion. */
export interface CakeTopperGeometryConfig {
  /** 1-3 lines of text, stacked top to bottom, sharing one font/scale — see textGeometry.ts. */
  lines: string[];
  wordFontId: string;
  /** Target width of the widest line, in millimeters — drives the shared scale of every line. */
  sizeMm: number;
  extrudeDepthMm: number;
}

export interface CakeTopperConfig extends CakeTopperGeometryConfig {
  stickLengthMm: number;
  stickWidthMm: number;
  stickEmbedMm: number;
  /** Where each block's sticks attach, in mm from that block's own local origin —
   * one or more per block, each independently draggable. */
  stickOffsets: Record<CakeTopperBlockId, Offset2D[]>;
  /**
   * Extra horizontal shift (mm), applied on top of the font's own kerning, at
   * each letter-to-letter gap within a line — one array per line (indexed the
   * same as `lines`); within a line, index i adjusts the gap between letter i
   * and letter i+1, and (since positions are cumulative) cascades to every
   * letter after it too. Each line's array is always length
   * `lines[i].length - 1`; reset to all zeros whenever that line's text (or
   * the line count) changes (see the store's setConfig).
   */
  letterGapsMm: number[][];
  /**
   * Each line's draggable (x, y) position, on top of its baked-in natural
   * stacked position (see textGeometry.ts) — index-aligned with `lines`.
   * Unlike a stick's offset, a line has no "must stay attached" constraint, so
   * this is never clamped.
   */
  lineOffsets: Offset2D[];
  /** Cosmetic only — the physical color comes from 3D printer filament, not the file. */
  previewColor: string;
  /** Whether a growable solid backing card is added under the word — see outline.ts. */
  outlineEnabled: boolean;
  /** How far the outline card extends past the letters, in mm. Growing it far enough merges nearby disconnected pieces (e.g. an "i"'s dot and its stem) into one connected card — see outline.ts. */
  outlineGrowMm: number;
  /** The outline's own color, independent of previewColor (the word's). */
  outlineColor: string;
  /** The outline card's own thickness (mm), independent of extrudeDepthMm (the word's) — kept shallower by default so the letters visibly stand proud of the card instead of being flush with (and so, from the front, hidden behind) it. */
  outlineDepthMm: number;
  /**
   * Counter holes (e.g. the "a" in a script font) the user has manually chosen
   * to fill in solid, as `outlineHoleKey(lineIndex, letterIndex)` strings (see
   * outline.ts). Reset whenever any line's text or `wordFontId` changes, since
   * a different letter/glyph at that position invalidates the key.
   */
  closedOutlineHoles: string[];
}
