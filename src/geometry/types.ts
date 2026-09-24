export type PickId = 'word';

export interface StickOffset {
  x: number;
  y: number;
}

/** The fields that drive the expensive, async, font-dependent geometry build. Stick
 * fields are deliberately excluded — repositioning/resizing a stick must stay cheap
 * and never re-trigger font extrusion. */
export interface MainGeometryConfig {
  /** 1-3 lines of text, stacked top to bottom, sharing one font/scale — see textGeometry.ts. */
  lines: string[];
  wordFontId: string;
  /** Target width of the widest line, in millimeters — drives the shared scale of every line. */
  sizeMm: number;
  extrudeDepthMm: number;
}

export interface TopperConfig extends MainGeometryConfig {
  stickLengthMm: number;
  stickWidthMm: number;
  stickEmbedMm: number;
  /** Where each pick's sticks attach, in mm from that pick's own local origin —
   * one or more per pick, each independently draggable. */
  stickOffsets: Record<PickId, StickOffset[]>;
  /**
   * Extra horizontal shift (mm), applied on top of the font's own kerning, at
   * each letter-to-letter gap within a line — one array per line (indexed the
   * same as `lines`); within a line, index i adjusts the gap between letter i
   * and letter i+1, and (since positions are cumulative) cascades to every
   * letter after it too. Each line's array is always length
   * `lines[i].length - 1`; reset to all zeros whenever that line's text (or
   * the line count) changes (see topperStore's setConfig).
   */
  letterGapsMm: number[][];
  /**
   * Each line's draggable (x, y) position, on top of its baked-in natural
   * stacked position (see textGeometry.ts) — index-aligned with `lines`.
   * Unlike a stick's offset, a line has no "must stay attached" constraint, so
   * this is never clamped.
   */
  lineOffsets: StickOffset[];
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
   * The outer boundary of each of this glyph's disconnected shapes, in the
   * same mm-space/natural-position convention as `geometry`. Almost always
   * one contour; a glyph like "i"/"j" has two (the stem and the dot). Some
   * script fonts draw a letter's counter (the hole in "a"/"e"/"o"...) as a
   * single self-approaching contour rather than a separate hole subpath;
   * Clipper's own polygon offsetting (see outline.ts) discovers that as a
   * genuine hole with no extra pre-processing needed. See outline.ts, which
   * is the only consumer of this.
   */
  outlineContours: import('three').Vector2[][];
}

export interface LineGeometry {
  /** This line's letters, in reading order — no stick, no gap/line-offset
   * overrides baked in (same convention as Pick.letters used to be). */
  letters: LetterGeometry[];
}

export interface Pick {
  id: PickId;
  label: string;
  /** One or more stacked lines of text (see textGeometry.ts for how they
   * share one scale/baseline). Sticks are generated separately, and both
   * within-line gap overrides and per-line position offsets are applied as
   * a position offset at render/export time, both cheap and synchronous so
   * neither has to re-run font extrusion. */
  lines: LineGeometry[];
}
