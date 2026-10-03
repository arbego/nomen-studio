import type * as THREE from 'three';
import type { TextBlock } from '../../geometry/types';
import { buildTextBlock } from '../../geometry/textGeometry';
import { stickToGeometry, clampStickOffsetToBounds, stickLengthForLevelTip } from '../../geometry/stickGeometry';
import { combineGeometries } from '../../geometry/combine';
import { combinedBlockBounds, cumulativeGaps, normalizedLetterGaps } from '../../geometry/letterLayout';
import type { CakeTopperBlockId, CakeTopperConfig, CakeTopperGeometryConfig } from './config';

/**
 * Builds the word block's letter geometry — the expensive, async, font-dependent
 * part. Deliberately excludes sticks and letter-gap/line-offset positioning:
 * all cheap, synchronous adjustments applied on top of these letters (see
 * sticksForBlock and mergedBlockGeometry below), so none of them needs to re-run
 * font extrusion.
 */
export async function buildCakeTopperBlocks(config: CakeTopperGeometryConfig): Promise<TextBlock[]> {
  return [
    await buildTextBlock({
      id: 'word',
      label: config.lines.join(' '),
      lines: config.lines,
      fontId: config.wordFontId,
      fit: { mode: 'width', mm: config.sizeMm },
      extrudeDepthMm: config.extrudeDepthMm,
    }),
  ];
}

/**
 * Every stick for one block, at their current (clamped) offsets — cheap and
 * synchronous, safe to call every drag frame. Each stick's extruded length is
 * individually adjusted so all of a block's tips land level with each other
 * (see stickLengthForLevelTip) regardless of where each one was dragged. Sticks
 * are clamped against the whole block's current, gap- and line-offset-adjusted
 * combined bounds (every line together), so repositioning a line or
 * closing/opening a letter gap also shifts where a stick is allowed to sit.
 */
/**
 * A stick's thickness matches whatever it's actually embedded into: the
 * outline card, when there is one (so the stick sits flush with it instead of
 * poking out the front or leaving a gap at the back), or the letters
 * themselves otherwise.
 */
export function stickThicknessMm(config: CakeTopperConfig): number {
  return config.outlineEnabled ? config.outlineDepthMm : config.extrudeDepthMm;
}

export function sticksForBlock(block: TextBlock, config: CakeTopperConfig): THREE.BufferGeometry[] {
  const bounds = combinedBlockBounds(block, config.letterGapsMm, config.lineOffsets);
  return config.stickOffsets[block.id as CakeTopperBlockId].map((rawOffset) => {
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
 * The final printable solid for one block — every letter of every line,
 * shifted to its current gap-adjusted and line-offset-shifted position,
 * merged with all its sticks. Used at export time; each letter's own
 * geometry is left untouched (cloned before shifting) since the live scene
 * still needs the natural-position original.
 */
export function mergedBlockGeometry(block: TextBlock, config: CakeTopperConfig): THREE.BufferGeometry {
  const letterParts = block.lines.flatMap((line, lineIndex) => {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, config.letterGapsMm[lineIndex] ?? []));
    const offset = config.lineOffsets[lineIndex] ?? { x: 0, y: 0 };
    return line.letters.map((letter, i) => {
      const dx = cascade[i] + offset.x;
      const dy = offset.y;
      return dx === 0 && dy === 0 ? letter.geometry : letter.geometry.clone().translate(dx, dy, 0);
    });
  });
  return combineGeometries([...letterParts, ...sticksForBlock(block, config)]);
}
