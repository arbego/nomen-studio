import { create } from 'zustand';
import { createDesignHistory } from '../../store/designHistory';
import type { Offset2D } from '../../geometry/types';
import { presetColor } from '../../ui/presets';
import { iconDefaultWidthMm } from '../../icons/catalog';
import type { CakeTopperConfig, CakeTopperDecoratorConfig, DecoratorPlacementConfig, CakeTopperGeometryConfig, CakeTopperBlockId } from './config';

/** One gap slot per pair of adjacent letters, all starting untouched (0mm extra). */
function defaultLetterGaps(line: string): number[] {
  return new Array(Math.max(line.length - 1, 0)).fill(0);
}

/** One base line plus up to 2 more — matches the "+" button's disabled state in LinesControls. */
const MAX_LINES = 3;

/** What a new ornament starts out as, before anything is dragged or dialled. Thick enough to print as its own piece rather than a sheet of foil. */
const DEFAULT_DECORATOR_DEPTH_MM = 3;

/**
 * Where a newly added ornament lands: above the lettering and a little to the
 * right of centre, stepped diagonally per ornament already on the piece so a
 * second one is visibly a second one rather than hidden under the first.
 */
function defaultDecoratorPlacement(existingCount: number): DecoratorPlacementConfig {
  return { offset: { x: 20 + existingCount * 12, y: 40 - existingCount * 12 }, angleDeg: 0 };
}

// Ids only have to be unique within a session. They exist so a placement and a
// colour can be kept against an ornament across edits and removals.
let nextDecoratorId = 0;
function newDecoratorId(): string {
  nextDecoratorId += 1;
  return `decorator-${nextDecoratorId}`;
}

/**
 * Moves the counter past every id in a design that was not minted in this
 * session, so the next ornament added cannot be handed one that is already in
 * use — the two would then share a placement and a colour.
 */
function reserveDecoratorIds(decorators: readonly CakeTopperDecoratorConfig[]): void {
  for (const decorator of decorators) {
    const minted = /^decorator-(\d+)$/.exec(decorator.id);
    if (minted) {
      nextDecoratorId = Math.max(nextDecoratorId, Number(minted[1]));
    }
  }
}

/**
 * The design the studio opens on: a finished three-line birthday topper rather
 * than a bare word, so that what the controls can do — several lines, each
 * dragged where it reads best, a tightened letter pair, two picks placed under
 * the heavy parts, the outline card behind it all — is on screen before anyone
 * has touched a slider.
 *
 * Laid out in the studio and saved back out of it, which is why the positions
 * are the awkward numbers they are (rounded to 0.01mm, far below anything a
 * nozzle can resolve). Every array already holds to the invariants the store
 * maintains: one gap slot per pair of adjacent letters in its own line, and one
 * offset per line.
 *
 * Also the shape a loaded project file is read against — see project.ts.
 */
export const DEFAULT_CAKE_TOPPER_CONFIG: CakeTopperConfig = {
  lines: ['Happy', '3', 'Lara'],
  wordFontId: 'dancing-script',
  sizeMm: 150,
  extrudeDepthMm: 3,
  stickLengthMm: 40,
  stickWidthMm: 3,
  stickEmbedMm: 15,
  stickOffsets: {
    word: [
      { x: -74.74, y: 92.63 },
      { x: 28.59, y: 107.98 },
    ],
  },
  letterGapsMm: [[-2.71, 0, 0, 0], [], [0, 0, 0]],
  lineOffsets: [
    { x: -10.65, y: -47.29 },
    { x: 19.64, y: -18.22 },
    { x: -19.17, y: 30.37 },
  ],
  previewColor: presetColor('lilac'),
  outlineEnabled: true,
  outlineGrowMm: 3,
  outlineColor: presetColor('white'),
  outlineDepthMm: 1.5,
  closedOutlineHoles: [],
  decorators: [],
  decoratorPlacements: {},
  decoratorColors: {},
};

/** Horizontal spacing (mm) used to offset a newly added stick from the previous one, so it doesn't start out exactly overlapping. */
const NEW_STICK_SPACING_MM = 15;
/** Sanity cap — matches the disabled state of the "+" button in StickControls, enforced here too in case of other future callers. */
const MAX_STICKS_PER_BLOCK = 5;

interface CakeTopperStore extends CakeTopperConfig {
  setConfig: (partial: Partial<CakeTopperConfig>) => void;
  setStickOffset: (blockId: CakeTopperBlockId, index: number, offset: Offset2D) => void;
  addStick: (blockId: CakeTopperBlockId) => void;
  removeStick: (blockId: CakeTopperBlockId, index: number) => void;
  setSticksEnabled: (blockId: CakeTopperBlockId, enabled: boolean) => void;
  setLineText: (index: number, text: string) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  setLineOffset: (index: number, offset: Offset2D) => void;
  setLetterGap: (lineIndex: number, gapIndex: number, gapMm: number) => void;
  resetLetterGaps: () => void;
  toggleClosedOutlineHole: (key: string) => void;
  /** Returns the new ornament's id, so the grid that added it can go on changing that one instead of adding more. */
  addDecorator: (iconName: string) => string;
  updateDecorator: (id: string, patch: Partial<Omit<CakeTopperDecoratorConfig, 'id'>>) => void;
  removeDecorator: (id: string) => void;
  setDecoratorOffset: (id: string, offset: Offset2D) => void;
  setDecoratorAngle: (id: string, angleDeg: number) => void;
  setDecoratorColor: (id: string, color: string) => void;
  /** Fills a whole set of holes in at once, or opens them all — "fill all in" over the checklist. */
  setClosedOutlineHoles: (keys: string[], closed: boolean) => void;
  /** Replaces the whole design at once, from a project file. Deliberately not setConfig: its corrections exist to keep an *edit* coherent, and would fight a design that is already coherent. */
  loadConfig: (config: CakeTopperConfig) => void;
  reset: () => void;
}

export const useCakeTopperStore = create<CakeTopperStore>((set) => ({
  ...DEFAULT_CAKE_TOPPER_CONFIG,
  setConfig: (partial) =>
    set((state) => {
      // Per-letter gap tweaks and manually-closed outline holes are both a
      // fine-tuning pass keyed by letter position over specific glyph shapes —
      // re-mapping either onto a new font is ambiguous, so both reset rather
      // than risk stale/misapplied overrides. (Editing a line's own text is
      // handled by setLineText below, which resets just that line.)
      const fontChanged = partial.wordFontId !== undefined && partial.wordFontId !== state.wordFontId;
      if (fontChanged) {
        return {
          ...partial,
          letterGapsMm: state.lines.map((line) => defaultLetterGaps(line)),
          closedOutlineHoles: [],
        };
      }
      // The outline card's own thickness is capped at the word's (see
      // OutlineControls' maxDepthMm) so it can never grow flush with (and hide)
      // the letters — shrinking the word below the card's current thickness
      // would silently break that invariant unless the card shrinks with it.
      if (partial.extrudeDepthMm !== undefined && partial.extrudeDepthMm < state.outlineDepthMm) {
        return { ...partial, outlineDepthMm: partial.extrudeDepthMm };
      }
      return partial;
    }),
  setStickOffset: (blockId, index, offset) =>
    set((state) => ({
      stickOffsets: {
        ...state.stickOffsets,
        [blockId]: state.stickOffsets[blockId].map((existing, i) => (i === index ? offset : existing)),
      },
    })),
  addStick: (blockId) =>
    set((state) => {
      const existing = state.stickOffsets[blockId];
      if (existing.length >= MAX_STICKS_PER_BLOCK) return {};
      const last = existing[existing.length - 1];
      const next: Offset2D = { x: (last?.x ?? 0) + NEW_STICK_SPACING_MM, y: last?.y ?? 0 };
      return { stickOffsets: { ...state.stickOffsets, [blockId]: [...existing, next] } };
    }),
  removeStick: (blockId, index) =>
    set((state) => {
      const existing = state.stickOffsets[blockId];
      if (existing.length <= 0) return {};
      return { stickOffsets: { ...state.stickOffsets, [blockId]: existing.filter((_, i) => i !== index) } };
    }),
  setSticksEnabled: (blockId, enabled) =>
    set((state) => {
      const existing = state.stickOffsets[blockId];
      if (enabled) {
        if (existing.length > 0) return {};
        return { stickOffsets: { ...state.stickOffsets, [blockId]: [{ x: 0, y: 0 }] } };
      }
      if (existing.length === 0) return {};
      return { stickOffsets: { ...state.stickOffsets, [blockId]: [] } };
    }),
  setLineText: (index, text) =>
    set((state) => ({
      lines: state.lines.map((line, i) => (i === index ? text : line)),
      // A different string at this line invalidates its own gap overrides
      // (and any hole the checklist attributed to one of its letters), but
      // every other line is unaffected.
      letterGapsMm: state.letterGapsMm.map((gaps, i) => (i === index ? defaultLetterGaps(text) : gaps)),
      closedOutlineHoles: state.closedOutlineHoles.filter((key) => !key.startsWith(`line-${index}-`)),
    })),
  addLine: () =>
    set((state) => {
      if (state.lines.length >= MAX_LINES) return {};
      return {
        lines: [...state.lines, ''],
        letterGapsMm: [...state.letterGapsMm, []],
        lineOffsets: [...state.lineOffsets, { x: 0, y: 0 }],
      };
    }),
  removeLine: (index) =>
    set((state) => {
      if (state.lines.length <= 1) return {}; // always keep at least one line
      return {
        lines: state.lines.filter((_, i) => i !== index),
        letterGapsMm: state.letterGapsMm.filter((_, i) => i !== index),
        lineOffsets: state.lineOffsets.filter((_, i) => i !== index),
        // Every closed-hole key at or after the removed line either no longer
        // applies or now refers to the wrong (shifted) line index — simplest
        // and safest is to drop them all rather than risk a mismatched one.
        closedOutlineHoles: [],
      };
    }),
  setLineOffset: (index, offset) =>
    set((state) => ({
      lineOffsets: state.lineOffsets.map((existing, i) => (i === index ? offset : existing)),
    })),
  setLetterGap: (lineIndex, gapIndex, gapMm) =>
    set((state) => ({
      letterGapsMm: state.letterGapsMm.map((gaps, i) => (i === lineIndex ? gaps.map((existing, gi) => (gi === gapIndex ? gapMm : existing)) : gaps)),
    })),
  resetLetterGaps: () => set((state) => ({ letterGapsMm: state.lines.map((line) => defaultLetterGaps(line)) })),
  toggleClosedOutlineHole: (key) =>
    set((state) => ({
      closedOutlineHoles: state.closedOutlineHoles.includes(key)
        ? state.closedOutlineHoles.filter((existing) => existing !== key)
        : [...state.closedOutlineHoles, key],
    })),
  setClosedOutlineHoles: (keys, closed) =>
    set((state) => {
      const touched = new Set(keys);
      // Keys outside the set are left exactly as they are: holes come and go
      // with the grow, and one the checklist cannot currently see is not one
      // the user just said anything about.
      const untouched = state.closedOutlineHoles.filter((existing) => !touched.has(existing));
      return { closedOutlineHoles: closed ? [...untouched, ...keys] : untouched };
    }),
  addDecorator: (iconName) => {
    // Minted outside the updater so it can be returned: the caller needs to
    // know which ornament this was, and an updater's return value is the state.
    const id = newDecoratorId();
    set((state) => ({
      // Its own set's idea of a good starting size — a drawn icon needs more
      // width than a solid one before its strokes are printable.
      decorators: [...state.decorators, { id, iconName, widthMm: iconDefaultWidthMm(iconName), depthMm: DEFAULT_DECORATOR_DEPTH_MM }],
      decoratorPlacements: { ...state.decoratorPlacements, [id]: defaultDecoratorPlacement(state.decorators.length) },
      // In the lettering's filament to begin with, set explicitly rather than
      // left to the fallback so the colour picker opens showing which swatch is
      // in use.
      decoratorColors: { ...state.decoratorColors, [id]: state.previewColor },
    }));
    return id;
  },
  updateDecorator: (id, patch) =>
    set((state) => ({ decorators: state.decorators.map((decorator) => (decorator.id === id ? { ...decorator, ...patch } : decorator)) })),
  removeDecorator: (id) =>
    set((state) => {
      // Its placement and its colour go with it, so a later ornament can never
      // inherit a position or a filament meant for a removed one.
      const { [id]: _removedPlacement, ...decoratorPlacements } = state.decoratorPlacements;
      const { [id]: _removedColor, ...decoratorColors } = state.decoratorColors;
      return { decorators: state.decorators.filter((decorator) => decorator.id !== id), decoratorPlacements, decoratorColors };
    }),
  setDecoratorOffset: (id, offset) =>
    set((state) => ({ decoratorPlacements: { ...state.decoratorPlacements, [id]: { ...state.decoratorPlacements[id], offset } } })),
  setDecoratorAngle: (id, angleDeg) =>
    set((state) => ({ decoratorPlacements: { ...state.decoratorPlacements, [id]: { ...state.decoratorPlacements[id], angleDeg } } })),
  setDecoratorColor: (id, color) => set((state) => ({ decoratorColors: { ...state.decoratorColors, [id]: color } })),
  loadConfig: (config) => {
    reserveDecoratorIds(config.decorators);
    set(config);
  },
  reset: () => set(DEFAULT_CAKE_TOPPER_CONFIG),
}));

/** The subset that drives the expensive async geometry build — excludes stick and letter-gap/line-offset fields on purpose. */
export function selectCakeTopperGeometryConfig(state: CakeTopperStore): CakeTopperGeometryConfig {
  const { lines, wordFontId, sizeMm, extrudeDepthMm, decorators } = state;
  return { lines, wordFontId, sizeMm, extrudeDepthMm, decorators };
}

/** The full config — used by the controls panel (needs every field) and export (needs everything to merge sticks). */
export function selectCakeTopperConfig(state: CakeTopperStore): CakeTopperConfig {
  const {
    lines,
    wordFontId,
    sizeMm,
    extrudeDepthMm,
    stickLengthMm,
    stickWidthMm,
    stickEmbedMm,
    stickOffsets,
    letterGapsMm,
    lineOffsets,
    previewColor,
    outlineEnabled,
    outlineGrowMm,
    outlineColor,
    outlineDepthMm,
    closedOutlineHoles,
    decorators,
    decoratorPlacements,
    decoratorColors,
  } = state;
  return {
    lines,
    wordFontId,
    sizeMm,
    extrudeDepthMm,
    stickLengthMm,
    stickWidthMm,
    stickEmbedMm,
    stickOffsets,
    letterGapsMm,
    lineOffsets,
    previewColor,
    outlineEnabled,
    outlineGrowMm,
    outlineColor,
    outlineDepthMm,
    closedOutlineHoles,
    decorators,
    decoratorPlacements,
    decoratorColors,
  };
}

export const cakeTopperHistory = createDesignHistory(useCakeTopperStore, selectCakeTopperConfig);
