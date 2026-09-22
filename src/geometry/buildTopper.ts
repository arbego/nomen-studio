import type { Pick, TopperConfig } from './types';
import { textToGeometry } from './textGeometry';
import { accentShapeToGeometry } from './shapeGeometry';
import { stickToGeometry } from './stickGeometry';
import { combinePickGeometry } from './combine';

// The word's sizeMm is the one user-facing size control; the number and accent
// are proportioned relative to it, matching the reference product's look. These
// ratios are the only place that scaling relationship lives.
const NUMBER_WIDTH_RATIO = 0.4;
const ACCENT_WIDTH_RATIO = 0.28;

/** Builds every pick (word, number, optional accent) for a topper config, each a single merged, printable solid. */
export async function buildTopperPicks(config: TopperConfig): Promise<Pick[]> {
  const stickCommon = {
    widthMm: config.stickWidthMm,
    thicknessMm: config.extrudeDepthMm,
    lengthMm: config.stickLengthMm,
    embedMm: config.stickEmbedMm,
  };

  const [wordMain, numberMain] = await Promise.all([
    textToGeometry(config.word, config.wordFontId, config.sizeMm, config.extrudeDepthMm),
    textToGeometry(config.number, config.numberFontId, config.sizeMm * NUMBER_WIDTH_RATIO, config.extrudeDepthMm),
  ]);

  const picks: Pick[] = [
    {
      id: 'word',
      label: config.word,
      geometry: combinePickGeometry(wordMain, stickToGeometry(stickCommon)),
    },
    {
      id: 'number',
      label: config.number,
      geometry: combinePickGeometry(numberMain, stickToGeometry(stickCommon)),
    },
  ];

  if (config.accentShapeId) {
    const accentMain = accentShapeToGeometry(config.accentShapeId, config.sizeMm * ACCENT_WIDTH_RATIO, config.extrudeDepthMm);
    picks.push({
      id: 'accent',
      label: config.accentShapeId,
      geometry: combinePickGeometry(accentMain, stickToGeometry(stickCommon)),
    });
  }

  return picks;
}
