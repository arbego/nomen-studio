import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import type { Pick, TopperConfig } from '../geometry/types';
import { mergedPickGeometry } from '../geometry/buildTopper';
import { buildOutlineGeometry } from '../geometry/outline';
import { combineGeometries } from '../geometry/combine';

const exporter = new STLExporter();

/** Binary STL bytes for a single pick — every letter (at its current gap-adjusted position) merged with all its sticks, the printable solid. */
export function pickToStlBinary(pick: Pick, config: TopperConfig): DataView {
  const geometry = mergedPickGeometry(pick, config);
  const mesh = new THREE.Mesh(geometry);
  return exporter.parse(mesh, { binary: true }) as unknown as DataView;
}

/** The outline card's own geometry under a pick's current letters, or null when there's nothing to add (disabled, or not grown at all). */
function outlineGeometryFor(pick: Pick, config: TopperConfig): THREE.BufferGeometry | null {
  if (!config.outlineEnabled) {
    return null;
  }
  const outline = buildOutlineGeometry(pick, config.letterGapsMm, config.outlineGrowMm, config.outlineDepthMm, config.closedOutlineHoles);
  return outline?.mainGeometry ?? null;
}

/** Binary STL bytes for the outline card under a pick's current letters, or null when there's nothing to export (disabled, or not grown at all). */
export function outlineToStlBinary(pick: Pick, config: TopperConfig): DataView | null {
  const geometry = outlineGeometryFor(pick, config);
  if (!geometry) {
    return null;
  }
  const mesh = new THREE.Mesh(geometry);
  return exporter.parse(mesh, { binary: true }) as unknown as DataView;
}

/**
 * Binary STL bytes for one pick's entire printable solid — letters, sticks,
 * and (when enabled) the outline card, all merged into a single file. STL has
 * no per-face color of its own here (color is cosmetic-only, from the printer
 * filament — see previewColor/outlineColor), so merging loses nothing a
 * separate file would have kept; it's the same plain, non-boolean buffer
 * merge already used for letters+sticks (see combine.ts).
 */
export function combinedStlBinary(pick: Pick, config: TopperConfig): DataView {
  const outlineGeometry = outlineGeometryFor(pick, config);
  const geometry = outlineGeometry ? combineGeometries([mergedPickGeometry(pick, config), outlineGeometry]) : mergedPickGeometry(pick, config);
  const mesh = new THREE.Mesh(geometry);
  return exporter.parse(mesh, { binary: true }) as unknown as DataView;
}

export function slugifyFilename(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'topper'
  );
}
