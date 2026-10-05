import { asArray, asBoolean, asNumber, asNumberArray, asOffset, asString, asStringArray, element, field } from '../../project/coerce';
import type { CakeTopperDecoratorConfig, DecoratorPlacementConfig } from './config';
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

    ...decoratorsFrom(raw),
  };
}

/** The most ornaments one topper can carry. A cap so a hand-edited file can't ask for a thousand font builds. */
const MAX_DECORATORS = 20;

/**
 * The ornaments, their placements and their colours, read together.
 *
 * Together because the three are keyed by the same ids: a placement for an
 * ornament that isn't there is a placement nothing will ever use, and an
 * ornament with no placement would sit at the origin with no way to tell why.
 */
function decoratorsFrom(raw: unknown): Pick<CakeTopperConfig, 'decorators' | 'decoratorPlacements' | 'decoratorColors'> {
  const decorators = asArray<CakeTopperDecoratorConfig>(
    field(raw, 'decorators'),
    (item) => {
      const id = asString(field(item, 'id'), '', 64);
      const iconName = asString(field(item, 'iconName'), '', 100);
      if (!id || !iconName) return null;
      return {
        id,
        iconName,
        widthMm: asNumber(field(item, 'widthMm'), DEFAULT_CAKE_TOPPER_CONFIG.sizeMm / 5, { min: 2, max: 200 }),
        depthMm: asNumber(field(item, 'depthMm'), 3, { min: 0.5, max: 50 }),
      };
    },
    MAX_DECORATORS,
  );

  const decoratorPlacements: Record<string, DecoratorPlacementConfig> = {};
  const decoratorColors: Record<string, string> = {};
  for (const decorator of decorators) {
    const placement = field(field(raw, 'decoratorPlacements'), decorator.id);
    decoratorPlacements[decorator.id] = {
      offset: asOffset(field(placement, 'offset'), ORIGIN),
      angleDeg: asNumber(field(placement, 'angleDeg'), 0, { min: -180, max: 180 }),
    };
    const color = asString(field(field(raw, 'decoratorColors'), decorator.id), '', 32);
    if (color) decoratorColors[decorator.id] = color;
  }
  return { decorators, decoratorPlacements, decoratorColors };
}

export const cakeTopperProjectIO: ProductProject = {
  snapshot: (): ProjectSnapshot => {
    const config = selectCakeTopperConfig(useCakeTopperStore.getState());
    return { name: config.lines.join(' '), design: config };
  },
  load: (raw) => useCakeTopperStore.getState().loadConfig(parseCakeTopperConfig(raw)),
};
