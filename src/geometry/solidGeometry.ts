import * as THREE from 'three';
import type { Manifold, ManifoldToplevel } from 'manifold-3d';

const wasmUrl = new URL('../../node_modules/manifold-3d/manifold.wasm', import.meta.url).href;
let manifold: ManifoldToplevel | undefined;
let initialization: Promise<void> | undefined;

/** Load once with the fonts, leaving placement and cut updates synchronous. */
export function initializeSolidGeometry(): Promise<void> {
  initialization ??= (async () => {
    const [{ default: Module }, response] = await Promise.all([import('manifold-3d'), fetch(wasmUrl)]);
    if (!response.ok) throw new Error('Could not load the solid geometry engine.');
    const options = { locateFile: () => wasmUrl, wasmBinary: await response.arrayBuffer() };
    manifold = await Module(options);
    manifold.setup();
  })().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

/** Keep WASM solids within one operation so every allocation is released. */
export function withSolidGeometry<T>(operation: (engine: ManifoldToplevel, track: (solid: Manifold) => Manifold, fromGeometry: (geometry: THREE.BufferGeometry) => Manifold, toGeometry: (solid: Manifold, preserveIndices?: boolean) => THREE.BufferGeometry) => T): T {
  if (!manifold) throw new Error('The solid geometry engine is still loading.');
  const engine = manifold;
  const solids: Manifold[] = [];
  const track = (solid: Manifold) => { solids.push(solid); return solid; };
  const fromGeometry = (geometry: THREE.BufferGeometry) => {
    const position = geometry.getAttribute('position');
    const sourceIndex = geometry.getIndex();
    if (sourceIndex) {
      // Preserve the solid engine's topology. Distinct vertices can share a
      // position at a tangency without being the same topological vertex.
      const vertices = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) vertices.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
      return track(new engine.Manifold(new engine.Mesh({ numProp: 3, vertProperties: vertices, triVerts: new Uint32Array(sourceIndex.array) })));
    }
    const vertices: number[] = [];
    const indices: number[] = [];
    const unique = new Map<string, number>();
    for (let i = 0; i < position.count; i++) {
      const point = [position.getX(i), position.getY(i), position.getZ(i)];
      const key = point.join(',');
      let index = unique.get(key);
      if (index === undefined) {
        index = vertices.length / 3;
        vertices.push(...point);
        unique.set(key, index);
      }
      indices.push(index);
    }
    return track(new engine.Manifold(new engine.Mesh({ numProp: 3, vertProperties: new Float32Array(vertices), triVerts: new Uint32Array(indices) })));
  };
  const toGeometry = (solid: Manifold, preserveIndices = false) => {
    const mesh = solid.getMesh();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertProperties, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.triVerts, 1));
    const result = preserveIndices ? geometry : geometry.toNonIndexed();
    if (!preserveIndices) geometry.dispose();
    result.computeVertexNormals();
    result.computeBoundingBox();
    return result;
  };
  try {
    return operation(engine, track, fromGeometry, toGeometry);
  } finally {
    for (const solid of solids.reverse()) solid.delete();
  }
}
