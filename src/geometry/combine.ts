import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges a pick's main solid (the letters) with one or more sticks into one
 * printable geometry. This is a plain, non-boolean buffer
 * merge — not a CSG union. Every input is already an individually watertight
 * manifold solid with real volumetric overlap (see stickGeometry's embedMm), and
 * slicers handle overlapping-but-manifold shells correctly, so true CSG isn't
 * needed for this. mergeGeometries requires uniformly indexed or non-indexed
 * inputs.
 */
export function combinePickGeometry(main: THREE.BufferGeometry, sticks: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (sticks.length === 0) {
    throw new Error('A pick needs at least one stick to merge');
  }
  const parts = [main, ...sticks].map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(parts, false);
  if (!merged) {
    throw new Error('Failed to merge pick geometry — incompatible attributes between main shape and sticks');
  }
  merged.computeVertexNormals();
  return merged;
}
