import { asArray, asNumber, asNumberArray, asOffset, asOneOf, asString, field } from '../../project/coerce';
import { STAND_MODES } from '../../geometry/baseGeometry';
import { getIcon } from '../../icons/catalog';
import type { ProductProject, ProjectSnapshot } from '../types';
import { DEFAULT_NAME_DISPLAY_CONFIG, useNameDisplayStore, selectNameDisplayConfig } from './store';
import type { DecoratorConfig, DecoratorPlacementConfig, NameDisplayConfig } from './config';

const ORIGIN = { x: 0, y: 0 };

/**
 * One ornament out of a file, or null if there is nothing usable left of it.
 *
 * An ornament naming an icon this build doesn't have is dropped rather than
 * substituted: a design that quietly comes back with a different symbol on it
 * is worse than one that comes back without it.
 */
function parseDecorator(raw: unknown, index: number): DecoratorConfig | null {
  const iconName = asString(field(raw, 'iconName'), '', 100);
  try {
    getIcon(iconName);
  } catch {
    return null;
  }
  return {
    id: asString(field(raw, 'id'), '', 100) || `decorator-loaded-${index}`,
    iconName,
    widthMm: asNumber(field(raw, 'widthMm'), 25, { min: 1, max: 400 }),
    depthMm: asNumber(field(raw, 'depthMm'), 5, { min: 0.1, max: 50 }),
  };
}

/**
 * A name display read out of a project file.
 *
 * Beyond coercing each field, this holds the two invariants a file could
 * otherwise break: the name's gap array is one slot per letter pair, and every
 * ornament has exactly one placement — ornaments without one get a default,
 * placements without an ornament are dropped rather than left to accumulate.
 */
export function parseNameDisplayConfig(raw: unknown): NameDisplayConfig {
  const defaults = DEFAULT_NAME_DISPLAY_CONFIG;
  const name = asString(field(raw, 'name'), defaults.name, 20);
  const decorators = asArray(field(raw, 'decorators'), parseDecorator, 50);
  const nameDepthMm = asNumber(field(raw, 'nameDepthMm'), defaults.nameDepthMm, { min: 0.1, max: 50 });

  const rawPlacements = field(raw, 'decoratorPlacements');
  const decoratorPlacements: Record<string, DecoratorPlacementConfig> = {};
  for (const decorator of decorators) {
    const placement = field(rawPlacements, decorator.id);
    decoratorPlacements[decorator.id] = {
      offset: asOffset(field(placement, 'offset'), ORIGIN),
      angleDeg: asNumber(field(placement, 'angleDeg'), 0, { min: -180, max: 180 }),
    };
  }

  const gaps = asNumberArray(field(raw, 'nameLetterGapsMm'), { min: -200, max: 200 });

  return {
    initial: asString(field(raw, 'initial'), defaults.initial, 1),
    initialFontId: asString(field(raw, 'initialFontId'), defaults.initialFontId, 100),
    initialHeightMm: asNumber(field(raw, 'initialHeightMm'), defaults.initialHeightMm, { min: 10, max: 500 }),
    initialDepthMm: asNumber(field(raw, 'initialDepthMm'), defaults.initialDepthMm, { min: 1, max: 100 }),
    initialColor: asString(field(raw, 'initialColor'), defaults.initialColor, 32),

    name,
    nameFontId: asString(field(raw, 'nameFontId'), defaults.nameFontId, 100),
    nameWidthMm: asNumber(field(raw, 'nameWidthMm'), defaults.nameWidthMm, { min: 10, max: 600 }),
    nameDepthMm,
    nameColor: asString(field(raw, 'nameColor'), defaults.nameColor, 32),
    nameOffset: asOffset(field(raw, 'nameOffset'), defaults.nameOffset),
    nameLetterGapsMm: Array.from({ length: Math.max(name.length - 1, 0) }, (_, i) => gaps[i] ?? 0),
    nameAngleDeg: asNumber(field(raw, 'nameAngleDeg'), defaults.nameAngleDeg, { min: -180, max: 180 }),

    decorators,
    decoratorPlacements,

    // Capped at the thinnest thing seated in it, exactly as the store caps it on
    // every edit — a file could otherwise describe a pocket that swallows what
    // drops into it.
    pocketDepthMm: Math.min(
      asNumber(field(raw, 'pocketDepthMm'), defaults.pocketDepthMm, { min: 0, max: 50 }),
      nameDepthMm,
      ...decorators.map((decorator) => decorator.depthMm),
    ),
    pocketClearanceMm: asNumber(field(raw, 'pocketClearanceMm'), defaults.pocketClearanceMm, { min: 0, max: 5 }),

    standMode: asOneOf(field(raw, 'standMode'), STAND_MODES, defaults.standMode),
    standColor: asString(field(raw, 'standColor'), defaults.standColor, 32),
    railHeightMm: asNumber(field(raw, 'railHeightMm'), defaults.railHeightMm, { min: 0.1, max: 100 }),
    railDepthMm: asNumber(field(raw, 'railDepthMm'), defaults.railDepthMm, { min: 0.1, max: 200 }),
    railMarginMm: asNumber(field(raw, 'railMarginMm'), defaults.railMarginMm, { min: 0, max: 100 }),
    trimOffsetMm: asNumber(field(raw, 'trimOffsetMm'), defaults.trimOffsetMm, { min: -200, max: 200 }),
  };
}

export const nameDisplayProjectIO: ProductProject = {
  snapshot: (): ProjectSnapshot => {
    const config = selectNameDisplayConfig(useNameDisplayStore.getState());
    return { name: config.name, design: config };
  },
  load: (raw) => useNameDisplayStore.getState().loadConfig(parseNameDisplayConfig(raw)),
};
