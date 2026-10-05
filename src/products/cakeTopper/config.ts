import type { Offset2D } from '../../geometry/types';

/** The cake topper is a single block of lettering; the id is kept as a named union so every per-block map stays exhaustively typed. */
export type CakeTopperBlockId = 'word';

export const CAKE_TOPPER_BLOCK_IDS: CakeTopperBlockId[] = ['word'];

/**
 * One ornament on the topper: a symbol from the icon catalogue (see
 * icons/catalog.ts), printed as a piece of its own in its own filament.
 *
 * Icons only, deliberately. A word on a cake topper is a line of the lettering,
 * which this product already does better than a free-floating ornament could —
 * it shares the font, the scale and the backing card with everything else on
 * the piece.
 *
 * Where it sits and what colour it is live apart from this, in
 * `decoratorPlacements` and `decoratorColors`, for the same reason a line's
 * position does: moving or recolouring one must not re-run the font build.
 */
export interface CakeTopperDecoratorConfig {
  /** Stable across edits and reorderings, so a placement can be kept against it. */
  id: string;
  iconName: string;
  /** Its finished width across its own ink. Icons are drawn on a square grid, so this is effectively its size. */
  widthMm: number;
  depthMm: number;
}

/** Where one ornament ended up and how far it is turned — the cheap half of an ornament, re-applied on every drag without touching a font. */
export interface DecoratorPlacementConfig {
  /** In the lettering's own local mm space. */
  offset: Offset2D;
  /** Degrees, about the ornament's own centre, so turning one spins it in place rather than swinging it off the piece. */
  angleDeg: number;
}

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
  /** Every ornament on the piece, in the order they were added. Only what shapes their glyphs — which icon, how wide, how thick. */
  decorators: CakeTopperDecoratorConfig[];
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
  /**
   * Where each ornament sits and how far it is turned, keyed by id — dragged
   * into place in the preview, exactly like a line of lettering.
   *
   * Keyed rather than positional so removing one ornament can't silently shift
   * every later one's placement onto the wrong icon.
   */
  decoratorPlacements: Record<string, DecoratorPlacementConfig>;
  /**
   * Each ornament's own colour, keyed by id. Kept out of the ornaments
   * themselves so recolouring one is the cheap edit it looks like rather than
   * re-extruding every glyph on the piece.
   *
   * An ornament with no entry here prints in the lettering's colour; see
   * `decoratorColor`.
   */
  decoratorColors: Record<string, string>;
}

/**
 * One ornament's colour.
 *
 * Falls back to the lettering's rather than to a constant: an ornament added to
 * a topper is usually run off in the same filament, so that is both the right
 * default for a new one and the right answer for a file saved before ornaments
 * had colours of their own.
 */
export function decoratorColor(config: CakeTopperConfig, id: string): string {
  return config.decoratorColors[id] ?? config.previewColor;
}
