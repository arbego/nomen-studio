import type { Offset2D } from '../../geometry/types';
import type { StandMode } from '../../geometry/baseGeometry';

/** The two pieces: a large background initial, and the script name inlaid into its face. */
export type NameDisplayBlockId = 'initial' | 'name';

/**
 * The fields that drive the expensive, async, font-dependent build — the ones
 * that change the glyphs themselves. Where the name sits, its letter gaps, the
 * pocket and the base rail are all deliberately excluded, so dragging the name
 * never re-runs font extrusion; see NameDisplayAssemblyConfig.
 */
export interface NameDisplayBlocksConfig {
  /** The big background letter. A single character — a monogram, not a word. */
  initial: string;
  initialFontId: string;
  /** Sized by *height*: the finished display's height is the dimension that matters, and an "I" and a "W" at equal width are wildly different objects. */
  initialHeightMm: number;
  /** The initial is the structural piece and is deliberately thick — it is what holds the name and keeps the whole thing upright. */
  initialDepthMm: number;

  /** The script name laid across the initial. Sized by width, since its length is what has to span the piece. */
  name: string;
  nameFontId: string;
  nameWidthMm: number;
  nameDepthMm: number;

  /** A flat-bottom trim is here, not in the assembly config, because unlike the other standing modes it re-cuts the glyph silhouettes themselves. */
  standMode: StandMode;
  /** Shifts a flat-bottom trim off the typographic baseline — positive cuts higher. */
  trimOffsetMm: number;
}

/** The fields applied synchronously on top of the built blocks — all cheap enough to re-run on every drag commit. */
export interface NameDisplayAssemblyConfig {
  /** Where the name sits on the initial, in the initial's own local mm space — draggable in the preview. */
  nameOffset: Offset2D;
  /** Extra per-letter-gap shift within the name, exactly as the cake topper's letterGapsMm works (one array, since the name is a single line). */
  nameLetterGapsMm: number[];

  /**
   * How deep the name is recessed into the initial's front face. The name
   * protrudes by `nameDepthMm - pocketDepthMm`, so a pocket deeper than the
   * name itself would swallow it — see MAX_POCKET_FRACTION in geometry.ts.
   */
  pocketDepthMm: number;
  /** Fit tolerance: the pocket is cut this much larger than the name all round, so the printed pieces actually go together. */
  pocketClearanceMm: number;

  railHeightMm: number;
  railDepthMm: number;
  railMarginMm: number;
}

export interface NameDisplayConfig extends NameDisplayBlocksConfig, NameDisplayAssemblyConfig {
  /** Cosmetic only — the physical colors come from the two filaments. */
  initialColor: string;
  nameColor: string;
}
