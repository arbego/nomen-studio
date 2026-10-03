import { create } from 'zustand';
import type { Offset2D } from '../../geometry/types';
import type { StandMode } from '../../geometry/baseGeometry';
import { COLOR_PRESETS } from '../../ui/presets';
import type { NameDisplayBlocksConfig, NameDisplayConfig } from './config';

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
  nameAngleDeg: 0,

  pocketDepthMm: 2.5,
  pocketClearanceMm: 0.25,

  standMode: 'none',
  standColor: COLOR_PRESETS[3].hex,
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
      // Both corrections below have to compose, not pick one: a single call can
      // change the name *and* its thickness.
      const next: Partial<NameDisplayConfig> = { ...partial };

      // Per-letter gap tweaks are a fine-tuning pass over specific glyph shapes
      // at specific positions, so a different string or a different face makes
      // them meaningless rather than merely stale — same reasoning as the cake
      // topper's store.
      const nameChanged = partial.name !== undefined && partial.name !== state.name;
      const fontChanged = partial.nameFontId !== undefined && partial.nameFontId !== state.nameFontId;
      if (nameChanged || fontChanged) {
        next.nameLetterGapsMm = defaultLetterGaps(partial.name ?? state.name);
      }

      // The name has to stay thicker than the recess it sits in, or it would
      // vanish into the initial. (The build caps this again, since config can
      // reach it from elsewhere too — but leaving it uncorrected here would
      // show a permanently "capped" slider the user never asked for.)
      const nameDepth = partial.nameDepthMm ?? state.nameDepthMm;
      const pocketDepth = partial.pocketDepthMm ?? state.pocketDepthMm;
      if (pocketDepth > nameDepth) {
        next.pocketDepthMm = nameDepth;
      }

      return next;
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

/** Only what changes the glyphs — the async build's key. Excludes the name's position and gaps on purpose, so dragging it never re-extrudes the fonts. */
export function selectNameDisplayBlocksConfig(state: NameDisplayStore): NameDisplayBlocksConfig {
  const { initial, initialFontId, initialHeightMm, initialDepthMm, name, nameFontId, nameWidthMm, nameDepthMm, standMode, trimOffsetMm } = state;
  return { initial, initialFontId, initialHeightMm, initialDepthMm, name, nameFontId, nameWidthMm, nameDepthMm, standMode, trimOffsetMm };
}

/** The full config — the controls panel, the synchronous assembly and export all need everything. */
export function selectNameDisplayConfig(state: NameDisplayStore): NameDisplayConfig {
  const {
    nameOffset,
    nameLetterGapsMm,
    nameAngleDeg,
    pocketDepthMm,
    pocketClearanceMm,
    railHeightMm,
    railDepthMm,
    railMarginMm,
    initialColor,
    nameColor,
    standColor,
  } = state;
  return {
    ...selectNameDisplayBlocksConfig(state),
    nameOffset,
    nameLetterGapsMm,
    nameAngleDeg,
    pocketDepthMm,
    pocketClearanceMm,
    railHeightMm,
    railDepthMm,
    railMarginMm,
    initialColor,
    nameColor,
    standColor,
  };
}
