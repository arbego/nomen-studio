import type { Offset2D } from '../../geometry/types';
import type { StandMode } from '../../geometry/baseGeometry';

/** The two fixed pieces: a large background initial, and the script name inlaid into its face. Decorators are added on top of these and identified by their own ids. */
export type NameDisplayBlockId = 'initial' | 'name';

/**
 * One ornament stamped into the initial alongside the name — an icon, inlaid
 * exactly the way the name is, with its own pocket and its own place on the
 * letter.
 *
 * Its position lives apart from this, in `decoratorOffsets`, for the same reason
 * the name's does: moving one must not re-run the font build.
 */
export interface DecoratorConfig {
  /** Stable across edits and reorderings, so an offset can be kept against it. */
  id: string;
  /** A name from the icon catalogue (see icons/catalog.ts). */
  iconName: string;
  /** The icon's finished width across its own ink. Icons are drawn on a square grid, so this is effectively its size. */
  widthMm: number;
  /** Must stay at least the pocket depth, or the icon would sit entirely inside its own recess. */
  depthMm: number;
}

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

  /** Every ornament on the piece, in the order they were added. Only what shapes their glyphs — which icon, how wide, how thick. */
  decorators: DecoratorConfig[];

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
   * How far the name is tilted across the initial, in degrees (positive tilts
   * it up to the right). Turns about the name's own center, so changing it
   * tilts the name in place instead of swinging it off the letter. The pocket
   * is cut from the rotated silhouette, so the recess always matches.
   */
  nameAngleDeg: number;

  /**
   * Where each decorator sits on the initial, keyed by decorator id — draggable
   * in the preview, exactly like the name.
   *
   * Keyed rather than positional so removing one ornament can't silently shift
   * every later one's position onto the wrong icon.
   */
  decoratorOffsets: Record<string, Offset2D>;

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
  /** Cosmetic only — the physical colors come from the filaments. */
  initialColor: string;
  nameColor: string;
  /**
   * The base rail's own color. The rail is merged into the initial and prints
   * as one piece, but since these print standing up the rail is the first
   * layers — so a filament swap partway up really does produce a
   * differently-colored base, and the preview can show it.
   */
  standColor: string;
}
