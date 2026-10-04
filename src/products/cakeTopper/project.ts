import { asArray, asBoolean, asNumber, asNumberArray, asOffset, asString, asStringArray, element, field } from '../../project/coerce';
import type { ProductProject, ProjectSnapshot } from '../types';
import { DEFAULT_CAKE_TOPPER_CONFIG, useCakeTopperStore, selectCakeTopperConfig } from './store';
import type { CakeTopperConfig } from './config';

const ORIGIN = { x: 0, y: 0 };

/**
 * A cake topper read out of a project file.
 *
 * Every field goes through a coercion against the defaults, so a file written
 * by an older release, hand-edited, or simply not a cake topper loads as a
 * sane design rather than as a crash or an invisible one. The two
 * position-keyed arrays are then trimmed to the lines they belong to, which is
 * the one invariant a file could otherwise break: the store and the geometry
 * both assume `letterGapsMm[i]` is the gaps of `lines[i]`.
 */
export function parseCakeTopperConfig(raw: unknown): CakeTopperConfig {
  const defaults = DEFAULT_CAKE_TOPPER_CONFIG;
  const lines = asStringArray(field(raw, 'lines'), 40).slice(0, 3);

  return {
    lines: lines.length > 0 ? lines : defaults.lines,
    wordFontId: asString(field(raw, 'wordFontId'), defaults.wordFontId, 100),
    sizeMm: asNumber(field(raw, 'sizeMm'), defaults.sizeMm, { min: 10, max: 400 }),
    extrudeDepthMm: asNumber(field(raw, 'extrudeDepthMm'), defaults.extrudeDepthMm, { min: 0.5, max: 50 }),

    stickLengthMm: asNumber(field(raw, 'stickLengthMm'), defaults.stickLengthMm, { min: 0, max: 300 }),
    stickWidthMm: asNumber(field(raw, 'stickWidthMm'), defaults.stickWidthMm, { min: 0.5, max: 50 }),
    stickEmbedMm: asNumber(field(raw, 'stickEmbedMm'), defaults.stickEmbedMm, { min: 0, max: 100 }),
    stickOffsets: { word: asArray(field(field(raw, 'stickOffsets'), 'word'), (item) => asOffset(item, ORIGIN), 5) },

    // One gap array per line, each exactly one shorter than its line.
    letterGapsMm: lines.map((line, i) => {
      const gaps = asNumberArray(element(field(raw, 'letterGapsMm'), i), { min: -200, max: 200 });
      return Array.from({ length: Math.max(line.length - 1, 0) }, (_, g) => gaps[g] ?? 0);
    }),
    lineOffsets: lines.map((_line, i) => asOffset(element(field(raw, 'lineOffsets'), i), ORIGIN)),

    previewColor: asString(field(raw, 'previewColor'), defaults.previewColor, 32),
    outlineEnabled: asBoolean(field(raw, 'outlineEnabled'), defaults.outlineEnabled),
    outlineGrowMm: asNumber(field(raw, 'outlineGrowMm'), defaults.outlineGrowMm, { min: 0, max: 50 }),
    outlineColor: asString(field(raw, 'outlineColor'), defaults.outlineColor, 32),
    outlineDepthMm: asNumber(field(raw, 'outlineDepthMm'), defaults.outlineDepthMm, { min: 0.1, max: 50 }),
    closedOutlineHoles: asStringArray(field(raw, 'closedOutlineHoles'), 64),
  };
}

export const cakeTopperProjectIO: ProductProject = {
  snapshot: (): ProjectSnapshot => {
    const config = selectCakeTopperConfig(useCakeTopperStore.getState());
    return { name: config.lines.join(' '), design: config };
  },
  load: (raw) => useCakeTopperStore.getState().loadConfig(parseCakeTopperConfig(raw)),
};
