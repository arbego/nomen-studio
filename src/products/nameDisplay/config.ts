import type { Offset2D } from '../../geometry/types';
import type { StandMode } from '../../geometry/baseGeometry';

/** The two pieces: a large background initial, and the script name inlaid into its face. */
export type NameDisplayBlockId = 'initial' | 'name';

/** The fields that drive the expensive, async, font-dependent build. */
export interface NameDisplayGeometryConfig {
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

  standMode: StandMode;
  railHeightMm: number;
  railDepthMm: number;
  railMarginMm: number;
  /** Shifts a flat-bottom trim off the typographic baseline — positive cuts higher. */
  trimOffsetMm: number;
}

export interface NameDisplayConfig extends NameDisplayGeometryConfig {
  /** Cosmetic only — the physical colors come from the two filaments. */
  initialColor: string;
  nameColor: string;
}
