import { create } from 'zustand';
import { createDesignHistory } from '../../store/designHistory';
import type { Offset2D } from '../../geometry/types';
import type { StandMode } from '../../geometry/baseGeometry';
import { presetColor } from '../../ui/presets';
import { iconDefaultWidthMm } from '../../icons/catalog';
import { inlayDepthsMm, minimumHollowDepthMm, type DecoratorConfig, type DecoratorPlacementConfig, type IconDecoratorConfig, type NameDisplayBlocksConfig, type NameDisplayConfig, type TextDecoratorConfig } from './config';

/** One gap slot per pair of adjacent letters, all starting untouched (0mm extra). */
function defaultLetterGaps(name: string): number[] {
  return new Array(Math.max(name.length - 1, 0)).fill(0);
}

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

/**
 * Moves the counter past every id in a design that was not minted in this
 * session — otherwise the next ornament added could be handed an id one of them
 * is already using, and the two would share a placement and a color.
 *
 * Both the design the studio opens on and any design opened from a file arrive
 * with ids of their own, so both go through here.
 */
function reserveDecoratorIds(decorators: readonly DecoratorConfig[]): void {
  for (const decorator of decorators) {
    const minted = /^decorator-(\d+)$/.exec(decorator.id);
    if (minted) {
      nextDecoratorId = Math.max(nextDecoratorId, Number(minted[1]));
    }
  }
}

/**
 * The design the studio opens on: a finished piece rather than a bare monogram,
 * so that what this product can do — the name tilted across the initial and
 * inlaid into it, an ornament dropped in beside it in a third filament — is on
 * screen before anyone has touched a slider.
 *
 * Laid out in the studio and saved back out of it, which is why the positions
 * are the awkward numbers they are (rounded to 0.01mm, far below anything a
 * nozzle can resolve). It holds to the same invariants the store maintains: one
 * gap slot per pair of adjacent letters of the name, and one placement and one
 * color per ornament.
 *
 * Also the shape a loaded project file is read against — see project.ts.
 */
export const DEFAULT_NAME_DISPLAY_CONFIG: NameDisplayConfig = {
  initial: 'L',
  initialFontId: 'calistoga',
  initialHeightMm: 140,
  initialDepthMm: 12,
  initialColor: presetColor('sky'),
  hollowEnabled: false,
  wallThicknessMm: 2,
  lidThicknessMm: 3,
  lidClearanceMm: 0.25,
  lidColor: presetColor('altrosa'),
  cableHoleEnabled: false,
  cableHoleDiameterMm: 6,
  cableHolePlacement: null,

  name: 'Liam',
  nameFontId: 'dancing-script',
  nameWidthMm: 117,
  nameDepthMm: 3,
  nameColor: presetColor('white'),
  nameOffset: { x: -2.37, y: 9.77 },
  nameLetterGapsMm: [0, 0, 0],
  nameAngleDeg: 8,

  decorators: [{ kind: 'icon', id: 'decorator-1', iconName: 'material:rocket_launch', widthMm: 21, depthMm: 3 }],
  decoratorPlacements: { 'decorator-1': { offset: { x: -6.39, y: 37.73 }, angleDeg: 0 } },
  decoratorColors: { 'decorator-1': presetColor('white') },

  pocketDepthMm: 1,
  pocketClearanceMm: 0.25,

  standMode: 'none',
  standColor: presetColor('altrosa'),
  railHeightMm: 8,
  railDepthMm: 25,
  railMarginMm: 4,
  railSocketDepthMm: 5,
  trimOffsetMm: 0,
};

reserveDecoratorIds(DEFAULT_NAME_DISPLAY_CONFIG.decorators);

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
  /** Preview only: fade the lid and inlays to see and interact with the bowl inside. */
  lidTransparent: boolean;
  setLidTransparent: (transparent: boolean) => void;
  setConfig: (partial: Partial<NameDisplayConfig>) => void;
  setNameOffset: (offset: Offset2D) => void;
  resetNamePosition: () => void;
  setNameLetterGap: (gapIndex: number, gapMm: number) => void;
  resetNameLetterGaps: () => void;
  setStandMode: (mode: StandMode) => void;
  /** Returns the new ornament's id, so a picker that stays open can go on editing the thing it just made. */
  addDecorator: (source: NewDecorator) => string;
  updateDecorator: (id: string, patch: DecoratorPatch) => void;
  removeDecorator: (id: string) => void;
  setDecoratorOffset: (id: string, offset: Offset2D) => void;
  resetDecoratorPosition: (id: string) => void;
  setDecoratorAngle: (id: string, angleDeg: number) => void;
  setDecoratorColor: (id: string, color: string) => void;
  /** Replaces the whole design at once, from a project file. Deliberately not setConfig: its corrections exist to keep an *edit* coherent, and would fight a design that is already coherent. */
  loadConfig: (config: NameDisplayConfig) => void;
  reset: () => void;
}

export const useNameDisplayStore = create<NameDisplayStore>((set) => ({
  ...DEFAULT_NAME_DISPLAY_CONFIG,
  lidTransparent: false,
  setLidTransparent: (lidTransparent) => set({ lidTransparent }),
  setConfig: (partial) =>
    set((state) => {
      // Both corrections below have to compose, not pick one: a single call can
      // change the name *and* its thickness.
      const next: Partial<NameDisplayConfig> = { ...partial };
      if (partial.cableHolePlacement === undefined && (
        (partial.initial !== undefined && partial.initial !== state.initial) ||
        (partial.initialFontId !== undefined && partial.initialFontId !== state.initialFontId) ||
        (partial.initialHeightMm !== undefined && partial.initialHeightMm !== state.initialHeightMm) ||
        (partial.trimOffsetMm !== undefined && partial.trimOffsetMm !== state.trimOffsetMm) ||
        (partial.standMode !== undefined && partial.standMode !== state.standMode && (partial.standMode === 'trim' || state.standMode === 'trim'))
      )) next.cableHolePlacement = null;
      const proposed = { ...state, ...partial };
      if (proposed.hollowEnabled) {
        next.initialDepthMm = Math.max(proposed.initialDepthMm, Math.ceil(minimumHollowDepthMm(proposed)));
      }

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
      const pocketDepth = partial.pocketDepthMm ?? state.pocketDepthMm;
      const thinnestInlay = Math.min(...inlayDepthsMm({ ...state, ...partial }));
      if (pocketDepth > thinnestInlay) {
        next.pocketDepthMm = thinnestInlay;
      }

      return next;
    }),
  setNameOffset: (nameOffset) => set({ nameOffset }),
  resetNamePosition: () => set({ nameOffset: { ...DEFAULT_NAME_DISPLAY_CONFIG.nameOffset } }),
  setNameLetterGap: (gapIndex, gapMm) =>
    set((state) => ({
      nameLetterGapsMm: state.nameLetterGapsMm.map((existing, i) => (i === gapIndex ? gapMm : existing)),
    })),
  resetNameLetterGaps: () => set((state) => ({ nameLetterGapsMm: defaultLetterGaps(state.name) })),
  setStandMode: (standMode) => set((state) => ({ standMode, ...(standMode !== state.standMode && (standMode === 'trim' || state.standMode === 'trim') ? { cableHolePlacement: null } : {}) })),
  addDecorator: (source) => {
    // Minted outside the updater so it can be returned: the caller needs to know
    // which ornament this was, and an updater's return value is the next state.
    const id = newDecoratorId();
    set((state) => {
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
    });
    return id;
  },
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
  resetDecoratorPosition: (id) => set((state) => {
    const index = state.decorators.findIndex((decorator) => decorator.id === id);
    if (index < 0) return {};
    const offset = DEFAULT_NAME_DISPLAY_CONFIG.decoratorPlacements[id]?.offset ?? defaultDecoratorPlacement(index).offset;
    return { decoratorPlacements: { ...state.decoratorPlacements, [id]: { ...state.decoratorPlacements[id], offset: { ...offset } } } };
  }),
  setDecoratorAngle: (id, angleDeg) => set((state) => ({ decoratorPlacements: { ...state.decoratorPlacements, [id]: { ...state.decoratorPlacements[id], angleDeg } } })),
  setDecoratorColor: (id, color) => set((state) => ({ decoratorColors: { ...state.decoratorColors, [id]: color } })),
  loadConfig: (config) => {
    reserveDecoratorIds(config.decorators);
    set({ ...config, lidTransparent: false });
  },
  reset: () => set({ ...DEFAULT_NAME_DISPLAY_CONFIG, lidTransparent: false }),
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
    railSocketDepthMm,
    initialColor,
    hollowEnabled,
    wallThicknessMm,
    lidThicknessMm,
    lidClearanceMm,
    lidColor,
    cableHoleEnabled,
    cableHoleDiameterMm,
    cableHolePlacement,
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
    railSocketDepthMm,
    initialColor,
    hollowEnabled,
    wallThicknessMm,
    lidThicknessMm,
    lidClearanceMm,
    lidColor,
    cableHoleEnabled,
    cableHoleDiameterMm,
    cableHolePlacement,
    nameColor,
    standColor,
  };
}

export const nameDisplayHistory = createDesignHistory(useNameDisplayStore, selectNameDisplayConfig);
