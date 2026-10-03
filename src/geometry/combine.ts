import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges every part of a block — its letters and its sticks — into one printable
 * geometry. This is a plain, non-boolean buffer merge — not a CSG union. Every
 * input is already an individually watertight manifold solid with real
 * volumetric overlap where parts meet (letters at their natural kerning
 * overlap, sticks via stickGeometry's embedMm), and slicers handle
 * overlapping-but-manifold shells correctly, so true CSG isn't needed for this.
 * mergeGeometries requires uniformly indexed or non-indexed inputs.
 */
export function combineGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 0) {
    throw new Error('Need at least one geometry to merge');
  }
  const nonIndexed = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(nonIndexed, false);
  if (!merged) {
    throw new Error('Failed to merge geometry — incompatible attributes between parts');
  }
  merged.computeVertexNormals();
  return merged;
}
