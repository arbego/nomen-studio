import { useRef } from 'react';
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
const WORST_CASE_REACH_MM = Math.hypot(
  300 / 2, // the widest a name can be set
  250 + 120, // a quarter-metre of lettering with picks under it
  40, // the deepest a base rail goes
);

/** A design of a given width and height, standing on the ground and centered on the origin, exactly as GroundCenter leaves one. */
function Scene({ widthMm, heightMm }: { widthMm?: number; heightMm?: number }) {
  const content = useRef<THREE.Group>(null);
  return (
    <>
      <group ref={content}>
        {widthMm !== undefined && heightMm !== undefined && (
          <mesh position={[0, heightMm / 2, 0]}>
            <boxGeometry args={[widthMm, heightMm, 12]} />
          </mesh>
        )}
      </group>
      <StudioLights contentRef={content} castShadows />
    </>
  );
}

async function keyLightOver(design: { widthMm?: number; heightMm?: number }) {
  const renderer = await ReactThreeTestRenderer.create(<Scene {...design} />);
  await renderer.advanceFrames(3, 16);
  const lights = renderer.scene.children
    .map((child) => child.instance as unknown as THREE.Object3D)
    .filter((instance): instance is THREE.DirectionalLight => (instance as THREE.DirectionalLight).isDirectionalLight);
  const casting = lights.filter((light) => light.castShadow);
  expect(casting, 'exactly one light casts shadows').toHaveLength(1);
  return casting[0];
}

describe('the studio key light', () => {
  it('covers the largest design imaginable before it has measured anything', async () => {
    // Nothing on screen yet, so nothing to fit to — the fallback is all there
    // is, and a first frame with the three.js default 10mm box would put
    // shadows in one patch the size of a fingernail and nowhere else.
    const camera = (await keyLightOver({})).shadow.camera;

    expect(camera.right).toBeGreaterThanOrEqual(WORST_CASE_REACH_MM);
    expect(camera.top).toBeGreaterThanOrEqual(WORST_CASE_REACH_MM);
    expect(camera.left).toBeLessThanOrEqual(-WORST_CASE_REACH_MM);
    expect(camera.bottom).toBeLessThanOrEqual(-WORST_CASE_REACH_MM);
  });

  it('brackets that in depth too, so nothing is clipped in front of or behind it', async () => {
    const light = await keyLightOver({});
    // The light aims at the origin, so the design spans the distance to it,
    // give or take its own reach.
    const distance = light.position.length();

    expect(light.shadow.camera.near).toBeLessThanOrEqual(distance - WORST_CASE_REACH_MM);
    expect(light.shadow.camera.far).toBeGreaterThanOrEqual(distance + WORST_CASE_REACH_MM);
  });

  it('pulls the map in around the design once there is one, which is what keeps its edges clean', async () => {
    const widthMm = 150;
    const heightMm = 100;
    const light = await keyLightOver({ widthMm, heightMm });
    const camera = light.shadow.camera;
    const reach = Math.hypot(widthMm / 2, heightMm, 6);

    // Still covers it…
    expect(camera.right).toBeGreaterThanOrEqual(reach);
    // …but nothing like the whole worst case, which is where the stepped
    // shadow edges came from: a fixed number of texels spread over mostly
    // empty space.
    expect(camera.right).toBeLessThan(WORST_CASE_REACH_MM / 2);

    const distance = light.position.length();
    expect(camera.near).toBeLessThanOrEqual(distance - reach);
    expect(camera.far).toBeGreaterThanOrEqual(distance + reach);
  });

  it('spends its texels finely enough for an inlay to cast a readable shadow', async () => {
    const light = await keyLightOver({ widthMm: 150, heightMm: 100 });
    const texelMm = (light.shadow.camera.right - light.shadow.camera.left) / light.shadow.mapSize.x;

    // Well under a tenth of a millimeter on a design this size. The smallest
    // thing that has to cast a readable shadow is an inlay standing ~2mm proud.
    expect(texelMm).toBeLessThan(0.2);
    // Acne shows up when the bias is finer than a texel.
    expect(light.shadow.normalBias).toBeGreaterThanOrEqual(texelMm);
  });

  it('stops casting when shadows are switched off', async () => {
    const renderer = await ReactThreeTestRenderer.create(<StudioLightsOff />);
    await renderer.advanceFrames(2, 16);
    const casting = renderer.scene.children
      .map((child) => child.instance as unknown as THREE.DirectionalLight)
      .filter((instance) => instance.isDirectionalLight && instance.castShadow);
    expect(casting).toHaveLength(0);
  });
});

function StudioLightsOff() {
  const content = useRef<THREE.Group>(null);
  return (
    <>
      <group ref={content} />
      <StudioLights contentRef={content} castShadows={false} />
    </>
  );
}
