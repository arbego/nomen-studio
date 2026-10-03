import * as THREE from 'three';
import type { Offset2D, TextBlock } from '../../geometry/types';
import { buildTextBlock } from '../../geometry/textGeometry';
import { extrudeMmShapes } from '../../geometry/extrudeToMm';
import { combineGeometries } from '../../geometry/combine';
import { combinedBlockBounds, cumulativeGaps, normalizedLetterGaps } from '../../geometry/letterLayout';
import { growRegion, intersectRegions, regionFromContours, regionIsEmpty, regionToShapes, subtractRegions, type Region } from '../../geometry/clipper';
import { baseRailGeometry, trimBlockBelow, trimCutY } from '../../geometry/baseGeometry';
import type { NameDisplayConfig, NameDisplayGeometryConfig } from './config';

/**
 * A pocket can never take the whole thickness of the initial — that would cut
 * the piece in two. Capped well below it so there is always a solid back slab.
 */
const MAX_POCKET_FRACTION = 0.6;

export interface NameDisplayGeometry {
  /** The background initial, as rendered and printed: a back slab plus a front slab with the name's pocket cut out of it. */
  initial: TextBlock;
  /** The script name, a separate printed piece that drops into the pocket. */
  name: TextBlock;
  /** The initial's full solid, pocket included. */
  initialGeometry: THREE.BufferGeometry;
  /** How far the name stands proud of the initial's front face, in mm. */
  protrusionMm: number;
  /** The z at which the name's own extrusion starts — the pocket floor. */
  nameZMm: number;
}

/** The pocket depth actually used, after capping (see MAX_POCKET_FRACTION). */
export function effectivePocketDepthMm(config: NameDisplayGeometryConfig): number {
  const cap = Math.min(config.initialDepthMm * MAX_POCKET_FRACTION, config.nameDepthMm);
  return Math.max(0, Math.min(config.pocketDepthMm, cap));
}

/**
 * Every letter of a block as one filled 2D region, with each letter shifted to
 * its current gap-adjusted position and the whole block shifted by `offset` —
 * the block's true printed silhouette, counters included, which is what a
 * boolean has to work against.
 */
export function blockRegion(block: TextBlock, letterGapsMm: number[], offset: Offset2D): Region {
  const paths: Region = [];
  for (const line of block.lines) {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, letterGapsMm));
    line.letters.forEach((letter, i) => {
      paths.push(...regionFromContours(letter.contours, { x: cascade[i] + offset.x, y: offset.y }));
    });
  }
  return paths;
}

/**
 * The initial as two stacked slabs: a full-silhouette back slab, and a front
 * slab with the name's (clearance-grown) silhouette subtracted from it. The
 * result is a genuine recess in the front face, built entirely from 2D booleans
 * — no 3D CSG, which these planar prisms never need.
 *
 * Only the part of the name that actually overlaps the initial cuts anything:
 * the subtraction simply finds nothing to remove where the name overhangs,
 * which is most of it on a wide name.
 */
function initialGeometryWithPocket(initial: TextBlock, pocketClip: Region, config: NameDisplayGeometryConfig): THREE.BufferGeometry {
  const pocketDepth = effectivePocketDepthMm(config);
  const backDepth = config.initialDepthMm - pocketDepth;
  const face = blockRegion(initial, [], { x: 0, y: 0 });

  const parts: THREE.BufferGeometry[] = [];

  const backSlab = extrudeMmShapes(regionToShapes(face), backDepth);
  if (backSlab) {
    parts.push(backSlab);
  }

  if (pocketDepth > 0) {
    const frontShapes = regionToShapes(subtractRegions(face, pocketClip));
    const frontSlab = extrudeMmShapes(frontShapes, pocketDepth);
    if (frontSlab) {
      // Extrusions always start at z=0, so the front slab is lifted onto the back one.
      frontSlab.translate(0, 0, backDepth);
      parts.push(frontSlab);
    }
  }

  return combineGeometries(parts);
}

/**
 * Builds both pieces of a name display and the pocket that joins them.
 *
 * The expensive, async, font-dependent part. The name's position and letter
 * gaps feed into it because they decide where the pocket is cut — unlike the
 * cake topper, where dragging only moves a mesh, dragging here re-cuts the
 * initial, so a drag is committed before the rebuild rather than tracked live.
 */
export async function buildNameDisplay(config: NameDisplayGeometryConfig): Promise<NameDisplayGeometry> {
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

  // Standing is applied before the pocket is cut, so a trimmed name cuts only
  // the shape that will actually be printed.
  const initial = applyStand(rawInitial, config, config.initialDepthMm);
  const name = applyStand(rawName, config, config.nameDepthMm);

  const pocketClip = growRegion(blockRegion(name, config.nameLetterGapsMm, config.nameOffset), config.pocketClearanceMm);
  const initialGeometry = initialGeometryWithPocket(initial, pocketClip, config);

  const pocketDepth = effectivePocketDepthMm(config);
  return {
    initial,
    name,
    initialGeometry,
    protrusionMm: config.nameDepthMm - pocketDepth,
    nameZMm: config.initialDepthMm - pocketDepth,
  };
}

function applyStand(block: TextBlock, config: NameDisplayGeometryConfig, extrudeDepthMm: number): TextBlock {
  if (config.standMode !== 'trim') {
    return block;
  }
  return trimBlockBelow(block, trimCutY(block, config.trimOffsetMm), extrudeDepthMm);
}

/** A block's base rail, if the design has one — null for the other two standing modes. */
export function standGeometryFor(block: TextBlock, config: NameDisplayConfig, blockDepthMm: number, letterGapsMm: number[], offset: Offset2D): THREE.BufferGeometry | null {
  if (config.standMode !== 'rail') {
    return null;
  }
  const bounds = combinedBlockBounds(block, [letterGapsMm], [offset]);
  return baseRailGeometry({
    bounds,
    heightMm: config.railHeightMm,
    depthMm: config.railDepthMm,
    marginMm: config.railMarginMm,
    blockDepthMm,
  });
}

/** The initial's complete printable solid — the pocketed letter plus its base rail, if any. */
export function initialPrintGeometry(built: NameDisplayGeometry, config: NameDisplayConfig): THREE.BufferGeometry {
  const rail = standGeometryFor(built.initial, config, config.initialDepthMm, [], { x: 0, y: 0 });
  return rail ? combineGeometries([built.initialGeometry, rail]) : built.initialGeometry;
}

/**
 * The name's complete printable solid — every letter at its current
 * gap-adjusted position, plus its base rail, if any. Exported in its own local
 * frame (not shifted by nameOffset), since it prints as a separate piece lying
 * on its own: the offset only decides where the pocket went.
 */
export function namePrintGeometry(built: NameDisplayGeometry, config: NameDisplayConfig): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const line of built.name.lines) {
    const cascade = cumulativeGaps(normalizedLetterGaps(line.letters.length, config.nameLetterGapsMm));
    line.letters.forEach((letter, i) => {
      parts.push(cascade[i] === 0 ? letter.geometry : letter.geometry.clone().translate(cascade[i], 0, 0));
    });
  }
  const rail = standGeometryFor(built.name, config, config.nameDepthMm, config.nameLetterGapsMm, { x: 0, y: 0 });
  if (rail) {
    parts.push(rail);
  }
  return combineGeometries(parts);
}

/** Whether the name currently overlaps the initial at all — a name dragged clear of it would print a pocket-less initial and have nothing holding it. */
export function nameOverlapsInitial(built: NameDisplayGeometry, config: NameDisplayGeometryConfig): boolean {
  const face = blockRegion(built.initial, [], { x: 0, y: 0 });
  const nameRegion = blockRegion(built.name, config.nameLetterGapsMm, config.nameOffset);
  return !regionIsEmpty(intersectRegions(face, nameRegion));
}
