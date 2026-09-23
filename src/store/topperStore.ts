import { create } from 'zustand';
import type { MainGeometryConfig, PickId, StickOffset, TopperConfig } from '../geometry/types';

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
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  stickOffsets: { word: [{ x: 0, y: 0 }] },
  previewColor: COLOR_PRESETS[2].hex,
};

/** Horizontal spacing (mm) used to offset a newly added stick from the previous one, so it doesn't start out exactly overlapping. */
const NEW_STICK_SPACING_MM = 15;
/** Sanity cap — matches the disabled state of the "+" button in StickControls, enforced here too in case of other future callers. */
const MAX_STICKS_PER_PICK = 5;

interface TopperStore extends TopperConfig {
  setConfig: (partial: Partial<TopperConfig>) => void;
  setStickOffset: (pickId: PickId, index: number, offset: StickOffset) => void;
  addStick: (pickId: PickId) => void;
  removeStick: (pickId: PickId, index: number) => void;
  reset: () => void;
}

export const useTopperStore = create<TopperStore>((set) => ({
  ...DEFAULT_CONFIG,
  setConfig: (partial) => set(partial),
  setStickOffset: (pickId, index, offset) =>
    set((state) => ({
      stickOffsets: {
        ...state.stickOffsets,
        [pickId]: state.stickOffsets[pickId].map((existing, i) => (i === index ? offset : existing)),
      },
    })),
  addStick: (pickId) =>
    set((state) => {
      const existing = state.stickOffsets[pickId];
      if (existing.length >= MAX_STICKS_PER_PICK) return {};
      const last = existing[existing.length - 1];
      const next: StickOffset = { x: (last?.x ?? 0) + NEW_STICK_SPACING_MM, y: last?.y ?? 0 };
      return { stickOffsets: { ...state.stickOffsets, [pickId]: [...existing, next] } };
    }),
  removeStick: (pickId, index) =>
    set((state) => {
      const existing = state.stickOffsets[pickId];
      if (existing.length <= 1) return {}; // always keep at least one stick per pick
      return { stickOffsets: { ...state.stickOffsets, [pickId]: existing.filter((_, i) => i !== index) } };
    }),
  reset: () => set(DEFAULT_CONFIG),
}));

/** The subset that drives the expensive async geometry build — excludes stick fields on purpose. */
export function selectMainGeometryConfig(state: TopperStore): MainGeometryConfig {
  const { word, wordFontId, sizeMm, extrudeDepthMm } = state;
  return { word, wordFontId, sizeMm, extrudeDepthMm };
}

/** The stick-related fields the scene needs to render/reposition sticks — cheap to recompute on every change. */
export function selectStickConfig(
  state: TopperStore,
): Pick<TopperConfig, 'stickLengthMm' | 'stickWidthMm' | 'stickEmbedMm' | 'stickOffsets' | 'extrudeDepthMm'> {
  const { stickLengthMm, stickWidthMm, stickEmbedMm, stickOffsets, extrudeDepthMm } = state;
  return { stickLengthMm, stickWidthMm, stickEmbedMm, stickOffsets, extrudeDepthMm };
}

/** The full config — used by the controls panel (needs every field) and export (needs everything to merge sticks). */
export function selectTopperConfig(state: TopperStore): TopperConfig {
  const { word, wordFontId, sizeMm, extrudeDepthMm, stickLengthMm, stickWidthMm, stickEmbedMm, stickOffsets, previewColor } = state;
  return {
    word,
    wordFontId,
    sizeMm,
    extrudeDepthMm,
    stickLengthMm,
    stickWidthMm,
    stickEmbedMm,
    stickOffsets,
    previewColor,
  };
}
