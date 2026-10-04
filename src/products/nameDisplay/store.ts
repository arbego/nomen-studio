import { create } from 'zustand';
import type { Offset2D } from '../../geometry/types';
import type { StandMode } from '../../geometry/baseGeometry';
import { COLOR_PRESETS } from '../../ui/presets';
import type { DecoratorConfig, NameDisplayBlocksConfig, NameDisplayConfig } from './config';

/** One gap slot per pair of adjacent letters, all starting untouched (0mm extra). */
function defaultLetterGaps(name: string): number[] {
  return new Array(Math.max(name.length - 1, 0)).fill(0);
}

const DEFAULT_NAME = 'Matilde';

export const DEFAULT_DECORATOR_WIDTH_MM = 25;
export const DEFAULT_DECORATOR_DEPTH_MM = 5;

/**
 * Where a newly added ornament lands: the initial's upper middle, clear of where
 * the name sits by default, and stepped diagonally per ornament already on the
 * piece so a second one is visibly a second one rather than hidden under the
 * first.
 */
function defaultDecoratorOffset(existingCount: number) {
  return { x: 30 + existingCount * 12, y: 85 - existingCount * 12 };
}

// Ids only have to be unique within a session — nothing is persisted, and they
// exist so an offset can be kept against an ornament across edits and removals.
let nextDecoratorId = 0;
function newDecoratorId(): string {
  nextDecoratorId += 1;
  return `decorator-${nextDecoratorId}`;
}

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

  decorators: [],
  decoratorOffsets: {},

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
  addDecorator: (iconName: string) => void;
  updateDecorator: (id: string, patch: Partial<Omit<DecoratorConfig, 'id'>>) => void;
  removeDecorator: (id: string) => void;
  setDecoratorOffset: (id: string, offset: Offset2D) => void;
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

      // Everything inlaid has to stay thicker than the recess it sits in, or it
      // would vanish into the initial — the name and every ornament alike, since
      // they all seat on the same pocket floor. (The build caps this again,
      // since config can reach it from elsewhere too — but leaving it
      // uncorrected here would show a permanently "capped" slider the user
      // never asked for.)
      const nameDepth = partial.nameDepthMm ?? state.nameDepthMm;
      const pocketDepth = partial.pocketDepthMm ?? state.pocketDepthMm;
      const thinnestInlay = Math.min(nameDepth, ...state.decorators.map((decorator) => decorator.depthMm));
      if (pocketDepth > thinnestInlay) {
        next.pocketDepthMm = thinnestInlay;
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
  addDecorator: (iconName) =>
    set((state) => {
      const id = newDecoratorId();
      return {
        decorators: [
          ...state.decorators,
          // Never thinner than the recess it drops into, or the ornament would
          // sit entirely inside its own pocket and show nothing.
          { id, iconName, widthMm: DEFAULT_DECORATOR_WIDTH_MM, depthMm: Math.max(DEFAULT_DECORATOR_DEPTH_MM, state.pocketDepthMm) },
        ],
        decoratorOffsets: { ...state.decoratorOffsets, [id]: defaultDecoratorOffset(state.decorators.length) },
      };
    }),
  updateDecorator: (id, patch) =>
    set((state) => ({
      decorators: state.decorators.map((decorator) =>
        decorator.id === id
          ? // Same rule as the name's thickness: an ornament thinner than the
            // pocket would be swallowed by it. The control stops there too, so
            // this only catches a value arriving from elsewhere.
            { ...decorator, ...patch, depthMm: Math.max(patch.depthMm ?? decorator.depthMm, state.pocketDepthMm) }
          : decorator,
      ),
    })),
  removeDecorator: (id) =>
    set((state) => {
      // The offset goes with it, so a later ornament can never inherit a
      // position that was meant for a removed one.
      const { [id]: _removed, ...decoratorOffsets } = state.decoratorOffsets;
      return { decorators: state.decorators.filter((decorator) => decorator.id !== id), decoratorOffsets };
    }),
  setDecoratorOffset: (id, offset) => set((state) => ({ decoratorOffsets: { ...state.decoratorOffsets, [id]: offset } })),
  reset: () => set(DEFAULT_CONFIG),
}));

/** Only what changes the glyphs — the async build's key. Excludes the name's position and gaps on purpose, so dragging it never re-extrudes the fonts. */
export function selectNameDisplayBlocksConfig(state: NameDisplayStore): NameDisplayBlocksConfig {
  const { initial, initialFontId, initialHeightMm, initialDepthMm, name, nameFontId, nameWidthMm, nameDepthMm, decorators, standMode, trimOffsetMm } = state;
  return { initial, initialFontId, initialHeightMm, initialDepthMm, name, nameFontId, nameWidthMm, nameDepthMm, decorators, standMode, trimOffsetMm };
}

/** The full config — the controls panel, the synchronous assembly and export all need everything. */
export function selectNameDisplayConfig(state: NameDisplayStore): NameDisplayConfig {
  const {
    nameOffset,
    nameLetterGapsMm,
    nameAngleDeg,
    decoratorOffsets,
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
    decoratorOffsets,
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
