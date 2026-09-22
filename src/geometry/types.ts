export type PickId = 'word' | 'number' | 'accent';

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
  /** Horizontal offset (mm, from each pick's own center) of where its stick attaches — user-set by clicking the piece in the 3D preview. */
  stickOffsets: Record<PickId, number>;
  /** Cosmetic only — the physical color comes from 3D printer filament, not the file. */
  previewColor: string;
}

export interface Pick {
  id: PickId;
  label: string;
  geometry: import('three').BufferGeometry;
}
