import type { TextBlock } from '../../geometry/types';
import { loosePieceIds, type SolidPiece } from '../../geometry/connectivity';
import { rectRegion, regionFromContours } from '../../geometry/clipper';
import { buildOutlineShapes } from '../../geometry/outline';
import { cumulativeGaps, normalizedLetterGaps } from '../../geometry/letterLayout';
import { DEFAULT_CURVE_SEGMENTS } from '../../geometry/units';
import { getIcon } from '../../icons/catalog';
import { decoratorOutlineContours, decoratorPlacement, sticksForBlock, stickThicknessMm, type DecoratorBlock } from './geometry';
import type { CakeTopperBlockId, CakeTopperConfig } from './config';

const ORIGIN = { x: 0, y: 0 };

/** One letter of one line, as a piece: `line-0-letter-3`. */
function letterId(lineIndex: number, letterIndex: number): string {
  return `line-${lineIndex}-letter-${letterIndex}`;
}

/**
 * Every letter of every line at its current gap- and offset-shifted position,
 * each a piece of its own.
 *
 * One per letter and not one per line, because whether a line's letters hold each
 * other is exactly the question: a script face joins them, a sans-serif one
 * leaves them standing apart, and a widened gap pulls any face's letters off each
 * other.
 */
function letterPieces(block: TextBlock, config: CakeTopperConfig): SolidPiece[] {
  return block.lines.flatMap((line, lineIndex) => {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, config.letterGapsMm[lineIndex] ?? []));
    const offset = config.lineOffsets[lineIndex] ?? ORIGIN;
    return line.letters.map((letter, letterIndex) => ({
      id: letterId(lineIndex, letterIndex),
      region: regionFromContours(letter.contours, { translate: { x: cascade[letterIndex] + offset.x, y: offset.y } }),
      zRange: [0, config.extrudeDepthMm] as const,
    }));
  });
}

/**
 * The backing card, as one piece per connected island of it.
 *
 * At a small grow the card is not one thing: it comes out as a separate island
 * under each letter, or under each stroke, and whether those islands have merged
 * is the first thing deciding whether the design holds together at all. Every
 * shape Clipper's offsetting returns is one such island, so the split has already
 * been made by the time the card is built.
 */
function cardPieces(block: TextBlock, config: CakeTopperConfig, decorators: DecoratorBlock[]): SolidPiece[] {
  if (!config.outlineEnabled) {
    return [];
  }
  const shapes = buildOutlineShapes(
    block,
    config.letterGapsMm,
    config.lineOffsets,
    config.outlineGrowMm,
    config.closedOutlineHoles,
    decoratorOutlineContours(decorators, config),
  );
  return shapes.map((shape, i) => {
    const { shape: outer, holes } = shape.extractPoints(DEFAULT_CURVE_SEGMENTS);
    return { id: `card-${i}`, region: regionFromContours([{ outer, holes }]), zRange: [0, config.outlineDepthMm] as const };
  });
}

/**
 * The sticks, by the ground each covers.
 *
 * A stick is only clamped to stay within the lettering's *combined* bounds, which
 * is a box — so one dragged under a space, or into the gap between two lines, can
 * satisfy that and still meet no letter at all. Its footprint is taken as its
 * bounding rectangle, which overstates only the two corners the rounded tip cuts
 * away, at the far bottom end where there is nothing to meet anyway.
 */
function stickPieces(block: TextBlock, config: CakeTopperConfig): SolidPiece[] {
  return sticksForBlock(block, config).map((geometry, i) => {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    return {
      id: `stick-${i}`,
      region: rectRegion(box.min.x, box.min.y, box.max.x, box.max.y),
      zRange: [0, stickThicknessMm(config)] as const,
    };
  });
}

function decoratorPieces(decorators: DecoratorBlock[], config: CakeTopperConfig): SolidPiece[] {
  return decorators.map((decorator) => {
    const placement = decoratorPlacement(decorator, config);
    return {
      id: `decorator-${decorator.id}`,
      region: decorator.block.lines.flatMap((line) => line.letters.flatMap((letter) => regionFromContours(letter.contours, placement))),
      // Seated on the same back face as everything else (see
      // placedDecoratorGeometry), so even a thin ornament meets what it sits on.
      zRange: [0, config.decorators.find((d) => d.id === decorator.id)?.depthMm ?? 0] as const,
    };
  });
}

/** A piece of the design named as it reads on the cake — `“Lara”`, or `“pp” in “Happy”`. */
function quote(text: string): string {
  return `“${text}”`;
}

/**
 * Names the loose letters of one line.
 *
 * A whole line that has come off is called by its name — "Lara", not four loose
 * letters, which is the same news told four times and in a form nobody can act
 * on. One loose letter is named, with the line it is in, since a letter alone is
 * not findable: a topper can easily have three p's.
 *
 * Several but not all of them are counted rather than spelled, because their
 * letters are not necessarily adjacent: the loose ones of "Happy" can be H, a, p
 * and y, and "Hapy" reads as a line of the design misspelled rather than as four
 * letters of it coming away.
 */
function describeLooseLetters(line: string, letterIndices: number[]): string {
  const chars = [...line];
  if (letterIndices.length === chars.length) {
    return quote(line);
  }
  if (letterIndices.length === 1) {
    return `${quote(chars[letterIndices[0]])} in ${quote(line)}`;
  }
  return `${letterIndices.length} letters of ${quote(line)}`;
}

/**
 * What a cake topper would come off the plate as: the parts nothing holds, named
 * as they appear on the piece, or nothing at all when it is in one piece.
 *
 * The topper prints as one fused object, so being held is transitive — a letter on
 * the card is held, and so is an ornament on that letter. Which makes the whole
 * answer a question of what currently touches what, and that is what gets asked:
 * of the letters against each other, of the card's islands, of the sticks, and of
 * the ornaments.
 */
export function looseCakeTopperParts(block: TextBlock, decorators: DecoratorBlock[], config: CakeTopperConfig): string[] {
  const loose = new Set(
    loosePieceIds([
      ...cardPieces(block, config, decorators),
      ...letterPieces(block, config),
      ...stickPieces(block, config),
      ...decoratorPieces(decorators, config),
    ]),
  );
  if (loose.size === 0) {
    return [];
  }

  const named: string[] = [];
  if ([...loose].some((id) => id.startsWith('card-'))) {
    named.push('part of the backing card');
  }
  block.lines.forEach((line, lineIndex) => {
    const letters = line.letters.map((_, i) => i).filter((i) => loose.has(letterId(lineIndex, i)));
    if (letters.length > 0) {
      named.push(describeLooseLetters(config.lines[lineIndex] ?? line.letters.map((letter) => letter.char).join(''), letters));
    }
  });
  const sticks = config.stickOffsets[block.id as CakeTopperBlockId];
  sticks.forEach((_, i) => {
    if (loose.has(`stick-${i}`)) {
      named.push(sticks.length > 1 ? `stick ${i + 1}` : 'the stick');
    }
  });
  for (const decorator of decorators) {
    if (loose.has(`decorator-${decorator.id}`)) {
      const onIt = config.decorators.find((d) => d.id === decorator.id);
      named.push(onIt ? quote(getIcon(onIt.iconName).name) : 'an ornament');
    }
  }
  return named;
}
