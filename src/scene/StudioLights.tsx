import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * How far from the light's aim the shadow map reaches before it has measured
 * anything, in millimeters.
 *
 * Three.js defaults a directional light's shadow camera to a 10mm box, which on
 * a design measured in hundreds of millimeters means shadows exist in one patch
 * the size of a fingernail and nowhere else. This covers the largest design
 * either product can make, so the very first frame is already right; the fit
 * below then pulls it in to whatever is actually on screen.
 */
const WORST_CASE_REACH_MM = 420;

/**
 * Where the key light sits.
 *
 * Only the *direction* of this reaches the shading — it is a directional light,
 * so the position merely says where its shadow camera stands. It stands a good
 * way back, because that camera has to have the whole design in front of it and
 * the tallest design reaches further from the origin than a close light would be.
 */
const KEY_LIGHT_POSITION: [number, number, number] = [240, 420, 360];

/** Room left around the design when fitting, so a piece dragged a little further doesn't immediately fall out of the map. */
const FIT_MARGIN = 1.12;

/** How much the fit has to move before it is worth rebuilding the projection, in millimeters. */
const REFIT_THRESHOLD_MM = 2;

/** How many texels across the shadow map is. Everything about how clean a shadow looks comes back to this divided by how much ground the map covers. */
const SHADOW_MAP_PX = 2048;

/**
 * Acne slack, as a multiple of one texel.
 *
 * A depth comparison can be off by about the size of a texel, so the bias has
 * to clear that — and since the map is fitted to the design, a texel is not a
 * fixed size and neither can this be.
 */
const NORMAL_BIAS_TEXELS = 1.2;

interface StudioLightsProps {
  /**
   * The design itself.
   *
   * The shadow map is a fixed number of texels however much ground it covers,
   * so covering the largest design imaginable spends most of them on empty
   * space and leaves a real one with stepped, sawtoothed shadow edges. Measured
   * every frame and fitted to what is actually there, a typical design gets
   * three or four times the resolution for nothing.
   */
  contentRef: RefObject<THREE.Group | null>;
  /** Whether the key light casts at all — see the shadow toggle in StudioCanvas. */
  castShadows: boolean;
}

/**
 * The studio's lighting, the same in both themes.
 *
 * Only the room changes with the theme, never the light: the job here is to
 * show what a filament will actually look like, and a design that shifted
 * colour when the UI theme did would be lying about the thing being printed.
 *
 * One key light casting shadows, one fill from behind and below to keep the
 * unlit faces from going flat, and enough ambient that nothing is ever black.
 * The key light's shadow is what makes an inlay read as inlaid — the name
 * stands a couple of millimeters proud of the initial, and without a shadow
 * that is a colour change rather than a step.
 */
export function StudioLights({ contentRef, castShadows }: StudioLightsProps) {
  const keyRef = useRef<THREE.DirectionalLight>(null);
  // Reused rather than allocated per frame: this runs every frame of every drag.
  const bounds = useMemo(() => new THREE.Box3(), []);
  const fittedMm = useRef(0);

  useFrame(() => {
    const light = keyRef.current;
    const content = contentRef.current;
    if (!light || !content) return;

    bounds.setFromObject(content);
    if (bounds.isEmpty()) return;
    const reach = reachFromOrigin(bounds) * FIT_MARGIN;
    if (Math.abs(reach - fittedMm.current) < REFIT_THRESHOLD_MM) return;
    fittedMm.current = reach;

    // The light aims at the origin, so a sphere of this radius around the
    // origin holds the design — and a box that holds the sphere holds the
    // design whichever way the light comes at it.
    const camera = light.shadow.camera;
    camera.left = -reach;
    camera.right = reach;
    camera.top = reach;
    camera.bottom = -reach;
    const distance = light.position.length();
    camera.near = Math.max(1, distance - reach);
    camera.far = distance + reach;
    camera.updateProjectionMatrix();
    // Nudging along the surface normal rather than in depth keeps an inlay's
    // own shadow attached to it instead of floating off.
    light.shadow.normalBias = ((2 * reach) / SHADOW_MAP_PX) * NORMAL_BIAS_TEXELS;
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight
        ref={keyRef}
        position={KEY_LIGHT_POSITION}
        intensity={1.1}
        castShadow={castShadows}
        shadow-mapSize={[SHADOW_MAP_PX, SHADOW_MAP_PX]}
        shadow-camera-left={-WORST_CASE_REACH_MM}
        shadow-camera-right={WORST_CASE_REACH_MM}
        shadow-camera-top={WORST_CASE_REACH_MM}
        shadow-camera-bottom={-WORST_CASE_REACH_MM}
        shadow-camera-near={1}
        shadow-camera-far={1100}
        // Matched to the fallback box above; the fit resets it to match itself.
        shadow-normalBias={((2 * WORST_CASE_REACH_MM) / SHADOW_MAP_PX) * NORMAL_BIAS_TEXELS}
      />
      <directionalLight position={[-100, 60, -80]} intensity={0.35} />
    </>
  );
}

/** How far the furthest corner of a box is from the origin — which is what the light aims at, and so what its shadow camera has to reach. */
function reachFromOrigin(box: THREE.Box3): number {
  return Math.hypot(
    Math.max(Math.abs(box.min.x), Math.abs(box.max.x)),
    Math.max(Math.abs(box.min.y), Math.abs(box.max.y)),
    Math.max(Math.abs(box.min.z), Math.abs(box.max.z)),
  );
}
