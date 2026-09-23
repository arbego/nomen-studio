export type PickId = 'word';

export interface StickOffset {
  x: number;
  y: number;
}

/** The fields that drive the expensive, async, font-dependent geometry build. Stick
 * fields are deliberately excluded — repositioning/resizing a stick must stay cheap
 * and never re-trigger font extrusion. */
export interface MainGeometryConfig {
  word: string;
  wordFontId: string;
  /** Target width of the word pick, in millimeters — drives the scale of the whole design. */
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
   * each letter-to-letter gap — index i adjusts the gap between letter i and
   * letter i+1, and (since positions are cumulative) cascades to every letter
   * after it too. Always length `word.length - 1`; reset to all zeros whenever
   * `word` changes (see topperStore's setConfig).
   */
  letterGapsMm: number[];
  /** Cosmetic only — the physical color comes from 3D printer filament, not the file. */
  previewColor: string;
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
}

export interface Pick {
  id: PickId;
  label: string;
  /** One independently watertight solid per letter — no stick, no gap overrides
   * baked in. Sticks are generated separately, and gap overrides are applied as
   * a position offset at render/export time, both cheap and synchronous so
   * neither has to re-run font extrusion. */
  letters: LetterGeometry[];
}
