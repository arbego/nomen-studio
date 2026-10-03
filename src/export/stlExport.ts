import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

const exporter = new STLExporter();

/**
 * Binary STL bytes for one printable solid.
 *
 * Products assemble their own geometry first — merging letters, sticks, base
 * rails and backing cards via combine.ts — and hand the finished solid here, so
 * this layer knows nothing about what it is exporting.
 */
export function geometryToStlBinary(geometry: THREE.BufferGeometry): DataView {
  const mesh = new THREE.Mesh(geometry);
  return exporter.parse(mesh, { binary: true }) as unknown as DataView;
}

/** Wraps STL bytes in a Blob ready to hand to `saveAs`. */
export function stlBlob(data: DataView): Blob {
  return new Blob([data.buffer as ArrayBuffer], { type: 'model/stl' });
}

export function slugifyFilename(text: string, fallback = 'design'): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}
