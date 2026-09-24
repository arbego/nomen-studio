import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { buildTopperPicks } from '../geometry/buildTopper';
import { clampStickOffsetToBounds } from '../geometry/stickGeometry';
import { gapForDesiredPosition } from '../geometry/letterLayout';
import type { Pick, PickId, StickOffset, TopperConfig } from '../geometry/types';
import { Scene } from './Scene';
import type { StickParams } from './PickMesh';

const config: TopperConfig = {
  lines: ['Emma'],
  wordFontId: 'dancing-script',
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  stickOffsets: { word: [{ x: 0, y: 0 }] },
  letterGapsMm: [[0, 0, 0]],
  lineOffsets: [{ x: 0, y: 0 }],
  previewColor: '#f0c6d0',
  outlineEnabled: false,
  outlineGrowMm: 3,
  outlineColor: '#f7f5f2',
  outlineDepthMm: 1.5,
  closedOutlineHoles: [],
};

const stickParams: StickParams = {
  lengthMm: config.stickLengthMm,
  widthMm: config.stickWidthMm,
  embedMm: config.stickEmbedMm,
  thicknessMm: config.extrudeDepthMm,
};

function allLetters(pick: Pick) {
  return pick.lines.flatMap((line) => line.letters);
}

function renderScene(
  onStickOffsetCommit: (pickId: PickId, index: number, offset: StickOffset) => void = () => {},
  stickOffsets: Record<PickId, StickOffset[]> = config.stickOffsets,
  letterGapsMm: number[][] = config.letterGapsMm,
  onLetterGapCommit: (pickId: PickId, lineIndex: number, gapIndex: number, gapMm: number) => void = () => {},
  outline: { outlineEnabled: boolean; outlineGrowMm: number; outlineColor: string; outlineDepthMm: number; closedOutlineHoles?: string[] } = config,
  lineOffsets: StickOffset[] = config.lineOffsets,
  onLineOffsetCommit: (pickId: PickId, lineIndex: number, offset: StickOffset) => void = () => {},
) {
  return buildTopperPicks(config).then((picks) =>
    ReactThreeTestRenderer.create(
      <Scene
        picks={picks}
        color={config.previewColor}
        stick={stickParams}
        stickColor={config.previewColor}
        stickOffsets={stickOffsets}
        onStickOffsetCommit={onStickOffsetCommit}
        letterGapsMm={letterGapsMm}
        onLetterGapCommit={onLetterGapCommit}
        lineOffsets={lineOffsets}
        onLineOffsetCommit={onLineOffsetCommit}
        outlineEnabled={outline.outlineEnabled}
        outlineGrowMm={outline.outlineGrowMm}
        outlineColor={outline.outlineColor}
        outlineDepthMm={outline.outlineDepthMm}
        closedOutlineHoles={outline.closedOutlineHoles ?? []}
      />,
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

function findMeshes(group: ReturnType<typeof findPickGroups>[number]) {
  return group.children.filter((c) => c.type === 'Mesh');
}

/** The first `letterCount` meshes in a pick group are its letters, across every line in order (see PickMesh's render order). */
function findLetterMeshes(group: ReturnType<typeof findPickGroups>[number], letterCount: number) {
  return findMeshes(group).slice(0, letterCount);
}

/** Every mesh after the letters is a stick. */
function findStickMeshes(group: ReturnType<typeof findPickGroups>[number], letterCount: number) {
  return findMeshes(group).slice(letterCount);
}

describe('Scene (React Three Fiber wiring)', () => {
  it('mounts a group for the word pick, with one mesh per letter plus one stick mesh (the default), in the preview color', async () => {
    const { renderer, picks } = await renderScene();
    const letterCount = allLetters(picks[0]).length;

    const groups = findPickGroups(renderer);
    expect(groups).toHaveLength(1);

    const meshes = findMeshes(groups[0]);
    expect(meshes).toHaveLength(letterCount + 1);

    for (const mesh of meshes) {
      const instance = mesh.instance as unknown as {
        geometry: { attributes: { position: { count: number } } };
        material: { color: { getHexString: () => string } };
      };
      expect(instance.geometry.attributes.position.count).toBeGreaterThan(0);
      expect(`#${instance.material.color.getHexString()}`).toBe(config.previewColor);
    }
  }, 30000);

  it('renders one stick mesh per configured offset when a pick has multiple sticks', async () => {
    const multiStickOffsets: Record<PickId, StickOffset[]> = {
      ...config.stickOffsets,
      word: [{ x: -20, y: 0 }, { x: 0, y: 0 }, { x: 20, y: 0 }],
    };
    const { renderer, picks } = await renderScene(undefined, multiStickOffsets);
    const letterCount = allLetters(picks[0]).length;

    const [wordGroup] = findPickGroups(renderer);
    expect(findStickMeshes(wordGroup, letterCount)).toHaveLength(3);
  }, 30000);

  it('renders every stick of a pick with its tip at the same height, even at different attach offsets', async () => {
    // Regression test: sticksForPick (the export path) already leveled tips,
    // but StickMesh (the live preview) built its geometry independently and
    // skipped that leveling — so what you saw in the 3D scene didn't match
    // what got exported. This renders the actual scene meshes to catch that.
    const multiStickOffsets: Record<PickId, StickOffset[]> = {
      ...config.stickOffsets,
      word: [{ x: -20, y: -6 }, { x: 0, y: 3 }, { x: 20, y: 9 }],
    };
    const { renderer, picks } = await renderScene(undefined, multiStickOffsets);
    const letterCount = allLetters(picks[0]).length;

    const [wordGroup] = findPickGroups(renderer);
    const tipYs = findStickMeshes(wordGroup, letterCount).map((mesh) => {
      const geometry = (mesh.instance as unknown as { geometry: THREE.BufferGeometry }).geometry;
      geometry.computeBoundingBox();
      return geometry.boundingBox!.min.y;
    });

    expect(tipYs[1]).toBeCloseTo(tipYs[0], 5);
    expect(tipYs[2]).toBeCloseTo(tipYs[0], 5);
  }, 30000);

  it('centers the single pick horizontally', async () => {
    const { renderer, picks } = await renderScene();
    const wordPick = picks.find((p) => p.id === 'word')!;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const letter of allLetters(wordPick)) {
      letter.geometry.computeBoundingBox();
      minX = Math.min(minX, letter.geometry.boundingBox!.min.x);
      maxX = Math.max(maxX, letter.geometry.boundingBox!.max.x);
    }
    const expectedX = -minX - (maxX - minX) / 2;

    const [group] = findPickGroups(renderer);
    const positionX = (group.instance as unknown as { position: { x: number } }).position.x;
    expect(positionX).toBeCloseTo(expectedX, 5);
  }, 30000);

  it('commits the dragged (x, y) offset, clamped to the piece, on pointer up', async () => {
    const onStickOffsetCommit = vi.fn();
    const { renderer, picks } = await renderScene(onStickOffsetCommit);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const letterCount = allLetters(wordPick).length;

    const findStick = () => findStickMeshes(findPickGroups(renderer)[0], letterCount)[0];
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
    const bounds = new THREE.Box3();
    allLetters(wordPick).forEach((letter) => {
      letter.geometry.computeBoundingBox();
      bounds.union(letter.geometry.boundingBox!);
    });
    const expected = clampStickOffsetToBounds(bounds, { x: 10, y: 5 }, config.stickWidthMm, config.stickEmbedMm);
    expect(pickId).toBe('word');
    expect(index).toBe(0);
    expect(offset.x).toBeCloseTo(expected.x, 5);
    expect(offset.y).toBeCloseTo(expected.y, 5);
  }, 30000);

  it('tracks pointer movement live between down and up, without committing until release', async () => {
    const onStickOffsetCommit = vi.fn();
    const { renderer, picks } = await renderScene(onStickOffsetCommit);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const letterCount = allLetters(wordPick).length;

    const findStick = () => findStickMeshes(findPickGroups(renderer)[0], letterCount)[0];
    const groupObject = findPickGroups(renderer)[0].instance as unknown as THREE.Object3D;

    act(() => (findStick().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 2, 2)));
    act(() => (findStick().props.onPointerMove as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 18, 3)));
    expect(onStickOffsetCommit).not.toHaveBeenCalled();

    act(() => (findStick().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 18, 3)));
    const [, , offset] = onStickOffsetCommit.mock.calls[0];
    const bounds = new THREE.Box3();
    allLetters(wordPick).forEach((letter) => {
      letter.geometry.computeBoundingBox();
      bounds.union(letter.geometry.boundingBox!);
    });
    const expected = clampStickOffsetToBounds(bounds, { x: 18, y: 3 }, config.stickWidthMm, config.stickEmbedMm);
    expect(offset.x).toBeCloseTo(expected.x, 5);
  }, 30000);

  it('reports the correct index when dragging the second stick of a multi-stick pick', async () => {
    const onStickOffsetCommit = vi.fn();
    const multiStickOffsets: Record<PickId, StickOffset[]> = {
      ...config.stickOffsets,
      word: [{ x: -20, y: 0 }, { x: 20, y: 0 }],
    };
    const { renderer, picks } = await renderScene(onStickOffsetCommit, multiStickOffsets);
    const letterCount = allLetters(picks[0]).length;

    const wordGroup = findPickGroups(renderer)[0];
    const groupObject = wordGroup.instance as unknown as THREE.Object3D;
    const findSecondStick = () => findStickMeshes(findPickGroups(renderer)[0], letterCount)[1];

    act(() => (findSecondStick().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 25, 0)));
    act(() => (findSecondStick().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 25, 0)));

    expect(onStickOffsetCommit).toHaveBeenCalledTimes(1);
    const [pickId, index] = onStickOffsetCommit.mock.calls[0];
    expect(pickId).toBe('word');
    expect(index).toBe(1);
  }, 30000);

  it("the first letter of a line has drag handlers too, but they move the whole line instead of a gap", async () => {
    const onLineOffsetCommit = vi.fn();
    const { renderer, picks } = await renderScene(undefined, config.stickOffsets, config.letterGapsMm, undefined, config, config.lineOffsets, onLineOffsetCommit);
    const letterCount = allLetters(picks[0]).length;
    const firstLetter = findLetterMeshes(findPickGroups(renderer)[0], letterCount)[0];
    const groupObject = findPickGroups(renderer)[0].instance as unknown as THREE.Object3D;
    expect(firstLetter.props.onPointerDown).toBeDefined();

    act(() => (firstLetter.props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 5, -12)));
    act(() => (firstLetter.props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 5, -12)));

    expect(onLineOffsetCommit).toHaveBeenCalledTimes(1);
    const [pickId, lineIndex, offset] = onLineOffsetCommit.mock.calls[0];
    expect(pickId).toBe('word');
    expect(lineIndex).toBe(0);
    expect(offset.x).toBeCloseTo(5, 5);
    expect(offset.y).toBeCloseTo(-12, 5);
  }, 30000);

  it('commits a letter-gap override, closing the gap immediately before the dragged letter, on pointer up', async () => {
    const onLetterGapCommit = vi.fn();
    const { renderer, picks } = await renderScene(undefined, config.stickOffsets, config.letterGapsMm, onLetterGapCommit);
    const wordPick = picks.find((p) => p.id === 'word')!;
    const letterCount = allLetters(wordPick).length;
    const naturalXsMm = wordPick.lines[0].letters.map((l) => l.naturalXMm);

    const findLetter1 = () => findLetterMeshes(findPickGroups(renderer)[0], letterCount)[1];
    const groupObject = findPickGroups(renderer)[0].instance as unknown as THREE.Object3D;
    const desiredX = naturalXsMm[1] - 3; // pull letter 1 three mm closer to letter 0

    act(() => (findLetter1().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, desiredX, 0)));
    expect(onLetterGapCommit).not.toHaveBeenCalled(); // only commits on release

    act(() => (findLetter1().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, desiredX, 0)));

    expect(onLetterGapCommit).toHaveBeenCalledTimes(1);
    const [pickId, lineIndex, gapIndex, gapMm] = onLetterGapCommit.mock.calls[0];
    expect(pickId).toBe('word');
    expect(lineIndex).toBe(0);
    expect(gapIndex).toBe(0); // the gap before letter 1
    const expectedGap = gapForDesiredPosition(1, desiredX, naturalXsMm, config.letterGapsMm[0]);
    expect(gapMm).toBeCloseTo(expectedGap, 5);
  }, 30000);

  it('cascades a letter drag live to every letter after it, before the drag is even released', async () => {
    const { renderer, picks } = await renderScene();
    const wordPick = picks.find((p) => p.id === 'word')!;
    const letterCount = allLetters(wordPick).length;
    const naturalXsMm = wordPick.lines[0].letters.map((l) => l.naturalXMm);

    const group = findPickGroups(renderer)[0];
    const groupObject = group.instance as unknown as THREE.Object3D;
    const findLetter = (i: number) => findLetterMeshes(findPickGroups(renderer)[0], letterCount)[i];
    const meshPositionX = (mesh: ReturnType<typeof findLetter>) => (mesh.instance as unknown as { position: { x: number } }).position.x;

    const desiredX = naturalXsMm[1] + 6; // push letter 1 to the right, opening its gap
    act(() => (findLetter(1).props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, desiredX, 0)));

    const draggedDelta = meshPositionX(findLetter(1));
    expect(draggedDelta).toBeCloseTo(desiredX - naturalXsMm[1], 3);
    // Letters 2 and 3 weren't dragged, but since their position is naturalX +
    // the *cumulative* gap sum, they should have shifted by the exact same
    // delta as letter 1 — not stayed at their natural position.
    expect(meshPositionX(findLetter(2))).toBeCloseTo(draggedDelta, 3);
    expect(meshPositionX(findLetter(3))).toBeCloseTo(draggedDelta, 3);
  }, 30000);

  it('renders no outline mesh when outlineEnabled is false', async () => {
    const { renderer } = await renderScene();
    const topLevelMeshes = renderer.scene.children[0].children.filter((c) => c.type === 'Mesh');
    expect(topLevelMeshes).toHaveLength(0);
  }, 30000);

  it('renders an outline mesh, in its own color and sharing the word\'s position, when enabled', async () => {
    const { renderer } = await renderScene(undefined, undefined, undefined, undefined, {
      outlineEnabled: true,
      outlineGrowMm: 3,
      outlineColor: '#123456',
      outlineDepthMm: 1.5,
    });

    const topLevelMeshes = renderer.scene.children[0].children.filter((c) => c.type === 'Mesh');
    expect(topLevelMeshes).toHaveLength(1);
    const [outlineMesh] = topLevelMeshes;

    const wordGroup = findPickGroups(renderer)[0];
    const outlineX = (outlineMesh.instance as unknown as { position: { x: number } }).position.x;
    const wordX = (wordGroup.instance as unknown as { position: { x: number } }).position.x;
    expect(outlineX).toBeCloseTo(wordX, 5);

    const material = (outlineMesh.instance as unknown as { material: { color: { getHexString: () => string } } }).material;
    expect(`#${material.color.getHexString()}`).toBe('#123456');
  }, 30000);
});
