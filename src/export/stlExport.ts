import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import type { Pick, TopperConfig } from '../geometry/types';
import { mergedPickGeometry } from '../geometry/buildTopper';

const exporter = new STLExporter();

/** Binary STL bytes for a single pick — main geometry merged with its stick, the printable solid. */
export function pickToStlBinary(pick: Pick, config: TopperConfig): DataView {
  const geometry = mergedPickGeometry(pick.mainGeometry, config, pick.id);
  const mesh = new THREE.Mesh(geometry);
  return exporter.parse(mesh, { binary: true }) as unknown as DataView;
}

/**
 * Lays every pick side by side on a virtual bed (translated copies, not a boolean
 * union) and exports them as one combined STL — an alternative to the default
 * separate-files-per-pick export, for anyone who wants a single importable file.
 */
export function picksToCombinedStlBinary(picks: Pick[], config: TopperConfig, gapMm = 15): DataView {
  const group = new THREE.Group();
  let cursorX = 0;
  for (const pick of picks) {
    const geometry = mergedPickGeometry(pick.mainGeometry, config, pick.id);
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const width = bb.max.x - bb.min.x;
    const mesh = new THREE.Mesh(geometry);
    mesh.position.x = cursorX - bb.min.x;
    group.add(mesh);
    cursorX += width + gapMm;
  }
  return exporter.parse(group, { binary: true }) as unknown as DataView;
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
