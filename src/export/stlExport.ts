import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import type { Pick, TopperConfig } from '../geometry/types';
import { mergedPickGeometry } from '../geometry/buildTopper';
import { buildOutlineGeometry } from '../geometry/outline';

const exporter = new STLExporter();

/** Binary STL bytes for a single pick — every letter (at its current gap-adjusted position) merged with all its sticks, the printable solid. */
export function pickToStlBinary(pick: Pick, config: TopperConfig): DataView {
  const geometry = mergedPickGeometry(pick, config);
  const mesh = new THREE.Mesh(geometry);
  return exporter.parse(mesh, { binary: true }) as unknown as DataView;
}

/** Binary STL bytes for the outline card under a pick's current letters, or null when there's nothing to export (disabled, or not grown at all). */
export function outlineToStlBinary(pick: Pick, config: TopperConfig): DataView | null {
  if (!config.outlineEnabled) {
    return null;
  }
  const outline = buildOutlineGeometry(pick, config.letterGapsMm, config.outlineGrowMm, config.extrudeDepthMm);
  if (!outline) {
    return null;
  }
  const mesh = new THREE.Mesh(outline.mainGeometry);
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
