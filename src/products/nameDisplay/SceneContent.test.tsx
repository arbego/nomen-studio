import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { NameDisplayScene } from './SceneContent';
import { assembleNameDisplay, buildNameDisplayBlocks } from './geometry';
import { placePoint } from '../../geometry/placement';
import type { NameDisplayConfig } from './config';

const config: NameDisplayConfig = {
  initial: 'M',
  initialFontId: 'alfa-slab-one',
  initialHeightMm: 120,
  initialDepthMm: 12,
  initialColor: '#d9a9ab',
  name: 'Mia',
  nameFontId: 'dancing-script',
  nameWidthMm: 150,
  nameDepthMm: 5,
  nameColor: '#f7f5f2',
  nameOffset: { x: 0, y: 35 },
  nameLetterGapsMm: [0, 0],
  nameAngleDeg: 0,
  pocketDepthMm: 2.5,
  pocketClearanceMm: 0.25,
  standMode: 'none',
  standColor: '#2b2b2b',
  railHeightMm: 8,
  railDepthMm: 25,
  railMarginMm: 4,
  trimOffsetMm: 0,
};

async function renderScene(
  overrides: Partial<NameDisplayConfig> = {},
  onNameOffsetCommit: (offset: { x: number; y: number }) => void = () => {},
  onNameLetterGapCommit: (gapIndex: number, gapMm: number) => void = () => {},
) {
  const merged = { ...config, ...overrides };
  const blocks = await buildNameDisplayBlocks(merged);
  const assembly = assembleNameDisplay(blocks, merged);
  const renderer = await ReactThreeTestRenderer.create(
    <NameDisplayScene blocks={blocks} assembly={assembly} config={merged} onNameOffsetCommit={onNameOffsetCommit} onNameLetterGapCommit={onNameLetterGapCommit} />,
  );
  return { renderer, blocks, assembly, config: merged };
}

type TestInstance = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>['scene']['children'][number];

function root(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  return renderer.scene.children[0];
}

/** Meshes that are direct children of the scene group — the initial and any base rails (the name's letters live in their own group). */
function directMeshes(node: TestInstance) {
  return node.children.filter((c) => c.type === 'Mesh');
}

/** The group carrying the name's placement: turned by the angle, anchored so the turn happens about the name's own pivot. */
function nameAnchorGroup(node: TestInstance) {
  return node.children.filter((c) => c.type === 'Group')[0];
}

/** TextBlockMesh's own group inside it — what holds the letters, and the frame drags are measured in. */
function nameGroup(node: TestInstance) {
  return nameAnchorGroup(node).children.filter((c) => c.type === 'Group')[0];
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

describe('NameDisplayScene (React Three Fiber wiring)', () => {
  it('renders the initial as one pocketed solid, in the initial color', async () => {
    const { renderer, assembly } = await renderScene();
    const meshes = directMeshes(root(renderer));
    expect(meshes).toHaveLength(1); // no rail in 'none' mode

    const instance = meshes[0].instance as unknown as { material: { color: THREE.Color }; geometry: THREE.BufferGeometry };
    expect(instance.material.color.getHexString()).toBe('d9a9ab');
    expect(instance.geometry).toBe(assembly.initialGeometry);
  }, 30000);

  it('renders one mesh per letter of the name, in the name color', async () => {
    const { renderer } = await renderScene();
    const letters = nameGroup(root(renderer)).children.filter((c) => c.type === 'Mesh');
    expect(letters).toHaveLength(3); // M, i, a
    const instance = letters[0].instance as unknown as { material: { color: THREE.Color } };
    expect(instance.material.color.getHexString()).toBe('f7f5f2');
  }, 30000);

  it('seats the name at the pocket floor, so it sits in the recess', async () => {
    const { renderer, assembly } = await renderScene();
    const group = nameGroup(root(renderer)).instance as unknown as THREE.Object3D;
    group.updateMatrixWorld(true);
    expect(group.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(assembly.nameZMm, 5);
    expect(assembly.nameZMm).toBeCloseTo(12 - 2.5, 5);
  }, 30000);

  it.each([0, 20, -35])('places the name exactly where the pocket was cut, at %i°', async (nameAngleDeg) => {
    const { renderer, assembly } = await renderScene({ nameAngleDeg });
    const group = nameGroup(root(renderer)).instance as unknown as THREE.Object3D;
    group.updateMatrixWorld(true);
    const world = group.getWorldPosition(new THREE.Vector3());

    // The scene's composed transform has to reproduce placePoint exactly — it
    // is the same placement the pocket boolean used, so any disagreement here
    // is a recess that doesn't line up with the name sitting in it.
    const expected = placePoint(0, 0, assembly.namePlacement);
    expect(world.x).toBeCloseTo(expected.x, 4);
    expect(world.y).toBeCloseTo(expected.y, 4);
  }, 30000);

  it('adds a base rail under the initial, and only the initial, in rail mode', async () => {
    const { renderer } = await renderScene({ standMode: 'rail' });
    // The initial's own mesh plus the rail under it — and no second rail, since
    // the name is suspended partway up the initial by the pocket, not standing.
    expect(directMeshes(root(renderer))).toHaveLength(2);
    expect(root(renderer).children.filter((c) => c.type === 'Group')).toHaveLength(1);
  }, 30000);

  it("puts the rail under the initial's own depth, not the name's", async () => {
    const { renderer, config: used } = await renderScene({ standMode: 'rail' });
    const rail = directMeshes(root(renderer))[1].instance as unknown as THREE.Mesh;
    const bb = (rail.geometry as THREE.BufferGeometry).boundingBox!;
    expect(bb.max.z - bb.min.z).toBeCloseTo(used.railDepthMm, 3);
    // Centered on the initial's thickness, so it overhangs equally front and back.
    expect((bb.min.z + bb.max.z) / 2).toBeCloseTo(used.initialDepthMm / 2, 3);
  }, 30000);

  it('commits a drag of the name as an absolute offset, not a relative one', async () => {
    const onNameOffsetCommit = vi.fn();
    const { renderer } = await renderScene({}, onNameOffsetCommit);
    const group = nameGroup(root(renderer));
    const groupObject = group.instance as unknown as THREE.Object3D;
    const firstLetter = () => group.children.filter((c) => c.type === 'Mesh')[0];

    // Grab the first letter (which moves the whole name) and drag it 20mm right, 10mm up.
    await act(async () => (firstLetter().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 0, 0)));
    await act(async () => (firstLetter().props.onPointerMove as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 20, 10)));
    await act(async () => (firstLetter().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 20, 10)));

    expect(onNameOffsetCommit).toHaveBeenCalledTimes(1);
    // TextBlockMesh reports a line offset relative to the group it already sits
    // in, so the committed value must add to the name's existing offset —
    // otherwise every drag would teleport the name back toward the origin.
    const committed = onNameOffsetCommit.mock.calls[0][0];
    expect(committed.x).toBeCloseTo(config.nameOffset.x + 20, 1);
    expect(committed.y).toBeCloseTo(config.nameOffset.y + 10, 1);
  }, 30000);

  it('turns a tilted name\'s drag back into the initial\'s frame', async () => {
    const onNameOffsetCommit = vi.fn();
    const { renderer } = await renderScene({ nameAngleDeg: 90 }, onNameOffsetCommit);
    const group = nameGroup(root(renderer));
    const groupObject = group.instance as unknown as THREE.Object3D;
    const firstLetter = () => group.children.filter((c) => c.type === 'Mesh')[0];

    // Drag 10mm along the *name's own* x, which at 90° points straight up in
    // the initial's frame. Committed unrotated, the name would track the cursor
    // sideways instead of following it.
    await act(async () => (firstLetter().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 0, 0)));
    await act(async () => (firstLetter().props.onPointerMove as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 10, 0)));
    await act(async () => (firstLetter().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 10, 0)));

    const committed = onNameOffsetCommit.mock.calls[0][0];
    expect(committed.x).toBeCloseTo(config.nameOffset.x, 1);
    expect(committed.y).toBeCloseTo(config.nameOffset.y + 10, 1);
  }, 30000);

  it('commits a letter drag as a gap on the name', async () => {
    const onNameLetterGapCommit = vi.fn();
    const { renderer } = await renderScene({}, () => {}, onNameLetterGapCommit);
    const group = nameGroup(root(renderer));
    const groupObject = group.instance as unknown as THREE.Object3D;
    const secondLetter = () => group.children.filter((c) => c.type === 'Mesh')[1];

    await act(async () => (secondLetter().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 30, 0)));
    await act(async () => (secondLetter().props.onPointerMove as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 25, 0)));
    await act(async () => (secondLetter().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(groupObject, 25, 0)));

    expect(onNameLetterGapCommit).toHaveBeenCalledTimes(1);
    const [gapIndex, gapMm] = onNameLetterGapCommit.mock.calls[0];
    expect(gapIndex).toBe(0); // the gap before the second letter
    expect(gapMm).toBeCloseTo(-5, 1);
  }, 30000);
});
