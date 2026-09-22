import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { buildTopperPicks } from '../geometry/buildTopper';
import { clampStickOffsetToBounds } from '../geometry/stickGeometry';
import type { PickId, StickOffset, TopperConfig } from '../geometry/types';
import { Scene } from './Scene';
import type { StickParams } from './PickMesh';

const config: TopperConfig = {
  word: 'Emma',
  wordFontId: 'dancing-script',
  number: '6',
  numberFontId: 'quicksand',
  accentShapeId: 'heart',
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  stickOffsets: { word: { x: 0, y: 0 }, number: { x: 0, y: 0 }, accent: { x: 0, y: 0 } },
  previewColor: '#f0c6d0',
};

const stickParams: StickParams = {
  lengthMm: config.stickLengthMm,
  widthMm: config.stickWidthMm,
  embedMm: config.stickEmbedMm,
  thicknessMm: config.extrudeDepthMm,
};

function renderScene(onStickOffsetCommit: (pickId: PickId, offset: StickOffset) => void = () => {}) {
  return buildTopperPicks(config).then((picks) =>
    ReactThreeTestRenderer.create(
      <Scene picks={picks} color={config.previewColor} stick={stickParams} stickOffsets={config.stickOffsets} onStickOffsetCommit={onStickOffsetCommit} />,
    ).then((renderer) => ({ renderer, picks })),
  );
}

// Fake a pointer event whose picking ray, in the given group's local space,
// passes through (localX, localY, 0) — mirrors what dragUtils.localDragPoint expects.
function pointerEventAt(group: THREE.Object3D, localX: number, localY: number): ThreeEvent<PointerEvent> {
  group.updateMatrixWorld(true);
  const worldPoint = group.localToWorld(new THREE.Vector3(localX, localY, 0));
  const ray = new THREE.Ray(worldPoint.clone().add(new THREE.Vector3(0, 0, 50)), new THREE.Vector3(0, 0, -1));
  return {
    ray,
    pointerId: 1,
    stopPropagation: () => {},
    target: { setPointerCapture: () => {}, releasePointerCapture: () => {} },
  } as unknown as ThreeEvent<PointerEvent>;
}

describe('Scene (React Three Fiber wiring)', () => {
  it('mounts a group per pick, each containing a main mesh and a stick mesh in the preview color', async () => {
    const { renderer } = await renderScene();

    const groups = renderer.scene.children[0].children.filter((c) => c.type === 'Group');
    expect(groups).toHaveLength(3);

    for (const group of groups) {
      const meshes = group.children.filter((c) => c.type === 'Mesh');
      expect(meshes).toHaveLength(2); // main geometry + stick

      for (const mesh of meshes) {
        const instance = mesh.instance as unknown as {
          geometry: { attributes: { position: { count: number } } };
          material: { color: { getHexString: () => string } };
        };
        expect(instance.geometry.attributes.position.count).toBeGreaterThan(0);
        expect(`#${instance.material.color.getHexString()}`).toBe(config.previewColor);
      }
    }
  }, 30000);

  it('lays picks out left-to-right', async () => {
    const { renderer } = await renderScene();

    const groups = renderer.scene.children[0].children.filter((c) => c.type === 'Group');
    const xPositions = groups.map((g) => (g.instance as unknown as { position: { x: number } }).position.x);

    // word, number, accent were built in that order and should stay left-to-right
    expect(xPositions[0]).toBeLessThan(xPositions[1]);
    expect(xPositions[1]).toBeLessThan(xPositions[2]);
  }, 30000);

  it('commits the dragged (x, y) offset, clamped to the piece, on pointer up', async () => {
    const onStickOffsetCommit = vi.fn();
    const { renderer, picks } = await renderScene(onStickOffsetCommit);
    const wordPick = picks.find((p) => p.id === 'word')!;

    const findWordGroup = () => renderer.scene.children[0].children.filter((c) => c.type === 'Group')[0];
    const groupObject = findWordGroup().instance as unknown as THREE.Object3D;

    // Each simulated event is wrapped in act() and re-reads props from the
    // instance afterward: PickMesh isn't memoized, so a state update (e.g. the
    // liveOffset set on pointer down) produces fresh handler closures on
    // re-render — reusing a handler captured before that update would still
    // see the old (stale) liveOffset.
    act(() => (findWordGroup().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 10, 5)));
    expect(onStickOffsetCommit).not.toHaveBeenCalled(); // only commits on release

    act(() => (findWordGroup().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 10, 5)));

    expect(onStickOffsetCommit).toHaveBeenCalledTimes(1);
    const [pickId, offset] = onStickOffsetCommit.mock.calls[0];
    const expected = clampStickOffsetToBounds(wordPick.mainGeometry, { x: 10, y: 5 }, config.stickWidthMm, config.stickEmbedMm);
    expect(pickId).toBe('word');
    expect(offset.x).toBeCloseTo(expected.x, 5);
    expect(offset.y).toBeCloseTo(expected.y, 5);
  }, 30000);

  it('tracks pointer movement live between down and up, without committing until release', async () => {
    const onStickOffsetCommit = vi.fn();
    const { renderer, picks } = await renderScene(onStickOffsetCommit);
    const wordPick = picks.find((p) => p.id === 'word')!;

    const findWordGroup = () => renderer.scene.children[0].children.filter((c) => c.type === 'Group')[0];
    const groupObject = findWordGroup().instance as unknown as THREE.Object3D;

    act(() => (findWordGroup().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 2, 2)));
    act(() => (findWordGroup().props.onPointerMove as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 18, 3)));
    expect(onStickOffsetCommit).not.toHaveBeenCalled();

    act(() => (findWordGroup().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 18, 3)));
    const [, offset] = onStickOffsetCommit.mock.calls[0];
    const expected = clampStickOffsetToBounds(wordPick.mainGeometry, { x: 18, y: 3 }, config.stickWidthMm, config.stickEmbedMm);
    expect(offset.x).toBeCloseTo(expected.x, 5);
  }, 30000);
});
