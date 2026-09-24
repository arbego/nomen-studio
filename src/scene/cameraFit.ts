import * as THREE from 'three';

/** Padding around the model's bounding box so it doesn't touch the viewport edges exactly. */
const DEFAULT_MARGIN = 1.2;

export interface FrontFitCamera {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * A camera pose that looks straight at `box` from the front — level with its
 * vertical center, along +Z, never tilted down at it — from whatever distance
 * fits its full width and height inside a `fovDegrees`/`aspect` perspective
 * camera's frustum, plus `margin` of padding. Assumes `box` is non-empty.
 */
export function fitCameraToBoxFrontal(box: THREE.Box3, fovDegrees: number, aspect: number, margin = DEFAULT_MARGIN): FrontFitCamera {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const verticalFovRad = THREE.MathUtils.degToRad(fovDegrees);
  const distanceForHeight = size.y / 2 / Math.tan(verticalFovRad / 2);
  const distanceForWidth = size.x / 2 / (Math.tan(verticalFovRad / 2) * aspect);
  const distance = Math.max(distanceForHeight, distanceForWidth) * margin;

  return {
    position: new THREE.Vector3(center.x, center.y, center.z + distance),
    target: center,
  };
}
