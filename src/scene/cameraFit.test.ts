import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitCameraToBoxFrontal } from './cameraFit';

describe('fitCameraToBoxFrontal', () => {
  it('targets the exact center of the box', () => {
    const box = new THREE.Box3(new THREE.Vector3(-10, 0, -2), new THREE.Vector3(30, 40, 2));
    const { target } = fitCameraToBoxFrontal(box, 35, 1.5);
    expect(target.x).toBeCloseTo(10, 6);
    expect(target.y).toBeCloseTo(20, 6);
    expect(target.z).toBeCloseTo(0, 6);
  });

  it('positions the camera level with the box (same x/y as center) and in front of it (+Z), never tilted', () => {
    const box = new THREE.Box3(new THREE.Vector3(-10, 0, -2), new THREE.Vector3(30, 40, 2));
    const { position, target } = fitCameraToBoxFrontal(box, 35, 1.5);
    expect(position.x).toBeCloseTo(target.x, 6);
    expect(position.y).toBeCloseTo(target.y, 6);
    expect(position.z).toBeGreaterThan(target.z);
  });

  it('blocks the height-limited distance for a tall, narrow box', () => {
    const box = new THREE.Box3(new THREE.Vector3(-5, -50, 0), new THREE.Vector3(5, 50, 0));
    const fovDeg = 35;
    const aspect = 1.5;
    const margin = 1;
    const { position, target } = fitCameraToBoxFrontal(box, fovDeg, aspect, margin);
    const expectedDistance = 100 / 2 / Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
    expect(position.z - target.z).toBeCloseTo(expectedDistance, 5);
  });

  it('blocks the width-limited distance for a wide, short box, accounting for aspect ratio', () => {
    const box = new THREE.Box3(new THREE.Vector3(-100, -5, 0), new THREE.Vector3(100, 5, 0));
    const fovDeg = 35;
    const aspect = 1.5;
    const margin = 1;
    const { position, target } = fitCameraToBoxFrontal(box, fovDeg, aspect, margin);
    const vFov = THREE.MathUtils.degToRad(fovDeg);
    const expectedDistance = 200 / 2 / (Math.tan(vFov / 2) * aspect);
    expect(position.z - target.z).toBeCloseTo(expectedDistance, 5);
  });

  it('scales the fit distance by the given margin', () => {
    const box = new THREE.Box3(new THREE.Vector3(-5, -50, 0), new THREE.Vector3(5, 50, 0));
    const unmargined = fitCameraToBoxFrontal(box, 35, 1.5, 1);
    const margined = fitCameraToBoxFrontal(box, 35, 1.5, 1.2);
    const baseDistance = unmargined.position.z - unmargined.target.z;
    const marginedDistance = margined.position.z - margined.target.z;
    expect(marginedDistance).toBeCloseTo(baseDistance * 1.2, 5);
  });
});
