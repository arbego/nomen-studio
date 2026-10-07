import { describe, expect, it, vi } from 'vitest';
import { useLayoutEffect } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { extrudeMmShapes } from '../../geometry/extrudeToMm';
import { rectRegion, regionToShapes } from '../../geometry/clipper';
import { CableHoleEditor } from './CableHoleEditor';
import type { CableHolePlacement } from './config';

function rayEvent(x: number, y: number, side = false): ThreeEvent<PointerEvent> {
  return {
    ray: side ? new THREE.Ray(new THREE.Vector3(-100, x, y), new THREE.Vector3(1, 0, 0)) : new THREE.Ray(new THREE.Vector3(x, y, 100), new THREE.Vector3(0, 0, -1)),
    pointerId: 1,
    clientX: x * 10,
    clientY: y * 10,
    stopPropagation: vi.fn(),
    target: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() },
  } as unknown as ThreeEvent<PointerEvent>;
}

const backPlacement = { point: { x: 20, y: 10, z: 0 }, normal: { x: 0, y: 0, z: -1 } };

async function editor(position: [number, number, number] = [0, 0, 0], placement: CableHolePlacement = backPlacement, lidTransparent = true) {
  const surface = extrudeMmShapes(regionToShapes(rectRegion(0, 0, 40, 60)), 20)!;
  const controls = { enabled: true };
  const onCommit = vi.fn();
  const onSelect = vi.fn();
  function SetControls() {
    const set = useThree((state) => state.set);
    useLayoutEffect(() => { set({ controls: controls as never }); }, [set]);
    return null;
  }
  const renderer = await ReactThreeTestRenderer.create(
    <group position={position}>
      <SetControls />
      <CableHoleEditor surface={surface} hole={{ diameterMm: 6, placement, warning: null }} floorZ={2} lidTransparent={lidTransparent} onSelect={onSelect} onCommit={onCommit} />
    </group>,
  );
  const picking = renderer.scene.findByProps({ name: 'cable-hole-handle-0' });
  const ring = renderer.scene.findByProps({ name: 'cable-hole-ring-0' }).instance as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  async function click(event = rayEvent(20, 10)) {
    await renderer.fireEvent(picking, 'pointerDown', event);
    await renderer.fireEvent(picking, 'pointerUp', event);
  }
  return { renderer, picking, ring, surface, controls, onCommit, onSelect, click };
}

describe('cable-hole placement in the preview', () => {
  it('selects and highlights on the first click, without changing the design or reselecting on later clicks', async () => {
    const { renderer, ring, click, onSelect, onCommit } = await editor();
    expect(ring.material.color.getHexString()).toBe('78716c');
    await click();
    expect(ring.material.color.getHexString()).toBe('f97316');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    await click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    await renderer.fireEvent(renderer.scene.findByProps({ name: 'cable-hole-editor' }), 'pointerMissed');
    expect(ring.material.color.getHexString()).toBe('78716c');
    await click();
    expect(onSelect).toHaveBeenCalledTimes(2);
    await renderer.unmount();
  });

  it('requires a click to select the hole before a drag can move it', async () => {
    const { renderer, picking, ring, onSelect, onCommit, controls } = await editor();
    await renderer.fireEvent(picking, 'pointerDown', rayEvent(20, 10));
    await renderer.fireEvent(picking, 'pointerMove', rayEvent(25, 20));
    await renderer.fireEvent(picking, 'pointerUp', rayEvent(25, 20));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(ring.material.color.getHexString()).toBe('78716c');
    expect(controls.enabled).toBe(true);
    await renderer.unmount();
  });

  it('drags the marker without snapping its grab point and commits one back-face edit', async () => {
    const { renderer, picking, controls, onCommit, onSelect, click } = await editor();
    await click();
    await renderer.fireEvent(picking, 'pointerDown', rayEvent(21, 10));
    expect(controls.enabled).toBe(false);
    await renderer.fireEvent(picking, 'pointerMove', rayEvent(26, 20));
    expect(onCommit).not.toHaveBeenCalled();
    await renderer.fireEvent(picking, 'pointerUp', rayEvent(26, 20));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ point: { x: 25, y: 20, z: 0 }, normal: { x: 0, y: 0, z: -1 } });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(controls.enabled).toBe(true);
    await renderer.unmount();
  });

  it('selects and drags a hole on a side wall', async () => {
    const { renderer, picking, onCommit, click, onSelect } = await editor([0, 0, 0], { point: { x: 0, y: 30, z: 10 }, normal: { x: -1, y: 0, z: 0 } });
    await click(rayEvent(30, 10, true));
    await renderer.fireEvent(picking, 'pointerDown', rayEvent(30, 10, true));
    await renderer.fireEvent(picking, 'pointerMove', rayEvent(40, 12, true));
    await renderer.fireEvent(picking, 'pointerUp', rayEvent(40, 12, true));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ point: { x: 0, y: 40, z: 12 }, normal: { x: -1, y: 0, z: 0 } });
    expect(onSelect).toHaveBeenCalledTimes(1);
    await renderer.unmount();
  });

  it('converts a grounded scene position back into the initial’s own coordinates', async () => {
    const { renderer, picking, onCommit, click } = await editor([30, -12, 5]);
    await click(rayEvent(50, -2));
    await renderer.fireEvent(picking, 'pointerDown', rayEvent(50, -2));
    await renderer.fireEvent(picking, 'pointerMove', rayEvent(60, 18));
    await renderer.fireEvent(picking, 'pointerUp', rayEvent(60, 18));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith({ point: { x: 30, y: 30, z: 0 }, normal: { x: 0, y: 0, z: -1 } });
    await renderer.unmount();
  });

  it('cancels a drag without changing the design and releases orbit controls', async () => {
    const { renderer, picking, controls, onCommit, click } = await editor();
    await click();
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

  it('only hit-tests the hole and does not expose a front-facing handle through the opaque lid', async () => {
    const { renderer, surface } = await editor([0, 0, 0], backPlacement, false);
    expect(renderer.scene.findAllByProps({ geometry: surface })).toHaveLength(0);
    const handle = renderer.scene.findByProps({ name: 'cable-hole-handle-0' }).instance as THREE.Mesh;
    expect(renderer.scene.findAllByProps({ name: 'cable-hole-handle-1' })).toHaveLength(0);
    (renderer.scene.children[0].instance as THREE.Group).updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(20, 10, 100), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(handle)).toHaveLength(0);
    raycaster.set(new THREE.Vector3(20, 10, -100), new THREE.Vector3(0, 0, 1));
    expect(raycaster.intersectObject(handle)).not.toHaveLength(0);
    raycaster.set(new THREE.Vector3(30, 30, -100), new THREE.Vector3(0, 0, 1));
    expect(raycaster.intersectObject(handle)).toHaveLength(0);
    await renderer.unmount();
  });
});
