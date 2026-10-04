import * as THREE from 'three';

/**
 * Whether a point is inside a solid — the only way to ask "is there really a
 * hole here", which a bounding box can never answer.
 *
 * Casts a ray from the point and counts how many triangles it crosses: an odd
 * number means it started inside. Correct for any watertight mesh, which
 * everything this app builds is, and it needs no spatial index because test
 * meshes are small.
 */
export function pointIsInsideSolid(geometry: THREE.BufferGeometry, x: number, y: number, z: number): boolean {
  const position = geometry.getAttribute('position');
  // A deliberately crooked direction, so the ray is vanishingly unlikely to
  // graze an edge or a vertex shared by two triangles and count it twice.
  const ray = new THREE.Ray(new THREE.Vector3(x, y, z), new THREE.Vector3(0.317, 0.428, 0.847).normalize());
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const hit = new THREE.Vector3();

  let crossings = 0;
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    if (ray.intersectTriangle(a, b, c, false, hit)) {
      crossings += 1;
    }
  }
  return crossings % 2 === 1;
}
