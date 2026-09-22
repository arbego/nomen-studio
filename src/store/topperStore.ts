import { create } from 'zustand';
import type { PickId, TopperConfig } from '../geometry/types';

export const SIZE_PRESETS_MM = [100, 120, 150] as const;

export const COLOR_PRESETS = [
  { id: 'white', label: 'Weiß', hex: '#f7f5f2' },
  { id: 'beige', label: 'Beige', hex: '#e8d9c3' },
  { id: 'rosa', label: 'Rosa', hex: '#f0c6d0' },
  { id: 'altrosa', label: 'Altrosa', hex: '#d9a9ab' },
  { id: 'sage', label: 'Sage', hex: '#b7c4ac' },
  { id: 'black', label: 'Schwarz', hex: '#2b2b2b' },
] as const;

const DEFAULT_CONFIG: TopperConfig = {
  word: 'Emma',
  wordFontId: 'dancing-script',
  number: '6',
  numberFontId: 'quicksand',
  accentShapeId: 'heart',
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  stickOffsets: { word: 0, number: 0, accent: 0 },
  previewColor: COLOR_PRESETS[2].hex,
};

interface TopperStore extends TopperConfig {
  setConfig: (partial: Partial<TopperConfig>) => void;
  setStickOffset: (pickId: PickId, offsetXMm: number) => void;
  reset: () => void;
}

export const useTopperStore = create<TopperStore>((set) => ({
  ...DEFAULT_CONFIG,
  setConfig: (partial) => set(partial),
  setStickOffset: (pickId, offsetXMm) =>
    set((state) => ({ stickOffsets: { ...state.stickOffsets, [pickId]: offsetXMm } })),
  reset: () => set(DEFAULT_CONFIG),
}));

/** Pulls just the fields that affect generated geometry, for effect dependency arrays. */
export function selectTopperConfig(state: TopperStore): TopperConfig {
  const {
    word,
    wordFontId,
    number,
    numberFontId,
    accentShapeId,
    sizeMm,
    extrudeDepthMm,
    stickLengthMm,
    stickWidthMm,
    stickEmbedMm,
    stickOffsets,
    previewColor,
  } = state;
  return {
    word,
    wordFontId,
    number,
    numberFontId,
    accentShapeId,
    sizeMm,
    extrudeDepthMm,
    stickLengthMm,
    stickWidthMm,
    stickEmbedMm,
    stickOffsets,
    previewColor,
  };
}
