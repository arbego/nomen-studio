import { create } from 'zustand';
import type { Offset2D } from '../../geometry/types';
import type { StandMode } from '../../geometry/baseGeometry';
import { presetColor } from '../../ui/presets';
import { iconDefaultWidthMm } from '../../icons/catalog';
import type { DecoratorConfig, DecoratorPlacementConfig, IconDecoratorConfig, NameDisplayBlocksConfig, NameDisplayConfig, TextDecoratorConfig } from './config';

/** One gap slot per pair of adjacent letters, all starting untouched (0mm extra). */
function defaultLetterGaps(name: string): number[] {
  return new Array(Math.max(name.length - 1, 0)).fill(0);
}

const DEFAULT_NAME = 'Matilde';

/** What an icon arrives at when its own set has no opinion — roughly the size of a letter of the name. A word has to be wider to be legible at all, so it arrives wider. */
export const DEFAULT_DECORATOR_WIDTH_MM = 25;
export const DEFAULT_TEXT_DECORATOR_WIDTH_MM = 60;
export const DEFAULT_DECORATOR_DEPTH_MM = 5;
/** What a text ornament starts out saying — placeholder enough to be obviously meant for replacing, real enough to be visible and draggable. */
export const DEFAULT_DECORATOR_TEXT = 'Text';

/** What an ornament is, as asked for — everything else about a new one is defaulted below. */
export type NewDecorator = { kind: 'icon'; iconName: string } | { kind: 'text'; text?: string };

/**
 * Where a newly added ornament lands: the initial's upper middle, clear of where
 * the name sits by default, and stepped diagonally per ornament already on the
 * piece so a second one is visibly a second one rather than hidden under the
 * first. Untouched by default — an ornament is added straight, and turned after.
 */
function defaultDecoratorPlacement(existingCount: number): DecoratorPlacementConfig {
  return { offset: { x: 30 + existingCount * 12, y: 85 - existingCount * 12 }, angleDeg: 0 };
}

// Ids only have to be unique within a session — nothing is persisted, and they
// exist so an offset can be kept against an ornament across edits and removals.
let nextDecoratorId = 0;
function newDecoratorId(): string {
  nextDecoratorId += 1;
  return `decorator-${nextDecoratorId}`;
}

/** Also the shape a loaded project file is read against — see project.ts. */
export const DEFAULT_NAME_DISPLAY_CONFIG: NameDisplayConfig = {
  initial: 'M',
  initialFontId: 'alfa-slab-one',
  initialHeightMm: 120,
  initialDepthMm: 12,
  initialColor: presetColor('altrosa'),

  name: DEFAULT_NAME,
  nameFontId: 'dancing-script',
  nameWidthMm: 150,
  nameDepthMm: 5,
  nameColor: presetColor('white'),
  // Centered horizontally (both blocks are x-centered on their own origin) and
  // sitting across the initial's lower middle, as these displays are usually laid out.
  nameOffset: { x: 0, y: 35 },
  nameLetterGapsMm: defaultLetterGaps(DEFAULT_NAME),
  nameAngleDeg: 0,

  decorators: [],
  decoratorPlacements: {},
  decoratorColors: {},

  pocketDepthMm: 2.5,
  pocketClearanceMm: 0.25,

  standMode: 'none',
  standColor: presetColor('altrosa'),
  railHeightMm: 8,
  railDepthMm: 25,
  railMarginMm: 4,
  trimOffsetMm: 0,
};

/**
 * An edit to one ornament.
 *
 * Every field of either kind is optional and none of them is `kind` itself: what
 * an ornament *is* is fixed when it is added — "turn this heart into the word
 * Mia" is not an edit anyone makes, it is adding a different ornament — so a
 * patch can only ever change the details of the kind it already has.
 */
export type DecoratorPatch = Partial<Omit<IconDecoratorConfig, 'id' | 'kind'> & Omit<TextDecoratorConfig, 'id' | 'kind'>>;

interface NameDisplayStore extends NameDisplayConfig {
  setConfig: (partial: Partial<NameDisplayConfig>) => void;
  setNameOffset: (offset: Offset2D) => void;
  setNameLetterGap: (gapIndex: number, gapMm: number) => void;
  resetNameLetterGaps: () => void;
  setStandMode: (mode: StandMode) => void;
  addDecorator: (source: NewDecorator) => void;
  updateDecorator: (id: string, patch: DecoratorPatch) => void;
  removeDecorator: (id: string) => void;
  setDecoratorOffset: (id: string, offset: Offset2D) => void;
  setDecoratorAngle: (id: string, angleDeg: number) => void;
  setDecoratorColor: (id: string, color: string) => void;
  /** Replaces the whole design at once, from a project file. Deliberately not setConfig: its corrections exist to keep an *edit* coherent, and would fight a design that is already coherent. */
  loadConfig: (config: NameDisplayConfig) => void;
  reset: () => void;
}

export const useNameDisplayStore = create<NameDisplayStore>((set) => ({
  ...DEFAULT_NAME_DISPLAY_CONFIG,
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
  addDecorator: (source) =>
    set((state) => {
      const id = newDecoratorId();
      // Never thinner than the recess it drops into, or the ornament would sit
      // entirely inside its own pocket and show nothing.
      const depthMm = Math.max(DEFAULT_DECORATOR_DEPTH_MM, state.pocketDepthMm);
      const decorator: DecoratorConfig =
        source.kind === 'text'
          ? // In the name's face, so a word added to the piece looks like it
            // belongs to it; changeable right there in the panel if not.
            { kind: 'text', id, text: source.text ?? DEFAULT_DECORATOR_TEXT, fontId: state.nameFontId, widthMm: DEFAULT_TEXT_DECORATOR_WIDTH_MM, depthMm }
          : // Its own set's idea of a good starting size: a drawn icon needs
            // more width than a solid one before its strokes are printable.
            { kind: 'icon', id, iconName: source.iconName, widthMm: iconDefaultWidthMm(source.iconName), depthMm };

      return {
        decorators: [...state.decorators, decorator],
        decoratorPlacements: { ...state.decoratorPlacements, [id]: defaultDecoratorPlacement(state.decorators.length) },
        // In the inlay filament to begin with, like the name it sits beside —
        // set explicitly rather than left to the fallback so the color picker
        // opens showing which swatch is in use.
        decoratorColors: { ...state.decoratorColors, [id]: state.nameColor },
      };
    }),
  updateDecorator: (id, patch) =>
    set((state) => ({
      decorators: state.decorators.map((decorator) =>
        decorator.id === id
          ? // Same rule as the name's thickness: an ornament thinner than the
            // pocket would be swallowed by it. The control stops there too, so
            // this only catches a value arriving from elsewhere.
            //
            // Cast because a patch is the union of both kinds' fields, which TS
            // can't see staying inside the union once spread — `kind` is not in
            // a patch, so whichever kind this ornament was, it still is.
            ({ ...decorator, ...patch, depthMm: Math.max(patch.depthMm ?? decorator.depthMm, state.pocketDepthMm) } as DecoratorConfig)
          : decorator,
      ),
    })),
  removeDecorator: (id) =>
    set((state) => {
      // Its placement and its color go with it, so a later ornament can never
      // inherit a position or a filament that was meant for a removed one.
      const { [id]: _removedPlacement, ...decoratorPlacements } = state.decoratorPlacements;
      const { [id]: _removedColor, ...decoratorColors } = state.decoratorColors;
      return { decorators: state.decorators.filter((decorator) => decorator.id !== id), decoratorPlacements, decoratorColors };
    }),
  setDecoratorOffset: (id, offset) => set((state) => ({ decoratorPlacements: { ...state.decoratorPlacements, [id]: { ...state.decoratorPlacements[id], offset } } })),
  setDecoratorAngle: (id, angleDeg) => set((state) => ({ decoratorPlacements: { ...state.decoratorPlacements, [id]: { ...state.decoratorPlacements[id], angleDeg } } })),
  setDecoratorColor: (id, color) => set((state) => ({ decoratorColors: { ...state.decoratorColors, [id]: color } })),
  loadConfig: (config) => {
    // Ids from the file share a namespace with the ones this session hands out,
    // so the counter is moved past them — otherwise the next ornament added
    // could be given an id a loaded one is already using, and the two would
    // share a placement.
    for (const decorator of config.decorators) {
      const loaded = /^decorator-(\d+)$/.exec(decorator.id);
      if (loaded) {
        nextDecoratorId = Math.max(nextDecoratorId, Number(loaded[1]));
      }
    }
    set(config);
  },
  reset: () => set(DEFAULT_NAME_DISPLAY_CONFIG),
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
    decoratorPlacements,
    decoratorColors,
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
    decoratorPlacements,
    decoratorColors,
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
