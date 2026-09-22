export type PickId = 'word' | 'number' | 'accent';

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
  number: string;
  numberFontId: string;
  accentShapeId: string | null;
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
  /** Cosmetic only — the physical color comes from 3D printer filament, not the file. */
  previewColor: string;
}

export interface Pick {
  id: PickId;
  label: string;
  /** The letters/shape only — no stick. The stick is generated separately (cheap,
   * synchronous) so it can be repositioned live without re-running font extrusion. */
  mainGeometry: import('three').BufferGeometry;
}
