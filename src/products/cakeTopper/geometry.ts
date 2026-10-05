import * as THREE from 'three';
import type { TextBlock } from '../../geometry/types';
import { buildTextBlock } from '../../geometry/textGeometry';
import { stickToGeometry, clampStickOffsetToBounds, stickLengthForLevelTip } from '../../geometry/stickGeometry';
import { combineGeometries } from '../../geometry/combine';
import { blockPivot, combinedBlockBounds, cumulativeGaps, normalizedLetterGaps } from '../../geometry/letterLayout';
import { degToRad, placeGeometry, placePoint, type Placement2D } from '../../geometry/placement';
import type { ExtraContours } from '../../geometry/outline';
import { buildIconBlock } from '../../icons/iconBlock';
import type { CakeTopperBlockId, CakeTopperConfig, CakeTopperGeometryConfig } from './config';

/** One ornament, built from its glyph — paired with the config id it was built for. */
export interface DecoratorBlock {
  id: string;
  block: TextBlock;
}

/** Everything the font build produces for a topper: the lettering, and an ornament per icon on it. */
export interface CakeTopperGeometry {
  blocks: TextBlock[];
  decorators: DecoratorBlock[];
}

/**
 * Builds the word block's letter geometry — the expensive, async, font-dependent
 * part. Deliberately excludes sticks and letter-gap/line-offset positioning:
 * all cheap, synchronous adjustments applied on top of these letters (see
 * sticksForBlock and mergedBlockGeometry below), so none of them needs to re-run
 * font extrusion.
 */
export async function buildCakeTopperGeometry(config: CakeTopperGeometryConfig): Promise<CakeTopperGeometry> {
  const [blocks, decorators] = await Promise.all([buildCakeTopperBlocks(config), buildCakeTopperDecorators(config)]);
  return { blocks, decorators };
}

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
 * Every ornament as its own solid.
 *
 * An icon is a glyph, so each goes down the same pipeline a letter does — the
 * whole reason an ornament costs this product almost nothing beyond its panel.
 */
export async function buildCakeTopperDecorators(config: CakeTopperGeometryConfig): Promise<DecoratorBlock[]> {
  return Promise.all(
    config.decorators.map(async (decorator) => ({
      id: decorator.id,
      block: await buildIconBlock({ id: decorator.id, iconName: decorator.iconName, widthMm: decorator.widthMm, extrudeDepthMm: decorator.depthMm }),
    })),
  );
}

/**
 * Where an ornament sits and how far it is turned — one description, followed
 * by the preview and by what gets exported, so what you drag is what prints.
 */
export function decoratorPlacement(decorator: DecoratorBlock, config: CakeTopperConfig): Placement2D {
  const { offset = { x: 0, y: 0 }, angleDeg = 0 } = config.decoratorPlacements[decorator.id] ?? {};
  return { translate: offset, rotationRad: degToRad(angleDeg), pivot: blockPivot(decorator.block, []) };
}

/**
 * Every ornament's outline, placed where it sits, for the backing card to grow
 * around.
 *
 * Outer boundaries only, so an ornament's own counters come out filled — a gap
 * inside a symbol is part of the drawing, not somewhere anyone meant to see
 * through the piece.
 */
export function decoratorOutlineContours(decorators: DecoratorBlock[], config: CakeTopperConfig): ExtraContours {
  return decorators.flatMap((decorator) => {
    const placement = decoratorPlacement(decorator, config);
    return decorator.block.lines.flatMap((line) =>
      line.letters.flatMap((letter) =>
        letter.contours.map(({ outer }) =>
          outer.map((point) => {
            const placed = placePoint(point.x, point.y, placement);
            return new THREE.Vector2(placed.x, placed.y);
          }),
        ),
      ),
    );
  });
}

/**
 * One ornament's printable solid, moved into the lettering's frame.
 *
 * Seated at z = 0, the same back face the letters and the card share, so an
 * ornament thinner than the lettering sits flush at the back rather than
 * floating in the middle of the piece.
 */
export function placedDecoratorGeometry(decorator: DecoratorBlock, config: CakeTopperConfig): THREE.BufferGeometry {
  const parts = decorator.block.lines.flatMap((line) => line.letters.map((letter) => letter.geometry.clone()));
  return placeGeometry(combineGeometries(parts), decoratorPlacement(decorator, config));
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
