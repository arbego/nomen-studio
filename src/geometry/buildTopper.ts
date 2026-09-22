import type { Pick, PickId, TopperConfig } from './types';
import { textToGeometry } from './textGeometry';
import { accentShapeToGeometry } from './shapeGeometry';
import { stickToGeometry, clampStickOffsetToBounds } from './stickGeometry';
import { combinePickGeometry } from './combine';
import type * as THREE from 'three';

// The word's sizeMm is the one user-facing size control; the number and accent
// are proportioned relative to it, matching the reference product's look. These
// ratios are the only place that scaling relationship lives.
const NUMBER_WIDTH_RATIO = 0.4;
const ACCENT_WIDTH_RATIO = 0.28;

function buildPick(id: PickId, label: string, mainGeometry: THREE.BufferGeometry, config: TopperConfig): Pick {
  const offsetXMm = clampStickOffsetToBounds(mainGeometry, config.stickOffsets[id], config.stickWidthMm);
  const stick = stickToGeometry({
    widthMm: config.stickWidthMm,
    thicknessMm: config.extrudeDepthMm,
    lengthMm: config.stickLengthMm,
    embedMm: config.stickEmbedMm,
    offsetXMm,
  });
  return { id, label, geometry: combinePickGeometry(mainGeometry, stick) };
}

/** Builds every pick (word, number, optional accent) for a topper config, each a single merged, printable solid. */
export async function buildTopperPicks(config: TopperConfig): Promise<Pick[]> {
  const [wordMain, numberMain] = await Promise.all([
    textToGeometry(config.word, config.wordFontId, config.sizeMm, config.extrudeDepthMm),
    textToGeometry(config.number, config.numberFontId, config.sizeMm * NUMBER_WIDTH_RATIO, config.extrudeDepthMm),
  ]);

  const picks: Pick[] = [buildPick('word', config.word, wordMain, config), buildPick('number', config.number, numberMain, config)];

  if (config.accentShapeId) {
    const accentMain = accentShapeToGeometry(config.accentShapeId, config.sizeMm * ACCENT_WIDTH_RATIO, config.extrudeDepthMm);
    picks.push(buildPick('accent', config.accentShapeId, accentMain, config));
  }

  return picks;
}
