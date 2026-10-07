import type { Offset2D } from '../../geometry/types';
import type { StandMode } from '../../geometry/baseGeometry';

/** The background initial and optional script name. Decorators are identified by their own ids. */
export type NameDisplayBlockId = 'initial' | 'name';

/** What an ornament is made of. An icon is a glyph and so is a letter, which is why both go down the one pipeline. */
export const DECORATOR_KINDS = ['icon', 'text'] as const;
export type DecoratorKind = (typeof DECORATOR_KINDS)[number];

/** As long as the name's own limit: an ornament is a date or a word or two, and every character of it has to be printed. Shared by the input and the file reader so the two agree. */
export const DECORATOR_TEXT_MAX_LENGTH = 20;

/**
 * What every ornament has, whatever it is made of.
 *
 * Where it sits, how it is turned and what color it is live apart from this —
 * in `decoratorPlacements` and `decoratorColors` — for the same reason the
 * name's position does: moving or recoloring one must not re-run the font build.
 */
interface DecoratorConfigBase {
  /** Stable across edits and reorderings, so an offset can be kept against it. */
  id: string;
  /** The ornament's finished width across its own ink. Icons are drawn on a square grid, so for one of those this is effectively its size. */
  widthMm: number;
  /** Must stay at least the pocket depth, or the ornament would sit entirely inside its own recess. */
  depthMm: number;
}

/** One ornament stamped into the initial alongside the name: a symbol from the icon catalogue (see icons/catalog.ts). */
export interface IconDecoratorConfig extends DecoratorConfigBase {
  kind: 'icon';
  iconName: string;
}

/**
 * A second piece of text on the piece — a date, a surname, "est. 2019" — free of
 * the name's one fixed place and inlaid the same way.
 *
 * It is an ornament rather than a second name field because that is what makes
 * it movable: everything in `decorators` is placed by dragging it where you want
 * it, while the name has the one spot the design is built around.
 */
export interface TextDecoratorConfig extends DecoratorConfigBase {
  kind: 'text';
  text: string;
  /** Its own face, so a date can be set in something other than the name's script. */
  fontId: string;
}

export type DecoratorConfig = IconDecoratorConfig | TextDecoratorConfig;

/** A hole centered on the bowl's exterior, drilled opposite its outward normal. */
export interface CableHolePlacement {
  point: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
}

/** Where one ornament ended up on the initial — the cheap half of a decorator, re-applied on every drag without touching a font. */
export interface DecoratorPlacementConfig {
  /** In the initial's own local mm space. */
  offset: Offset2D;
  /**
   * How far the ornament is turned, in degrees. Turns about its own center, so
   * changing it spins the icon in place rather than swinging it off the letter —
   * and the pocket is cut from the turned silhouette, so the recess follows.
   *
   * Unlike the name's angle this is unrestricted: a tilted word stops being
   * readable, an upside-down star is just a star.
   */
  angleDeg: number;
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

  /** The optional script name laid across the initial. Blank text omits it. Sized by width, since its length is what has to span the piece. */
  name: string;
  nameFontId: string;
  nameWidthMm: number;
  nameDepthMm: number;

  /** Every ornament on the piece, in the order they were added. Only what shapes their glyphs — which icon or which word, in which face, how wide, how thick. */
  decorators: DecoratorConfig[];

  /** A flat-bottom trim is here, not in the assembly config, because unlike the other standing modes it re-cuts the glyph silhouettes themselves. */
  standMode: StandMode;
  /** Shifts a flat-bottom trim off the typographic baseline — positive cuts higher. */
  trimOffsetMm: number;
}

/** The fields applied synchronously on top of the built blocks — all cheap enough to re-run on every drag commit. */
export interface NameDisplayAssemblyConfig {
  /** Turns the initial into a bowl with a separate, flush-fitting lid. */
  hollowEnabled: boolean;
  /** Thickness of the bowl's perimeter walls and back floor. */
  wallThicknessMm: number;
  lidThicknessMm: number;
  /** Clearance all round the lid, independent of the lettering's fit. */
  lidClearanceMm: number;
  cableHoleEnabled: boolean;
  cableHoleDiameterMm: number;
  /** Null selects a suitable position near the bottom of the back face. */
  cableHolePlacement: CableHolePlacement | null;
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
   * Where each decorator sits and how far it is turned, keyed by decorator id —
   * dragged into place in the preview, exactly like the name.
   *
   * Keyed rather than positional so removing one ornament can't silently shift
   * every later one's placement onto the wrong icon. Position and angle are one
   * record rather than two, so there is only ever one thing to keep in step with
   * the ornaments themselves.
   */
  decoratorPlacements: Record<string, DecoratorPlacementConfig>;

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
  /**
   * How far the initial sinks into its base rail.
   *
   * The rail has a socket cut into it shaped like the letter, so the two print
   * as separate pieces and go together afterwards — this is how deep that
   * socket is, measured from the letter's baseline up to the rail's top face.
   * Deeper holds better and hides more of the letter; the rail grows taller to
   * match, since its height is measured below the baseline either way.
   *
   * The fit is `pocketClearanceMm`, the same tolerance the name is inlaid with:
   * it describes the printer, not the joint.
   */
  railSocketDepthMm: number;
}

export interface NameDisplayConfig extends NameDisplayBlocksConfig, NameDisplayAssemblyConfig {
  /** Cosmetic only — the physical colors come from the filaments. */
  initialColor: string;
  lidColor: string;
  nameColor: string;
  /**
   * The base rail's own color. It prints as a piece of its own, with a socket
   * the initial drops into, so this is a real second filament rather than a
   * preview conceit.
   */
  standColor: string;
  /**
   * Each ornament's own color, keyed by id. Kept out of the ornaments themselves
   * so that recoloring one is the cheap edit it looks like, rather than
   * re-extruding every glyph on the piece — the same reason the name's color
   * sits apart from the name.
   *
   * An ornament with no entry here prints in the name's color; see
   * `decoratorColor`.
   */
  decoratorColors: Record<string, string>;
}

/** The ledge extends this far inward, rising by the same amount for a 45° ramp. */
export const HOLLOW_LEDGE_WIDTH_MM = 1.2;
/** Solid material above the ramp, avoiding a fragile knife edge at the seat. */
export const HOLLOW_LEDGE_WEB_MM = 0.4;
export const MIN_HOLLOW_CAVITY_DEPTH_MM = 1;

/** Leaves room for the floor, cavity, support ramp and lid within the initial. */
export function minimumHollowDepthMm(config: Pick<NameDisplayConfig, 'wallThicknessMm' | 'lidThicknessMm'>): number {
  return config.wallThicknessMm + MIN_HOLLOW_CAVITY_DEPTH_MM + HOLLOW_LEDGE_WIDTH_MM + HOLLOW_LEDGE_WEB_MM + config.lidThicknessMm;
}

/** Thicknesses of the inlays that actually exist, excluding blank text. */
export function inlayDepthsMm(config: Pick<NameDisplayBlocksConfig, 'name' | 'nameDepthMm' | 'decorators'>): number[] {
  return [
    ...(config.name.trim() ? [config.nameDepthMm] : []),
    ...config.decorators.filter((decorator) => decorator.kind !== 'text' || decorator.text.trim()).map((decorator) => decorator.depthMm),
  ];
}

/**
 * One ornament's color.
 *
 * Falls back to the name's rather than to a constant: ornaments drop into the
 * same pockets the name does and are usually run off in the same filament, so
 * that is both the right default for a new one and the right answer for a file
 * saved before ornaments had colors of their own.
 */
export function decoratorColor(config: NameDisplayConfig, id: string): string {
  return config.decoratorColors[id] ?? config.nameColor;
}
