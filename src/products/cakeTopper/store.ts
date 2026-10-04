import { create } from 'zustand';
import type { Offset2D } from '../../geometry/types';
import { COLOR_PRESETS } from '../../ui/presets';
import type { CakeTopperConfig, CakeTopperGeometryConfig, CakeTopperBlockId } from './config';

/** One gap slot per pair of adjacent letters, all starting untouched (0mm extra). */
function defaultLetterGaps(line: string): number[] {
  return new Array(Math.max(line.length - 1, 0)).fill(0);
}

const DEFAULT_LINE = 'Emma';
/** One base line plus up to 2 more — matches the "+" button's disabled state in LinesControls. */
const MAX_LINES = 3;

/** Also the shape a loaded project file is read against — see project.ts. */
export const DEFAULT_CAKE_TOPPER_CONFIG: CakeTopperConfig = {
  lines: [DEFAULT_LINE],
  wordFontId: 'dancing-script',
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  stickOffsets: { word: [{ x: 0, y: 0 }] },
  letterGapsMm: [defaultLetterGaps(DEFAULT_LINE)],
  lineOffsets: [{ x: 0, y: 0 }],
  previewColor: COLOR_PRESETS[2].hex,
  outlineEnabled: false,
  outlineGrowMm: 3,
  outlineColor: COLOR_PRESETS[0].hex,
  outlineDepthMm: 1.5,
  closedOutlineHoles: [],
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
  loadConfig: (config) => set(config),
  reset: () => set(DEFAULT_CAKE_TOPPER_CONFIG),
}));

/** The subset that drives the expensive async geometry build — excludes stick and letter-gap/line-offset fields on purpose. */
export function selectCakeTopperGeometryConfig(state: CakeTopperStore): CakeTopperGeometryConfig {
  const { lines, wordFontId, sizeMm, extrudeDepthMm } = state;
  return { lines, wordFontId, sizeMm, extrudeDepthMm };
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
  };
}
