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

/** One gap slot per pair of adjacent letters, all starting untouched (0mm extra). */
function defaultLetterGaps(line: string): number[] {
  return new Array(Math.max(line.length - 1, 0)).fill(0);
}

const DEFAULT_LINE = 'Emma';
/** One base line plus up to 2 more — matches the "+" button's disabled state in LinesControls. */
const MAX_LINES = 3;

const DEFAULT_CONFIG: TopperConfig = {
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
const MAX_STICKS_PER_PICK = 5;

interface TopperStore extends TopperConfig {
  setConfig: (partial: Partial<TopperConfig>) => void;
  setStickOffset: (pickId: PickId, index: number, offset: StickOffset) => void;
  addStick: (pickId: PickId) => void;
  removeStick: (pickId: PickId, index: number) => void;
  setLineText: (index: number, text: string) => void;
  addLine: () => void;
  removeLine: (index: number) => void;
  setLineOffset: (index: number, offset: StickOffset) => void;
  setLetterGap: (lineIndex: number, gapIndex: number, gapMm: number) => void;
  resetLetterGaps: () => void;
  toggleClosedOutlineHole: (key: string) => void;
  reset: () => void;
}

export const useTopperStore = create<TopperStore>((set) => ({
  ...DEFAULT_CONFIG,
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
  reset: () => set(DEFAULT_CONFIG),
}));

/** The subset that drives the expensive async geometry build — excludes stick and letter-gap/line-offset fields on purpose. */
export function selectMainGeometryConfig(state: TopperStore): MainGeometryConfig {
  const { lines, wordFontId, sizeMm, extrudeDepthMm } = state;
  return { lines, wordFontId, sizeMm, extrudeDepthMm };
}

/** The full config — used by the controls panel (needs every field) and export (needs everything to merge sticks). */
export function selectTopperConfig(state: TopperStore): TopperConfig {
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
