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
  stickOffsets: { word: [{ x: 0, y: 0 }], number: [{ x: 0, y: 0 }], accent: [{ x: 0, y: 0 }] },
  previewColor: '#f0c6d0',
};

const stickParams: StickParams = {
  lengthMm: config.stickLengthMm,
  widthMm: config.stickWidthMm,
  embedMm: config.stickEmbedMm,
  thicknessMm: config.extrudeDepthMm,
};

function renderScene(
  onStickOffsetCommit: (pickId: PickId, index: number, offset: StickOffset) => void = () => {},
  stickOffsets: Record<PickId, StickOffset[]> = config.stickOffsets,
) {
  return buildTopperPicks(config).then((picks) =>
    ReactThreeTestRenderer.create(
      <Scene picks={picks} color={config.previewColor} stick={stickParams} stickOffsets={stickOffsets} onStickOffsetCommit={onStickOffsetCommit} />,
    ).then((renderer) => ({ renderer, picks })),
  );
}

// Fake a pointer event whose picking ray, in the given group's local space,
// passes through (localX, localY, 0) — mirrors what dragUtils.localDragPoint expects.
function pointerEventAt(referenceObject: THREE.Object3D, localX: number, localY: number): ThreeEvent<PointerEvent> {
  referenceObject.updateMatrixWorld(true);
  const worldPoint = referenceObject.localToWorld(new THREE.Vector3(localX, localY, 0));
  const ray = new THREE.Ray(worldPoint.clone().add(new THREE.Vector3(0, 0, 50)), new THREE.Vector3(0, 0, -1));
  return {
    ray,
    pointerId: 1,
    stopPropagation: () => {},
    target: { setPointerCapture: () => {}, releasePointerCapture: () => {} },
  } as unknown as ThreeEvent<PointerEvent>;
}

function findPickGroups(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  return renderer.scene.children[0].children.filter((c) => c.type === 'Group');
}

/** Stick meshes are every mesh in a pick group after the first (the main letters/shape mesh). */
function findStickMeshes(group: ReturnType<typeof findPickGroups>[number]) {
  return group.children.filter((c) => c.type === 'Mesh').slice(1);
}

describe('Scene (React Three Fiber wiring)', () => {
  it('mounts a group per pick, each containing a main mesh and one stick mesh (the default) in the preview color', async () => {
    const { renderer } = await renderScene();

    const groups = findPickGroups(renderer);
    expect(groups).toHaveLength(3);

    for (const group of groups) {
      const meshes = group.children.filter((c) => c.type === 'Mesh');
      expect(meshes).toHaveLength(2); // main geometry + 1 stick

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

  it('renders one stick mesh per configured offset when a pick has multiple sticks', async () => {
    const multiStickOffsets: Record<PickId, StickOffset[]> = {
      ...config.stickOffsets,
      word: [{ x: -20, y: 0 }, { x: 0, y: 0 }, { x: 20, y: 0 }],
    };
    const { renderer } = await renderScene(undefined, multiStickOffsets);

    const [wordGroup, numberGroup] = findPickGroups(renderer);
    expect(findStickMeshes(wordGroup)).toHaveLength(3);
    expect(findStickMeshes(numberGroup)).toHaveLength(1);
  }, 30000);

  it('lays picks out left-to-right', async () => {
    const { renderer } = await renderScene();

    const groups = findPickGroups(renderer);
    const xPositions = groups.map((g) => (g.instance as unknown as { position: { x: number } }).position.x);

    // word, number, accent were built in that order and should stay left-to-right
    expect(xPositions[0]).toBeLessThan(xPositions[1]);
    expect(xPositions[1]).toBeLessThan(xPositions[2]);
  }, 30000);

  it('commits the dragged (x, y) offset, clamped to the piece, on pointer up', async () => {
    const onStickOffsetCommit = vi.fn();
    const { renderer, picks } = await renderScene(onStickOffsetCommit);
    const wordPick = picks.find((p) => p.id === 'word')!;

    const findStick = () => findStickMeshes(findPickGroups(renderer)[0])[0];
    const groupObject = findPickGroups(renderer)[0].instance as unknown as THREE.Object3D;

    // Each simulated event is wrapped in act() and re-reads props from the
    // instance afterward: StickMesh isn't memoized, so a state update (e.g. the
    // liveOffset set on pointer down) produces fresh handler closures on
    // re-render — reusing a handler captured before that update would still
    // see the old (stale) liveOffset.
    act(() => (findStick().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 10, 5)));
    expect(onStickOffsetCommit).not.toHaveBeenCalled(); // only commits on release

    act(() => (findStick().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 10, 5)));

    expect(onStickOffsetCommit).toHaveBeenCalledTimes(1);
    const [pickId, index, offset] = onStickOffsetCommit.mock.calls[0];
    const expected = clampStickOffsetToBounds(wordPick.mainGeometry, { x: 10, y: 5 }, config.stickWidthMm, config.stickEmbedMm);
    expect(pickId).toBe('word');
    expect(index).toBe(0);
    expect(offset.x).toBeCloseTo(expected.x, 5);
    expect(offset.y).toBeCloseTo(expected.y, 5);
  }, 30000);

  it('tracks pointer movement live between down and up, without committing until release', async () => {
    const onStickOffsetCommit = vi.fn();
    const { renderer, picks } = await renderScene(onStickOffsetCommit);
    const wordPick = picks.find((p) => p.id === 'word')!;

    const findStick = () => findStickMeshes(findPickGroups(renderer)[0])[0];
    const groupObject = findPickGroups(renderer)[0].instance as unknown as THREE.Object3D;

    act(() => (findStick().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 2, 2)));
    act(() => (findStick().props.onPointerMove as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 18, 3)));
    expect(onStickOffsetCommit).not.toHaveBeenCalled();

    act(() => (findStick().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 18, 3)));
    const [, , offset] = onStickOffsetCommit.mock.calls[0];
    const expected = clampStickOffsetToBounds(wordPick.mainGeometry, { x: 18, y: 3 }, config.stickWidthMm, config.stickEmbedMm);
    expect(offset.x).toBeCloseTo(expected.x, 5);
  }, 30000);

  it('reports the correct index when dragging the second stick of a multi-stick pick', async () => {
    const onStickOffsetCommit = vi.fn();
    const multiStickOffsets: Record<PickId, StickOffset[]> = {
      ...config.stickOffsets,
      word: [{ x: -20, y: 0 }, { x: 20, y: 0 }],
    };
    const { renderer } = await renderScene(onStickOffsetCommit, multiStickOffsets);

    const wordGroup = findPickGroups(renderer)[0];
    const groupObject = wordGroup.instance as unknown as THREE.Object3D;
    const findSecondStick = () => findStickMeshes(findPickGroups(renderer)[0])[1];

    act(() => (findSecondStick().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 25, 0)));
    act(() => (findSecondStick().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 25, 0)));

    expect(onStickOffsetCommit).toHaveBeenCalledTimes(1);
    const [pickId, index] = onStickOffsetCommit.mock.calls[0];
    expect(pickId).toBe('word');
    expect(index).toBe(1);
  }, 30000);
});
