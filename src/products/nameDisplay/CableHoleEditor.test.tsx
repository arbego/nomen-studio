import { describe, expect, it, vi } from 'vitest';
import { useLayoutEffect } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { extrudeMmShapes } from '../../geometry/extrudeToMm';
import { rectRegion, regionToShapes } from '../../geometry/clipper';
import { CableHoleEditor } from './CableHoleEditor';

function rayEvent(x: number, y: number, side = false): ThreeEvent<PointerEvent> {
  return {
    ray: side ? new THREE.Ray(new THREE.Vector3(-100, x, y), new THREE.Vector3(1, 0, 0)) : new THREE.Ray(new THREE.Vector3(x, y, 100), new THREE.Vector3(0, 0, -1)),
    pointerId: 1,
    stopPropagation: vi.fn(),
    target: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() },
  } as unknown as ThreeEvent<PointerEvent>;
}

async function editor(position: [number, number, number] = [0, 0, 0]) {
  const surface = extrudeMmShapes(regionToShapes(rectRegion(0, 0, 40, 60)), 20)!;
  const controls = { enabled: true };
  const onCommit = vi.fn();
  function SetControls() {
    const set = useThree((state) => state.set);
    useLayoutEffect(() => { set({ controls: controls as never }); }, [set]);
    return null;
  }
  const renderer = await ReactThreeTestRenderer.create(
    <group position={position}>
      <SetControls />
      <CableHoleEditor surface={surface} hole={{ diameterMm: 6, placement: { point: { x: 20, y: 10, z: 0 }, normal: { x: 0, y: 0, z: -1 } }, warning: null }} floorZ={2} onCommit={onCommit} />
    </group>,
  );
  const picking = renderer.scene.findByProps({ geometry: surface });
  return { renderer, picking, controls, onCommit };
}

describe('cable-hole placement in the preview', () => {
  it('drags the marker without snapping its grab point and commits one back-face edit', async () => {
    const { renderer, picking, controls, onCommit } = await editor();
    await renderer.fireEvent(picking, 'pointerDown', rayEvent(21, 10));
    expect(controls.enabled).toBe(false);
    await renderer.fireEvent(picking, 'pointerMove', rayEvent(26, 20));
    expect(onCommit).not.toHaveBeenCalled();
    await renderer.fireEvent(picking, 'pointerUp', rayEvent(26, 20));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ point: { x: 25, y: 20, z: 0 }, normal: { x: 0, y: 0, z: -1 } });
    expect(controls.enabled).toBe(true);
    await renderer.unmount();
  });

  it('places and drags a hole on a side wall', async () => {
    const { renderer, picking, onCommit } = await editor();
    await renderer.fireEvent(picking, 'pointerDown', rayEvent(30, 10, true));
    await renderer.fireEvent(picking, 'pointerMove', rayEvent(40, 12, true));
    await renderer.fireEvent(picking, 'pointerUp', rayEvent(40, 12, true));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ point: { x: 0, y: 40, z: 12 }, normal: { x: -1, y: 0, z: 0 } });
    await renderer.unmount();
  });

  it('converts a grounded scene position back into the initial’s own coordinates', async () => {
    const { renderer, picking, onCommit } = await editor([30, -12, 5]);
    await renderer.fireEvent(picking, 'pointerDown', rayEvent(60, 18));
    await renderer.fireEvent(picking, 'pointerUp', rayEvent(60, 18));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ point: { x: 30, y: 30, z: 0 }, normal: { x: 0, y: 0, z: -1 } });
    await renderer.unmount();
  });

  it('cancels a drag without changing the design and releases orbit controls', async () => {
    const { renderer, picking, controls, onCommit } = await editor();
    await renderer.fireEvent(picking, 'pointerDown', rayEvent(20, 10));
    await renderer.fireEvent(picking, 'pointerMove', rayEvent(25, 30));
    await renderer.fireEvent(picking, 'pointerCancel', rayEvent(25, 30));
    expect(onCommit).not.toHaveBeenCalled();
    expect(controls.enabled).toBe(true);
    await renderer.fireEvent(picking, 'pointerDown', rayEvent(20, 10));
    expect(controls.enabled).toBe(false);
    await renderer.unmount();
    expect(controls.enabled).toBe(true);
  });
});
