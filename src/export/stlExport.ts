import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import type { Pick, TopperConfig } from '../geometry/types';
import { mergedPickGeometry } from '../geometry/buildTopper';

const exporter = new STLExporter();

/** Binary STL bytes for a single pick — main geometry merged with all its sticks, the printable solid. */
export function pickToStlBinary(pick: Pick, config: TopperConfig): DataView {
  const geometry = mergedPickGeometry(pick.mainGeometry, config, pick.id);
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
