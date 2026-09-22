export interface TopperConfig {
  word: string;
  wordFontId: string;
  number: string;
  numberFontId: string;
  accentShapeId: string | null;
  /** Target width of the word pick, in millimeters — drives the scale of the whole design. */
  sizeMm: number;
  extrudeDepthMm: number;
  stickLengthMm: number;
  stickWidthMm: number;
  stickEmbedMm: number;
  /** Cosmetic only — the physical color comes from 3D printer filament, not the file. */
  previewColor: string;
}

export type PickId = 'word' | 'number' | 'accent';

export interface Pick {
  id: PickId;
  label: string;
  geometry: import('three').BufferGeometry;
}
