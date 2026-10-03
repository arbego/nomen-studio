import type * as THREE from 'three';
import type { TextBlock } from '../../geometry/types';
import { buildOutlineGeometry } from '../../geometry/outline';
import { combineGeometries } from '../../geometry/combine';
import { geometryToStlBinary } from '../../export/stlExport';
import { mergedBlockGeometry } from './geometry';
import type { CakeTopperConfig } from './config';

/** Binary STL bytes for a single block — every letter (at its current gap-adjusted position) merged with all its sticks, the printable solid. */
export function blockToStlBinary(block: TextBlock, config: CakeTopperConfig): DataView {
  return geometryToStlBinary(mergedBlockGeometry(block, config));
}

/** The outline card's own geometry under a block's current letters, or null when there's nothing to add (disabled, or not grown at all). */
function outlineGeometryFor(block: TextBlock, config: CakeTopperConfig): THREE.BufferGeometry | null {
  if (!config.outlineEnabled) {
    return null;
  }
  const outline = buildOutlineGeometry(block, config.letterGapsMm, config.lineOffsets, config.outlineGrowMm, config.outlineDepthMm, config.closedOutlineHoles);
  return outline?.mainGeometry ?? null;
}

/** Binary STL bytes for the outline card under a block's current letters, or null when there's nothing to export (disabled, or not grown at all). */
export function outlineToStlBinary(block: TextBlock, config: CakeTopperConfig): DataView | null {
  const geometry = outlineGeometryFor(block, config);
  if (!geometry) {
    return null;
  }
  return geometryToStlBinary(geometry);
}

/**
 * Binary STL bytes for one block's entire printable solid — letters, sticks,
 * and (when enabled) the outline card, all merged into a single file. STL has
 * no per-face color of its own here (color is cosmetic-only, from the printer
 * filament — see previewColor/outlineColor), so merging loses nothing a
 * separate file would have kept; it's the same plain, non-boolean buffer
 * merge already used for letters+sticks (see combine.ts).
 */
export function combinedStlBinary(block: TextBlock, config: CakeTopperConfig): DataView {
  const outlineGeometry = outlineGeometryFor(block, config);
  const geometry = outlineGeometry ? combineGeometries([mergedBlockGeometry(block, config), outlineGeometry]) : mergedBlockGeometry(block, config);
  return geometryToStlBinary(geometry);
}
