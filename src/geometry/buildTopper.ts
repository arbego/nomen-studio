import type * as THREE from 'three';
import type { MainGeometryConfig, Pick, PickId, TopperConfig } from './types';
import { textToGeometry } from './textGeometry';
import { accentShapeToGeometry } from './shapeGeometry';
import { stickToGeometry, clampStickOffsetToBounds } from './stickGeometry';
import { combinePickGeometry } from './combine';

// The word's sizeMm is the one user-facing size control; the number and accent
// are proportioned relative to it, matching the reference product's look. These
// ratios are the only place that scaling relationship lives.
const NUMBER_WIDTH_RATIO = 0.4;
const ACCENT_WIDTH_RATIO = 0.28;

/**
 * Builds every pick's main geometry (word, number, optional accent) — the
 * expensive, async, font-dependent part. Deliberately excludes sticks: stick
 * position/size/count changes shouldn't have to re-run font extrusion, and the
 * live scene needs to regenerate sticks cheaply on every drag frame (see
 * sticksForPick below).
 */
export async function buildTopperPicks(config: MainGeometryConfig): Promise<Pick[]> {
  const [wordMain, numberMain] = await Promise.all([
    textToGeometry(config.word, config.wordFontId, config.sizeMm, config.extrudeDepthMm),
    textToGeometry(config.number, config.numberFontId, config.sizeMm * NUMBER_WIDTH_RATIO, config.extrudeDepthMm),
  ]);

  const picks: Pick[] = [
    { id: 'word', label: config.word, mainGeometry: wordMain },
    { id: 'number', label: config.number, mainGeometry: numberMain },
  ];

  if (config.accentShapeId) {
    const accentMain = accentShapeToGeometry(config.accentShapeId, config.sizeMm * ACCENT_WIDTH_RATIO, config.extrudeDepthMm);
    picks.push({ id: 'accent', label: config.accentShapeId, mainGeometry: accentMain });
  }

  return picks;
}

/** Every stick for one pick, at their current (clamped) offsets — cheap and synchronous, safe to call every drag frame. */
export function sticksForPick(mainGeometry: THREE.BufferGeometry, config: TopperConfig, pickId: PickId): THREE.BufferGeometry[] {
  return config.stickOffsets[pickId].map((rawOffset) => {
    const offset = clampStickOffsetToBounds(mainGeometry, rawOffset, config.stickWidthMm, config.stickEmbedMm);
    return stickToGeometry({
      widthMm: config.stickWidthMm,
      thicknessMm: config.extrudeDepthMm,
      lengthMm: config.stickLengthMm,
      embedMm: config.stickEmbedMm,
      offset,
    });
  });
}

/** The final printable solid for one pick — main geometry merged with all its sticks. Used at export time. */
export function mergedPickGeometry(mainGeometry: THREE.BufferGeometry, config: TopperConfig, pickId: PickId): THREE.BufferGeometry {
  return combinePickGeometry(mainGeometry, sticksForPick(mainGeometry, config, pickId));
}
