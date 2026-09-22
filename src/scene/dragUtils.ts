import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';

const LOCAL_Z0_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

/**
 * Converts a pointer event's world-space picking ray into a point on the
 * z=0 plane of `referenceObject`'s own local coordinate space — the same
 * space stick offsets are expressed in. Using the ray (not the event's hit
 * point) means this keeps working even when the cursor drags off the actual
 * mesh surface, which a plain click-point lookup can't do.
 */
export function localDragPoint(event: ThreeEvent<PointerEvent>, referenceObject: THREE.Object3D): THREE.Vector2 | null {
  referenceObject.updateWorldMatrix(true, false);
  const inverse = referenceObject.matrixWorld.clone().invert();
  const localRay = event.ray.clone().applyMatrix4(inverse);

  const point = new THREE.Vector3();
  const hit = localRay.intersectPlane(LOCAL_Z0_PLANE, point);
  return hit ? new THREE.Vector2(point.x, point.y) : null;
}
