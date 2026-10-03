import { create } from 'zustand';
import type { Offset2D } from '../../geometry/types';
import type { StandMode } from '../../geometry/baseGeometry';
import { COLOR_PRESETS } from '../../ui/presets';
import type { NameDisplayConfig, NameDisplayGeometryConfig } from './config';

/** One gap slot per pair of adjacent letters, all starting untouched (0mm extra). */
function defaultLetterGaps(name: string): number[] {
  return new Array(Math.max(name.length - 1, 0)).fill(0);
}

const DEFAULT_NAME = 'Matilde';

const DEFAULT_CONFIG: NameDisplayConfig = {
  initial: 'M',
  initialFontId: 'alfa-slab-one',
  initialHeightMm: 120,
  initialDepthMm: 12,
  initialColor: COLOR_PRESETS[3].hex,

  name: DEFAULT_NAME,
  nameFontId: 'dancing-script',
  nameWidthMm: 150,
  nameDepthMm: 5,
  nameColor: COLOR_PRESETS[0].hex,
  // Centered horizontally (both blocks are x-centered on their own origin) and
  // sitting across the initial's lower middle, as these displays are usually laid out.
  nameOffset: { x: 0, y: 35 },
  nameLetterGapsMm: defaultLetterGaps(DEFAULT_NAME),

  pocketDepthMm: 2.5,
  pocketClearanceMm: 0.25,

  standMode: 'none',
  railHeightMm: 8,
  railDepthMm: 25,
  railMarginMm: 4,
  trimOffsetMm: 0,
};

interface NameDisplayStore extends NameDisplayConfig {
  setConfig: (partial: Partial<NameDisplayConfig>) => void;
  setNameOffset: (offset: Offset2D) => void;
  setNameLetterGap: (gapIndex: number, gapMm: number) => void;
  resetNameLetterGaps: () => void;
  setStandMode: (mode: StandMode) => void;
  reset: () => void;
}

export const useNameDisplayStore = create<NameDisplayStore>((set) => ({
  ...DEFAULT_CONFIG,
  setConfig: (partial) =>
    set((state) => {
      // Per-letter gap tweaks are a fine-tuning pass over specific glyph shapes
      // at specific positions, so a different string or a different face makes
      // them meaningless rather than merely stale — same reasoning as the cake
      // topper's store.
      const nameChanged = partial.name !== undefined && partial.name !== state.name;
      const fontChanged = partial.nameFontId !== undefined && partial.nameFontId !== state.nameFontId;
      if (nameChanged || fontChanged) {
        return { ...partial, nameLetterGapsMm: defaultLetterGaps(partial.name ?? state.name) };
      }
      // The name has to stay thicker than the recess it sits in, or it would
      // vanish into the initial — keep the pocket from overtaking it. (The
      // build caps this again, since config can reach it from elsewhere too.)
      if (partial.nameDepthMm !== undefined && partial.nameDepthMm < state.pocketDepthMm) {
        return { ...partial, pocketDepthMm: partial.nameDepthMm };
      }
      return partial;
    }),
  setNameOffset: (nameOffset) => set({ nameOffset }),
  setNameLetterGap: (gapIndex, gapMm) =>
    set((state) => ({
      nameLetterGapsMm: state.nameLetterGapsMm.map((existing, i) => (i === gapIndex ? gapMm : existing)),
    })),
  resetNameLetterGaps: () => set((state) => ({ nameLetterGapsMm: defaultLetterGaps(state.name) })),
  setStandMode: (standMode) => set({ standMode }),
  reset: () => set(DEFAULT_CONFIG),
}));

/** The subset that drives the expensive async build — everything but the two preview colors. */
export function selectNameDisplayGeometryConfig(state: NameDisplayStore): NameDisplayGeometryConfig {
  const {
    initial,
    initialFontId,
    initialHeightMm,
    initialDepthMm,
    name,
    nameFontId,
    nameWidthMm,
    nameDepthMm,
    nameOffset,
    nameLetterGapsMm,
    pocketDepthMm,
    pocketClearanceMm,
    standMode,
    railHeightMm,
    railDepthMm,
    railMarginMm,
    trimOffsetMm,
  } = state;
  return {
    initial,
    initialFontId,
    initialHeightMm,
    initialDepthMm,
    name,
    nameFontId,
    nameWidthMm,
    nameDepthMm,
    nameOffset,
    nameLetterGapsMm,
    pocketDepthMm,
    pocketClearanceMm,
    standMode,
    railHeightMm,
    railDepthMm,
    railMarginMm,
    trimOffsetMm,
  };
}

/** The full config — the controls panel and export need the colors too. */
export function selectNameDisplayConfig(state: NameDisplayStore): NameDisplayConfig {
  return { ...selectNameDisplayGeometryConfig(state), initialColor: state.initialColor, nameColor: state.nameColor };
}
