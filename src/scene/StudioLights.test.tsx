import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { StudioLights } from './StudioLights';

/**
 * The furthest any design can reach from where the light is aimed.
 *
 * The light aims at the world origin, which — once GroundCenter has stood the
 * design up — is its bottom center. So this is measured from there: half the
 * widest piece either product makes to one side, the tallest to the top, and
 * the deepest front to back.
 */
const DESIGN_REACH_MM = Math.hypot(
  300 / 2, // the widest a name can be set
  250 + 120, // a quarter-metre of lettering with picks under it
  40, // the deepest a base rail goes
);

async function keyLight() {
  const renderer = await ReactThreeTestRenderer.create(<StudioLights />);
  const lights = renderer.scene.children
    .map((child) => child.instance as unknown as THREE.Object3D)
    .filter((instance): instance is THREE.DirectionalLight => (instance as THREE.DirectionalLight).isDirectionalLight);
  const casting = lights.filter((light) => light.castShadow);
  expect(casting, 'exactly one light casts shadows').toHaveLength(1);
  return casting[0];
}

describe('the studio key light', () => {
  it('covers the whole design with its shadow map, not the 10mm box three.js defaults to', async () => {
    const light = await keyLight();
    const camera = light.shadow.camera;

    // A sphere this big around the light's target holds any design either
    // product can make; if the box holds the sphere, it holds the design.
    expect(camera.right).toBeGreaterThanOrEqual(DESIGN_REACH_MM);
    expect(camera.top).toBeGreaterThanOrEqual(DESIGN_REACH_MM);
    expect(camera.left).toBeLessThanOrEqual(-DESIGN_REACH_MM);
    expect(camera.bottom).toBeLessThanOrEqual(-DESIGN_REACH_MM);
  });

  it('brackets the design in depth too, so nothing is clipped in front of or behind it', async () => {
    const light = await keyLight();
    const camera = light.shadow.camera;
    // The light aims at the origin, so the design spans the distance to it,
    // give or take its own reach.
    const distance = light.position.length();

    expect(camera.near).toBeLessThanOrEqual(distance - DESIGN_REACH_MM);
    expect(camera.far).toBeGreaterThanOrEqual(distance + DESIGN_REACH_MM);
  });

  it('carries enough texels to be worth covering that much, and enough bias not to shadow itself', async () => {
    const light = await keyLight();
    const texelMm = (light.shadow.camera.right - light.shadow.camera.left) / light.shadow.mapSize.x;

    // Under half a millimeter per texel: the smallest thing that has to cast a
    // readable shadow is an inlay standing ~2mm proud of the piece behind it.
    expect(texelMm).toBeLessThan(0.5);
    // Acne shows up when the bias is finer than a texel.
    expect(light.shadow.normalBias).toBeGreaterThanOrEqual(texelMm);
  });
});
