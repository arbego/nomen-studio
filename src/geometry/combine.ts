import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges a piece's main solid (letters/word, or an accent shape) with its stick
 * into one printable geometry. This is a plain, non-boolean buffer merge — not a
 * CSG union. Both inputs are already individually watertight manifold solids with
 * real volumetric overlap (see stickGeometry's embedMm), and slicers handle
 * overlapping-but-manifold shells correctly, so true CSG isn't needed for this.
 * mergeGeometries requires uniformly indexed or non-indexed inputs.
 */
export function combinePickGeometry(main: THREE.BufferGeometry, stick: THREE.BufferGeometry): THREE.BufferGeometry {
  const a = main.index ? main.toNonIndexed() : main;
  const b = stick.index ? stick.toNonIndexed() : stick;
  const merged = mergeGeometries([a, b], false);
  if (!merged) {
    throw new Error('Failed to merge pick geometry — incompatible attributes between main shape and stick');
  }
  merged.computeVertexNormals();
  return merged;
}
