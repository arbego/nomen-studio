import type * as THREE from 'three';
import type { MainGeometryConfig, Pick, PickId, TopperConfig } from './types';
import { textToGeometry } from './textGeometry';
import { stickToGeometry, clampStickOffsetToBounds, stickLengthForLevelTip } from './stickGeometry';
import { combinePickGeometry } from './combine';

/**
 * Builds the word pick's main geometry — the expensive, async, font-dependent
 * part. Deliberately excludes sticks: stick position/size/count changes
 * shouldn't have to re-run font extrusion, and the live scene needs to
 * regenerate sticks cheaply on every drag frame (see sticksForPick below).
 */
export async function buildTopperPicks(config: MainGeometryConfig): Promise<Pick[]> {
  const wordMain = await textToGeometry(config.word, config.wordFontId, config.sizeMm, config.extrudeDepthMm);
  return [{ id: 'word', label: config.word, mainGeometry: wordMain }];
}

/**
 * Every stick for one pick, at their current (clamped) offsets — cheap and
 * synchronous, safe to call every drag frame. Each stick's extruded length is
 * individually adjusted so all of a pick's tips land level with each other
 * (see stickLengthForLevelTip) regardless of where each one was dragged.
 */
export function sticksForPick(mainGeometry: THREE.BufferGeometry, config: TopperConfig, pickId: PickId): THREE.BufferGeometry[] {
  return config.stickOffsets[pickId].map((rawOffset) => {
    const offset = clampStickOffsetToBounds(mainGeometry, rawOffset, config.stickWidthMm, config.stickEmbedMm);
    const lengthMm = stickLengthForLevelTip(config.stickLengthMm, config.stickEmbedMm, offset.y);
    return stickToGeometry({
      widthMm: config.stickWidthMm,
      thicknessMm: config.extrudeDepthMm,
      lengthMm,
      embedMm: config.stickEmbedMm,
      offset,
    });
  });
}

/** The final printable solid for one pick — main geometry merged with all its sticks. Used at export time. */
export function mergedPickGeometry(mainGeometry: THREE.BufferGeometry, config: TopperConfig, pickId: PickId): THREE.BufferGeometry {
  return combinePickGeometry(mainGeometry, sticksForPick(mainGeometry, config, pickId));
}
