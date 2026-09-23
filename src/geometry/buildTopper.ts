import type * as THREE from 'three';
import type { MainGeometryConfig, Pick, TopperConfig } from './types';
import { wordToLetterGeometries } from './textGeometry';
import { stickToGeometry, clampStickOffsetToBounds, stickLengthForLevelTip } from './stickGeometry';
import { combineGeometries } from './combine';
import { combinedLetterBounds, cumulativeGaps, normalizedLetterGaps } from './letterLayout';

/**
 * Builds the word pick's letter geometry — the expensive, async, font-dependent
 * part. Deliberately excludes sticks and letter-gap positioning: both are
 * cheap, synchronous adjustments applied on top of these letters (see
 * sticksForPick and mergedPickGeometry below), so neither needs to re-run font
 * extrusion.
 */
export async function buildTopperPicks(config: MainGeometryConfig): Promise<Pick[]> {
  const letters = await wordToLetterGeometries(config.word, config.wordFontId, config.sizeMm, config.extrudeDepthMm);
  return [{ id: 'word', label: config.word, letters }];
}

/**
 * Every stick for one pick, at their current (clamped) offsets — cheap and
 * synchronous, safe to call every drag frame. Each stick's extruded length is
 * individually adjusted so all of a pick's tips land level with each other
 * (see stickLengthForLevelTip) regardless of where each one was dragged. Sticks
 * are clamped against the letters' current, gap-adjusted combined bounds, so
 * closing/opening letter gaps also shifts where a stick is allowed to sit.
 */
/**
 * A stick's thickness matches whatever it's actually embedded into: the
 * outline card, when there is one (so the stick sits flush with it instead of
 * poking out the front or leaving a gap at the back), or the letters
 * themselves otherwise.
 */
export function stickThicknessMm(config: TopperConfig): number {
  return config.outlineEnabled ? config.outlineDepthMm : config.extrudeDepthMm;
}

export function sticksForPick(pick: Pick, config: TopperConfig): THREE.BufferGeometry[] {
  const bounds = combinedLetterBounds(pick.letters, config.letterGapsMm);
  return config.stickOffsets[pick.id].map((rawOffset) => {
    const offset = clampStickOffsetToBounds(bounds, rawOffset, config.stickWidthMm, config.stickEmbedMm);
    const lengthMm = stickLengthForLevelTip(config.stickLengthMm, config.stickEmbedMm, offset.y);
    return stickToGeometry({
      widthMm: config.stickWidthMm,
      thicknessMm: stickThicknessMm(config),
      lengthMm,
      embedMm: config.stickEmbedMm,
      offset,
    });
  });
}

/**
 * The final printable solid for one pick — every letter, shifted to its
 * current gap-adjusted position, merged with all its sticks. Used at export
 * time; each letter's own geometry is left untouched (cloned before shifting)
 * since the live scene still needs the natural-position original.
 */
export function mergedPickGeometry(pick: Pick, config: TopperConfig): THREE.BufferGeometry {
  const cascade = cumulativeGaps(normalizedLetterGaps(pick.letters.length, config.letterGapsMm));
  const letterParts = pick.letters.map((letter, i) => (cascade[i] === 0 ? letter.geometry : letter.geometry.clone().translate(cascade[i], 0, 0)));
  return combineGeometries([...letterParts, ...sticksForPick(pick, config)]);
}
