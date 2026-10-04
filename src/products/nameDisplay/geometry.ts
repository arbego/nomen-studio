import * as THREE from 'three';
import type { Offset2D, TextBlock } from '../../geometry/types';
import { buildTextBlock } from '../../geometry/textGeometry';
import { extrudeMmShapes } from '../../geometry/extrudeToMm';
import { combineGeometries } from '../../geometry/combine';
import { combinedBlockBounds, cumulativeGaps, normalizedLetterGaps } from '../../geometry/letterLayout';
import { growRegion, intersectRegions, regionFromContours, regionIsEmpty, regionToShapes, subtractRegions, type Region } from '../../geometry/clipper';
import { baseRailGeometry, trimBlockBelow, trimCutY } from '../../geometry/baseGeometry';
import { degToRad, type Placement2D } from '../../geometry/placement';
import { buildIconBlock } from '../../icons/iconBlock';
import type { NameDisplayBlocksConfig, NameDisplayConfig, NameDisplayAssemblyConfig } from './config';

const ORIGIN: Offset2D = { x: 0, y: 0 };

/**
 * A pocket can never take the whole thickness of the initial — that would cut
 * the piece in two. Capped well below it so there is always a solid back slab.
 */
const MAX_POCKET_FRACTION = 0.6;

/**
 * How far the initial's two slabs interpenetrate at their shared plane.
 *
 * They are joined by a plain buffer merge, not a CSG union (see combine.ts),
 * which relies on every part having real volumetric overlap where it meets
 * another. Two slabs stacked on an exactly coincident plane would instead share
 * a face with opposing normals and leave interior geometry in the STL — the
 * same non-manifold seam stickGeometry's embedMm and baseGeometry's
 * RAIL_EMBED_MM exist to avoid.
 */
const SLAB_OVERLAP_MM = 0.01;

/** One ornament, built from the icon font — paired with the config id it was built for. */
export interface DecoratorBlock {
  id: string;
  block: TextBlock;
}

/** The pieces, as built from fonts — the expensive, async part. */
export interface NameDisplayBlocks {
  initial: TextBlock;
  name: TextBlock;
  decorators: DecoratorBlock[];
}

/** Where one decorator ended up, and whether the initial is actually there to hold it. */
export interface DecoratorPlacement {
  id: string;
  placement: Placement2D;
  /** A decorator dragged clear of the initial cuts no pocket and has nothing holding it. */
  overlapsInitial: boolean;
}

/** Everything derived from those blocks by cheap, synchronous work: the pocket, and where the name sits in it. */
export interface NameDisplayAssembly {
  /** The initial's full solid, pocket included. */
  initialGeometry: THREE.BufferGeometry;
  /** How far the name stands proud of the initial's front face, in mm. */
  protrusionMm: number;
  /** The z at which the name's own extrusion starts — the pocket floor. */
  nameZMm: number;
  /** Whether the name overlaps the initial at all. A name dragged clear of it has nothing holding it. */
  overlapsInitial: boolean;
  /** The exact placement the pocket was cut from — the preview applies this same transform, so the two can't drift apart. */
  namePlacement: Placement2D;
  /** Where each ornament sits, in the same order as the blocks' decorators. */
  decorators: DecoratorPlacement[];
}

/** The pocket depth actually used, after capping (see MAX_POCKET_FRACTION). */
export function effectivePocketDepthMm(config: NameDisplayAssemblyConfig & { initialDepthMm: number; nameDepthMm: number }): number {
  const cap = Math.min(config.initialDepthMm * MAX_POCKET_FRACTION, config.nameDepthMm);
  return Math.max(0, Math.min(config.pocketDepthMm, cap));
}

/**
 * Every letter of a block as one filled 2D region, with each letter shifted to
 * its current gap-adjusted position and the whole block then `placement`d — the
 * block's true printed silhouette, counters included, which is what a boolean
 * has to work against.
 *
 * A letter's gap shift is applied *before* the placement, since it moves the
 * letter along the block's own baseline, which tilts with the block.
 *
 * `letterGapsMm` is per line, indexed the same as `block.lines`, matching the
 * convention combinedBlockBounds and the cake topper's merge already use.
 */
export function blockRegion(block: TextBlock, letterGapsMm: number[][], placement: Placement2D = {}): Region {
  const paths: Region = [];
  block.lines.forEach((line, lineIndex) => {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, letterGapsMm[lineIndex] ?? []));
    line.letters.forEach((letter, i) => {
      paths.push(...regionFromContours(letter.contours, { ...placement, preTranslate: { x: cascade[i], y: 0 } }));
    });
  });
  return paths;
}

/** Where the name turns when it's tilted: the center of its own silhouette, so the angle tilts it in place rather than swinging it off the initial. */
export function namePivot(block: TextBlock, letterGapsMm: number[]): Offset2D {
  const bounds = combinedBlockBounds(block, [letterGapsMm], [{ x: 0, y: 0 }]);
  return { x: (bounds.min.x + bounds.max.x) / 2, y: (bounds.min.y + bounds.max.y) / 2 };
}

/** How the name is placed onto the initial — the one description the preview transform and the pocket boolean both follow, so the recess can never drift from what's on screen. */
export function namePlacement(blocks: NameDisplayBlocks, config: NameDisplayConfig): Placement2D {
  return {
    translate: config.nameOffset,
    rotationRad: degToRad(config.nameAngleDeg),
    pivot: namePivot(blocks.name, config.nameLetterGapsMm),
  };
}

/** Where an ornament sits. A plain shift: a decorator is moved, not turned. */
export function decoratorPlacement(id: string, config: NameDisplayAssemblyConfig): Placement2D {
  return { translate: config.decoratorOffsets[id] ?? ORIGIN };
}

/**
 * Builds both pieces from their fonts. Everything that does *not* change the
 * glyphs themselves — where the name sits, its letter gaps, the pocket, the
 * base rail — is deliberately excluded and applied synchronously by
 * `assembleNameDisplay` below, so dragging the name never re-runs font
 * extrusion. (A flat-bottom trim does change the silhouette, so it belongs
 * here.)
 */
export async function buildNameDisplayBlocks(config: NameDisplayBlocksConfig): Promise<NameDisplayBlocks> {
  const [rawInitial, rawName, decorators] = await Promise.all([
    buildTextBlock({
      id: 'initial',
      label: config.initial,
      lines: [config.initial],
      fontId: config.initialFontId,
      fit: { mode: 'height', mm: config.initialHeightMm },
      extrudeDepthMm: config.initialDepthMm,
    }),
    buildTextBlock({
      id: 'name',
      label: config.name,
      lines: [config.name],
      fontId: config.nameFontId,
      fit: { mode: 'width', mm: config.nameWidthMm },
      extrudeDepthMm: config.nameDepthMm,
    }),
    // One icon font for all of them, so this is one parse however many
    // ornaments are on the piece — loadFont caches by id.
    Promise.all(
      config.decorators.map(async (decorator) => ({
        id: decorator.id,
        block: await buildIconBlock({ id: decorator.id, iconName: decorator.iconName, widthMm: decorator.widthMm, extrudeDepthMm: decorator.depthMm }),
      })),
    ),
  ]);

  // Standing applies to the initial alone. The initial is the piece that stands
  // on the table; the name and the ornaments are held by the pockets they drop
  // into, so they need no foot of their own — and cutting their descenders
  // flat, or hanging a rail off a piece that is suspended halfway up another
  // one, would only disfigure them.
  return {
    initial: applyTrim(rawInitial, config, config.initialDepthMm),
    name: rawName,
    decorators,
  };
}

function applyTrim(block: TextBlock, config: NameDisplayBlocksConfig, extrudeDepthMm: number): TextBlock {
  if (config.standMode !== 'trim') {
    return block;
  }
  return trimBlockBelow(block, trimCutY(block, config.trimOffsetMm), extrudeDepthMm);
}

/**
 * Cuts the pocket and works out where the name sits in it — all synchronous, so
 * it can re-run on every drag commit without touching the fonts.
 *
 * The initial becomes two stacked slabs: a full-silhouette back slab, and a
 * front slab with the name's (clearance-grown) silhouette subtracted from it.
 * That is a genuine recess built entirely from 2D booleans — no 3D CSG, which
 * these planar prisms never need. Only the part of the name that actually
 * overlaps the initial cuts anything: the subtraction finds nothing to remove
 * where the name overhangs, which on a wide name is most of it.
 */
export function assembleNameDisplay(blocks: NameDisplayBlocks, config: NameDisplayConfig): NameDisplayAssembly {
  const pocketDepth = effectivePocketDepthMm(config);
  const backDepth = config.initialDepthMm - pocketDepth;
  const face = blockRegion(blocks.initial, []);
  const placement = namePlacement(blocks, config);
  const nameRegion = blockRegion(blocks.name, [config.nameLetterGapsMm], placement);

  // Every inlaid piece cuts the same recess, at the same depth: they all seat on
  // the one pocket floor, so one subtraction covers the lot.
  const decoratorRegions = blocks.decorators.map((decorator) => blockRegion(decorator.block, [], decoratorPlacement(decorator.id, config)));
  const inlayRegion: Region = [...nameRegion, ...decoratorRegions.flat()];

  const parts: THREE.BufferGeometry[] = [];
  const backSlab = extrudeMmShapes(regionToShapes(face), backDepth);
  if (backSlab) {
    parts.push(backSlab);
  }

  if (pocketDepth > 0) {
    const frontShapes = regionToShapes(subtractRegions(face, growRegion(inlayRegion, config.pocketClearanceMm)));
    // Started just below the back slab's top so the two overlap; the pocket
    // floor still lands exactly at backDepth, since that is the back slab's top.
    const frontSlab = extrudeMmShapes(frontShapes, pocketDepth + SLAB_OVERLAP_MM);
    if (frontSlab) {
      frontSlab.translate(0, 0, backDepth - SLAB_OVERLAP_MM);
      parts.push(frontSlab);
    }
  }

  return {
    initialGeometry: combineGeometries(parts),
    protrusionMm: config.nameDepthMm - pocketDepth,
    nameZMm: backDepth,
    overlapsInitial: !regionIsEmpty(intersectRegions(face, nameRegion)),
    namePlacement: placement,
    decorators: blocks.decorators.map((decorator, i) => ({
      id: decorator.id,
      placement: decoratorPlacement(decorator.id, config),
      overlapsInitial: !regionIsEmpty(intersectRegions(face, decoratorRegions[i])),
    })),
  };
}

/**
 * The initial's base rail, in the initial's own local frame — null unless the
 * design stands on one. Only the initial gets one: it is the piece that stands,
 * and the name is suspended partway up it by the pocket.
 */
export function initialRailGeometry(blocks: NameDisplayBlocks, config: NameDisplayConfig): THREE.BufferGeometry | null {
  if (config.standMode !== 'rail') {
    return null;
  }
  return baseRailGeometry({
    bounds: combinedBlockBounds(blocks.initial, [], [{ x: 0, y: 0 }]),
    baselineYMm: blocks.initial.baselineYMm,
    heightMm: config.railHeightMm,
    depthMm: config.railDepthMm,
    marginMm: config.railMarginMm,
    blockDepthMm: config.initialDepthMm,
  });
}

/** The initial's complete printable solid — the pocketed letter plus its base rail, if any. */
export function initialPrintGeometry(blocks: NameDisplayBlocks, assembly: NameDisplayAssembly, config: NameDisplayConfig): THREE.BufferGeometry {
  const rail = initialRailGeometry(blocks, config);
  return rail ? combineGeometries([assembly.initialGeometry, rail]) : assembly.initialGeometry;
}

/**
 * The name's complete printable solid — just its letters, at their current
 * gap-adjusted positions, with no foot of any kind: it is held by the initial's
 * pocket, and a thin piece like this prints lying flat on the bed anyway.
 *
 * Built in the name's own local frame (not shifted by nameOffset), since it
 * prints as a separate piece on its own: the offset only decides where the
 * pocket went.
 */
export function namePrintGeometry(blocks: NameDisplayBlocks, config: NameDisplayConfig): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const line of blocks.name.lines) {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, config.nameLetterGapsMm));
    line.letters.forEach((letter, i) => {
      parts.push(cascade[i] === 0 ? letter.geometry : letter.geometry.clone().translate(cascade[i], 0, 0));
    });
  }
  return combineGeometries(parts);
}

/**
 * The name moved from its own frame into the initial's: turned by its angle
 * about its own pivot, shifted to its offset, and dropped to the pocket floor.
 *
 * This is the same placement the pocket was cut from, read straight off the
 * assembly rather than recomposed from the config, so the piece lands in the
 * recess that was made for it.
 */
export function placedNameGeometry(blocks: NameDisplayBlocks, assembly: NameDisplayAssembly, config: NameDisplayConfig): THREE.BufferGeometry {
  return placeInPocket(namePrintGeometry(blocks, config), assembly.namePlacement, assembly.nameZMm);
}

/**
 * One ornament's printable solid, moved into the initial's frame and dropped to
 * the pocket floor — the same seating the name gets, from the same placement the
 * recess was cut from.
 */
export function placedDecoratorGeometry(decorator: DecoratorBlock, assembly: NameDisplayAssembly): THREE.BufferGeometry {
  const placement = assembly.decorators.find((d) => d.id === decorator.id)?.placement ?? {};
  const parts = decorator.block.lines.flatMap((line) => line.letters.map((letter) => letter.geometry));
  return placeInPocket(combineGeometries(parts), placement, assembly.nameZMm);
}

/** Moves a piece from its own frame into the initial's and seats it at the pocket floor. */
function placeInPocket(geometry: THREE.BufferGeometry, placement: Placement2D, zMm: number): THREE.BufferGeometry {
  const { pivot = ORIGIN, translate = ORIGIN, rotationRad = 0 } = placement;
  // Reads, right to left, as placePoint does: to the pivot, turn, then back out
  // to the pivot plus the offset — with the pocket floor folded into that last
  // step, since a turn about Z leaves z alone.
  const matrix = new THREE.Matrix4()
    .makeTranslation(pivot.x + translate.x, pivot.y + translate.y, zMm)
    .multiply(new THREE.Matrix4().makeRotationZ(rotationRad))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, 0));
  return geometry.applyMatrix4(matrix);
}

