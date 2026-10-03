import * as THREE from 'three';
import type { Offset2D, TextBlock } from '../../geometry/types';
import { buildTextBlock } from '../../geometry/textGeometry';
import { extrudeMmShapes } from '../../geometry/extrudeToMm';
import { combineGeometries } from '../../geometry/combine';
import { combinedBlockBounds, cumulativeGaps, normalizedLetterGaps } from '../../geometry/letterLayout';
import { growRegion, intersectRegions, regionFromContours, regionIsEmpty, regionToShapes, subtractRegions, type Region } from '../../geometry/clipper';
import { baseRailGeometry, trimBlockBelow, trimCutY } from '../../geometry/baseGeometry';
import type { NameDisplayBlocksConfig, NameDisplayConfig, NameDisplayAssemblyConfig } from './config';

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

/** The two pieces, as built from fonts — the expensive, async part. */
export interface NameDisplayBlocks {
  initial: TextBlock;
  name: TextBlock;
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
}

/** The pocket depth actually used, after capping (see MAX_POCKET_FRACTION). */
export function effectivePocketDepthMm(config: NameDisplayAssemblyConfig & { initialDepthMm: number; nameDepthMm: number }): number {
  const cap = Math.min(config.initialDepthMm * MAX_POCKET_FRACTION, config.nameDepthMm);
  return Math.max(0, Math.min(config.pocketDepthMm, cap));
}

/**
 * Every letter of a block as one filled 2D region, with each letter shifted to
 * its current gap-adjusted position and the whole block shifted by `offset` —
 * the block's true printed silhouette, counters included, which is what a
 * boolean has to work against.
 *
 * `letterGapsMm` is per line, indexed the same as `block.lines`, matching the
 * convention combinedBlockBounds and the cake topper's merge already use.
 */
export function blockRegion(block: TextBlock, letterGapsMm: number[][], offset: Offset2D): Region {
  const paths: Region = [];
  block.lines.forEach((line, lineIndex) => {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, letterGapsMm[lineIndex] ?? []));
    line.letters.forEach((letter, i) => {
      paths.push(...regionFromContours(letter.contours, { x: cascade[i] + offset.x, y: offset.y }));
    });
  });
  return paths;
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
  const [rawInitial, rawName] = await Promise.all([
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
  ]);

  return {
    initial: applyTrim(rawInitial, config, config.initialDepthMm),
    name: applyTrim(rawName, config, config.nameDepthMm),
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
  const face = blockRegion(blocks.initial, [], { x: 0, y: 0 });
  const nameRegion = blockRegion(blocks.name, [config.nameLetterGapsMm], config.nameOffset);

  const parts: THREE.BufferGeometry[] = [];
  const backSlab = extrudeMmShapes(regionToShapes(face), backDepth);
  if (backSlab) {
    parts.push(backSlab);
  }

  if (pocketDepth > 0) {
    const frontShapes = regionToShapes(subtractRegions(face, growRegion(nameRegion, config.pocketClearanceMm)));
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
  };
}

/** A block's base rail, if the design has one — null for the other two standing modes. */
export function standGeometryFor(block: TextBlock, config: NameDisplayConfig, blockDepthMm: number, letterGapsMm: number[][]): THREE.BufferGeometry | null {
  if (config.standMode !== 'rail') {
    return null;
  }
  const bounds = combinedBlockBounds(block, letterGapsMm, [{ x: 0, y: 0 }]);
  return baseRailGeometry({
    bounds,
    baselineYMm: block.baselineYMm,
    heightMm: config.railHeightMm,
    depthMm: config.railDepthMm,
    marginMm: config.railMarginMm,
    blockDepthMm,
  });
}

/** The initial's complete printable solid — the pocketed letter plus its base rail, if any. */
export function initialPrintGeometry(blocks: NameDisplayBlocks, assembly: NameDisplayAssembly, config: NameDisplayConfig): THREE.BufferGeometry {
  const rail = standGeometryFor(blocks.initial, config, config.initialDepthMm, []);
  return rail ? combineGeometries([assembly.initialGeometry, rail]) : assembly.initialGeometry;
}

/**
 * The name's complete printable solid — every letter at its current
 * gap-adjusted position, plus its base rail, if any. Built in the name's own
 * local frame (not shifted by nameOffset), since it prints as a separate piece
 * lying on its own: the offset only decides where the pocket went.
 */
export function namePrintGeometry(blocks: NameDisplayBlocks, config: NameDisplayConfig): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const line of blocks.name.lines) {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, config.nameLetterGapsMm));
    line.letters.forEach((letter, i) => {
      parts.push(cascade[i] === 0 ? letter.geometry : letter.geometry.clone().translate(cascade[i], 0, 0));
    });
  }
  const rail = standGeometryFor(blocks.name, config, config.nameDepthMm, [config.nameLetterGapsMm]);
  if (rail) {
    parts.push(rail);
  }
  return combineGeometries(parts);
}
