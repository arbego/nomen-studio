export interface MagnetConfig {
  diameterMm: number;
  thicknessMm: number;
  /** Bottom of the cavity measured from the flat printed back. */
  heightMm: number;
  /** null requests deterministic placement inside this letter. */
  position: { x: number; y: number } | null;
}

export interface StickyNameConfig {
  name: string;
  fontId: string;
  theme: 'bubble';
  letterHeightMm: number;
  depthMm: number;
  spacingMm: number;
  bubble: { roundnessMm: number; inflation: number };
  /** Indexed by Unicode character, including spaces; repeated letters are independent. */
  magnets: MagnetConfig[][];
  clearanceMm: number;
  previewColor: string;
}

export const MAX_LETTERS = 20;
export const MAX_MAGNETS = 6;
export const MIN_WALL_MM = 0.8;
export const DEFAULT_MAGNET: MagnetConfig = { diameterMm: 6, thicknessMm: 2, heightMm: 1, position: null };
export const DEFAULT_STICKY_NAME_CONFIG: StickyNameConfig = {
  name: 'EMMA', fontId: 'coiny', theme: 'bubble', letterHeightMm: 45, depthMm: 12, spacingMm: 5,
  bubble: { roundnessMm: 1.5, inflation: 0.7 }, magnets: [[], [], [], []],
  clearanceMm: 0.2, previewColor: '#a8cddd',
};
