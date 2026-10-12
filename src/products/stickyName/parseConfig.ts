import { asNumber, asString, element, field } from '../../project/coerce';
import { getCatalogEntry } from '../../fonts/catalog';
import { DEFAULT_MAGNET, DEFAULT_STICKY_NAME_CONFIG as DEFAULT, MAX_LETTERS, MAX_MAGNETS, type MagnetConfig, type StickyNameConfig } from './config';

export function parseMagnet(raw: unknown): MagnetConfig {
  const p = field(raw, 'position');
  return {
    diameterMm: asNumber(field(raw, 'diameterMm'), DEFAULT_MAGNET.diameterMm, { min: 1, max: 30 }),
    thicknessMm: asNumber(field(raw, 'thicknessMm'), DEFAULT_MAGNET.thicknessMm, { min: 0.5, max: 10 }),
    heightMm: asNumber(field(raw, 'heightMm'), DEFAULT_MAGNET.heightMm, { min: 0.8, max: 30 }),
    position: p && typeof field(p, 'x') === 'number' && typeof field(p, 'y') === 'number'
      ? { x: asNumber(field(p, 'x'), 0, { min: -200, max: 200 }), y: asNumber(field(p, 'y'), 0, { min: -200, max: 200 }) } : null,
  };
}

export function parseStickyNameConfig(raw: unknown): StickyNameConfig {
  const name = Array.from(asString(field(raw, 'name'), DEFAULT.name, 80).normalize('NFC')).slice(0, MAX_LETTERS).join('');
  const fontId = asString(field(raw, 'fontId'), DEFAULT.fontId, 100);
  const color = asString(field(raw, 'previewColor'), DEFAULT.previewColor, 7);
  const bubble = field(raw, 'bubble');
  return {
    name, fontId: getCatalogEntry(fontId) ? fontId : DEFAULT.fontId, theme: 'bubble',
    letterHeightMm: asNumber(field(raw, 'letterHeightMm'), DEFAULT.letterHeightMm, { min: 20, max: 120 }),
    depthMm: asNumber(field(raw, 'depthMm'), DEFAULT.depthMm, { min: 4, max: 30 }),
    spacingMm: asNumber(field(raw, 'spacingMm'), DEFAULT.spacingMm, { min: 2, max: 30 }),
    bubble: {
      roundnessMm: asNumber(field(bubble, 'roundnessMm'), DEFAULT.bubble.roundnessMm, { min: 0, max: 4 }),
      inflation: asNumber(field(bubble, 'inflation'), DEFAULT.bubble.inflation, { min: 0.2, max: 1 }),
    },
    magnets: Array.from(name, (char, i) => {
      const entries = element(field(raw, 'magnets'), i);
      return /\s/u.test(char) || !Array.isArray(entries) ? [] : entries.slice(0, MAX_MAGNETS).map(parseMagnet);
    }),
    clearanceMm: asNumber(field(raw, 'clearanceMm'), DEFAULT.clearanceMm, { min: 0, max: 0.6 }),
    previewColor: /^#[\da-f]{6}$/i.test(color) ? color : DEFAULT.previewColor,
  };
}
