import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { NameDisplayScene } from './SceneContent';
import { GroundCenter } from '../../scene/GroundCenter';
import { assembleNameDisplay, buildNameDisplayBlocks, type NameDisplayAssembly, type NameDisplayBlocks } from './geometry';
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
  decorators: [],
  decoratorPlacements: {},
  decoratorColors: {},
  pocketDepthMm: 2.5,
  pocketClearanceMm: 0.25,
  standMode: 'none',
  standColor: '#2b2b2b',
  railHeightMm: 8,
  railDepthMm: 25,
  railMarginMm: 4,
  railSocketDepthMm: 5,
  trimOffsetMm: 0,
};

async function renderScene(
  overrides: Partial<NameDisplayConfig> = {},
  onNameOffsetCommit: (offset: { x: number; y: number }) => void = () => {},
  onNameLetterGapCommit: (gapIndex: number, gapMm: number) => void = () => {},
  onDecoratorOffsetCommit: (id: string, offset: { x: number; y: number }) => void = () => {},
  taps: { onInitialTap?: () => void; onNameTap?: () => void; onDecoratorTap?: (id: string) => void } = {},
) {
  const merged = { ...config, ...overrides };
  const blocks = await buildNameDisplayBlocks(merged);
  const assembly = assembleNameDisplay(blocks, merged);
  const renderer = await ReactThreeTestRenderer.create(
    <NameDisplayScene blocks={blocks} assembly={assembly} config={merged} onNameOffsetCommit={onNameOffsetCommit} onNameLetterGapCommit={onNameLetterGapCommit} onDecoratorOffsetCommit={onDecoratorOffsetCommit} {...taps} />,
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

/** The group holding one ornament's icon: its anchor group's inner TextBlockMesh group. */
function decoratorGroup(node: TestInstance, index = 0) {
  const anchors = node.children.filter((c) => c.type === 'Group');
  return anchors[1 + index].children.filter((c) => c.type === 'Group')[0];
}

/** TextBlockMesh's own group inside it — what holds the letters, and the frame drags are measured in. */
function nameGroup(node: TestInstance) {
  return nameAnchorGroup(node).children.filter((c) => c.type === 'Group')[0];
}

// Fake a pointer event whose picking ray, in the given group's local space,
// passes through (localX, localY, 0) — mirrors what dragUtils.localDragPoint expects.
function pointerEventAt(referenceObject: THREE.Object3D, localX: number, localY: number, screen?: { x: number; y: number }): ThreeEvent<PointerEvent> {
  referenceObject.updateMatrixWorld(true);
  const worldPoint = referenceObject.localToWorld(new THREE.Vector3(localX, localY, 0));
  const ray = new THREE.Ray(worldPoint.clone().add(new THREE.Vector3(0, 0, 50)), new THREE.Vector3(0, 0, -1));
  return {
    ray,
    pointerId: 1,
    // Where the pointer was on screen, which is what tells a click from a drag
    // (see scene/tapGesture.ts). Left off by every test that is only about
    // dragging, so none of them accidentally also clicks.
    ...(screen ? { clientX: screen.x, clientY: screen.y } : {}),
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

  it('stands on the ground once a base rail is added, not above it', async () => {
    // The rail hangs below the initial's baseline, which is where the piece used
    // to be resting — so a design grounded before the rail existed kept the
    // letter on the floor and left the rail dangling through it.
    const grounded = (config: NameDisplayConfig, blocks: NameDisplayBlocks, assembly: NameDisplayAssembly) => (
      <GroundCenter>
        <NameDisplayScene blocks={blocks} assembly={assembly} config={config} onNameOffsetCommit={() => {}} onNameLetterGapCommit={() => {}} onDecoratorOffsetCommit={() => {}} />
      </GroundCenter>
    );

    // Standing on nothing first, then given a rail — the order a person does it
    // in, and the only order in which the bug appears.
    const plainBlocks = await buildNameDisplayBlocks(config);
    const renderer = await ReactThreeTestRenderer.create(grounded(config, plainBlocks, assembleNameDisplay(plainBlocks, config)));
    await renderer.advanceFrames(2, 16);

    const merged = { ...config, standMode: 'rail' as const };
    const blocks = await buildNameDisplayBlocks(merged);
    const assembly = assembleNameDisplay(blocks, merged);
    await renderer.update(grounded(merged, blocks, assembly));
    await renderer.advanceFrames(2, 16);

    const root = renderer.scene.children[0].instance as unknown as THREE.Object3D;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root, true);
    expect(box.min.y).toBeCloseTo(0, 3);
    // And it is the rail doing the standing: its underside is what touches.
    expect(box.max.y - box.min.y).toBeGreaterThan(config.initialHeightMm);
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

  it.each([0, 45, -120])('renders a decorator seated in its own pocket, at %i°', async (angleDeg) => {
    const { renderer, assembly } = await renderScene({
      decorators: [{ kind: 'icon', id: 'd1', iconName: 'favorite', widthMm: 25, depthMm: 5 }],
      decoratorPlacements: { d1: { offset: { x: 20, y: 90 }, angleDeg } },
    });

    // The name's anchor group plus the decorator's own.
    const groups = root(renderer).children.filter((c) => c.type === 'Group');
    expect(groups).toHaveLength(2);

    const object = decoratorGroup(root(renderer)).instance as unknown as THREE.Object3D;
    object.updateMatrixWorld(true);
    const world = object.getWorldPosition(new THREE.Vector3());

    // The scene's composed transform has to reproduce the placement the pocket
    // was cut from, or the ornament sits beside its own recess.
    const expected = placePoint(0, 0, assembly.decorators[0].placement);
    expect(world.x).toBeCloseTo(expected.x, 4);
    expect(world.y).toBeCloseTo(expected.y, 4);
    expect(world.z).toBeCloseTo(12 - 2.5, 4); // the pocket floor, like the name
  }, 30000);

  it('renders an ornament in its own color, or the inlay color when it has none', async () => {
    const { renderer } = await renderScene({
      decorators: [
        { kind: 'icon', id: 'd1', iconName: 'favorite', widthMm: 25, depthMm: 5 },
        { kind: 'text', id: 'd2', text: 'Mia', fontId: 'dancing-script', widthMm: 60, depthMm: 5 },
      ],
      decoratorPlacements: { d1: { offset: { x: -25, y: 90 }, angleDeg: 0 }, d2: { offset: { x: 25, y: 90 }, angleDeg: 0 } },
      decoratorColors: { d1: '#b7c4ac' },
    });

    const colorOf = (index: number) =>
      (decoratorGroup(root(renderer), index).children.filter((c) => c.type === 'Mesh')[0].instance as unknown as { material: { color: THREE.Color } }).material.color.getHexString();
    expect(colorOf(0)).toBe('b7c4ac');
    expect(colorOf(1)).toBe('f7f5f2'); // the name's
  }, 30000);

  it('moves a word ornament whichever of its letters is grabbed', async () => {
    // An ornament is placed, not kerned: it has no gaps for the parent to
    // store, so a letter-gap drag could only spring back.
    const onDecoratorOffsetCommit = vi.fn();
    const { renderer } = await renderScene(
      {
        decorators: [{ kind: 'text', id: 'd1', text: 'Mia', fontId: 'dancing-script', widthMm: 60, depthMm: 5 }],
        decoratorPlacements: { d1: { offset: { x: 0, y: 90 }, angleDeg: 0 } },
      },
      () => {},
      () => {},
      onDecoratorOffsetCommit,
    );

    const group = decoratorGroup(root(renderer));
    const object = group.instance as unknown as THREE.Object3D;
    const lastLetter = () => {
      const meshes = group.children.filter((c) => c.type === 'Mesh');
      return meshes[meshes.length - 1];
    };
    expect(group.children.filter((c) => c.type === 'Mesh')).toHaveLength(3);

    await act(async () => (lastLetter().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(object, 0, 0)));
    await act(async () => (lastLetter().props.onPointerMove as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(object, 12, -6)));
    await act(async () => (lastLetter().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(object, 12, -6)));

    expect(onDecoratorOffsetCommit).toHaveBeenCalledTimes(1);
    const [, offset] = onDecoratorOffsetCommit.mock.calls[0];
    expect(offset.x).toBeCloseTo(12, 1);
    expect(offset.y).toBeCloseTo(84, 1);
  }, 30000);

  it('commits a decorator drag as an absolute offset', async () => {
    const onDecoratorOffsetCommit = vi.fn();
    const { renderer } = await renderScene(
      { decorators: [{ kind: 'icon', id: 'd1', iconName: 'favorite', widthMm: 25, depthMm: 5 }], decoratorPlacements: { d1: { offset: { x: 20, y: 90 }, angleDeg: 0 } } },
      () => {},
      () => {},
      onDecoratorOffsetCommit,
    );

    const group = decoratorGroup(root(renderer));
    const object = group.instance as unknown as THREE.Object3D;
    const icon = () => group.children.filter((c) => c.type === 'Mesh')[0];
    await act(async () => (icon().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(object, 0, 0)));
    await act(async () => (icon().props.onPointerMove as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(object, -15, 5)));
    await act(async () => (icon().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(object, -15, 5)));

    expect(onDecoratorOffsetCommit).toHaveBeenCalledTimes(1);
    const [id, offset] = onDecoratorOffsetCommit.mock.calls[0];
    expect(id).toBe('d1');
    // Added to where it already was, not measured from the origin.
    expect(offset.x).toBeCloseTo(5, 1);
    expect(offset.y).toBeCloseTo(95, 1);
  }, 30000);

  it("turns a turned decorator's drag back into the initial's frame", async () => {
    const onDecoratorOffsetCommit = vi.fn();
    const { renderer } = await renderScene(
      { decorators: [{ kind: 'icon', id: 'd1', iconName: 'favorite', widthMm: 25, depthMm: 5 }], decoratorPlacements: { d1: { offset: { x: 20, y: 90 }, angleDeg: 90 } } },
      () => {},
      () => {},
      onDecoratorOffsetCommit,
    );

    const group = decoratorGroup(root(renderer));
    const object = group.instance as unknown as THREE.Object3D;
    const icon = () => group.children.filter((c) => c.type === 'Mesh')[0];
    // 10mm along the ornament's own x, which at 90° points straight up on the
    // initial. Committed unturned, it would slide sideways instead.
    await act(async () => (icon().props.onPointerDown as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(object, 0, 0)));
    await act(async () => (icon().props.onPointerMove as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(object, 10, 0)));
    await act(async () => (icon().props.onPointerUp as (e: ThreeEvent<PointerEvent>) => void)(pointerEventAt(object, 10, 0)));

    const [, offset] = onDecoratorOffsetCommit.mock.calls[0];
    expect(offset.x).toBeCloseTo(20, 1);
    expect(offset.y).toBeCloseTo(100, 1);
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

describe('clicking a piece of the display rather than dragging it', () => {
  type Handler = (e: ThreeEvent<PointerEvent>) => void;
  const decorated = {
    decorators: [{ kind: 'icon' as const, id: 'd1', iconName: 'favorite', widthMm: 25, depthMm: 5 }],
    decoratorPlacements: { d1: { offset: { x: 20, y: 90 }, angleDeg: 0 } },
  };

  it('points at the initial when the big letter is clicked', async () => {
    const onInitialTap = vi.fn();
    const { renderer } = await renderScene({}, undefined, undefined, undefined, { onInitialTap });
    const initial = directMeshes(root(renderer))[0];
    const object = initial.instance as unknown as THREE.Object3D;

    await act(async () => (initial.props.onPointerDown as Handler)(pointerEventAt(object, 0, 0, { x: 500, y: 400 })));
    await act(async () => (initial.props.onPointerUp as Handler)(pointerEventAt(object, 0, 0, { x: 502, y: 401 })));

    expect(onInitialTap).toHaveBeenCalledTimes(1);
  }, 30000);

  it('does not mistake orbiting the view off the initial for a click on it', async () => {
    const onInitialTap = vi.fn();
    const { renderer } = await renderScene({}, undefined, undefined, undefined, { onInitialTap });
    const initial = directMeshes(root(renderer))[0];
    const object = initial.instance as unknown as THREE.Object3D;

    // The initial never captures the pointer or suspends the controls, so a
    // drag that starts on it is a camera orbit — and must stay one.
    await act(async () => (initial.props.onPointerDown as Handler)(pointerEventAt(object, 0, 0, { x: 500, y: 400 })));
    await act(async () => (initial.props.onPointerUp as Handler)(pointerEventAt(object, 0, 0, { x: 560, y: 420 })));

    expect(onInitialTap).not.toHaveBeenCalled();
  }, 30000);

  it('points at the name when a letter of it is clicked', async () => {
    const onNameTap = vi.fn();
    const { renderer } = await renderScene({}, undefined, undefined, undefined, { onNameTap });
    const group = nameGroup(root(renderer));
    const object = group.instance as unknown as THREE.Object3D;
    const letter = group.children.filter((c) => c.type === 'Mesh')[1];

    await act(async () => (letter.props.onPointerDown as Handler)(pointerEventAt(object, 0, 0, { x: 480, y: 360 })));
    await act(async () => (letter.props.onPointerUp as Handler)(pointerEventAt(object, 0, 0, { x: 481, y: 360 })));

    expect(onNameTap).toHaveBeenCalledTimes(1);
  }, 30000);

  it('points at the one ornament that was clicked, by its own id', async () => {
    const onDecoratorTap = vi.fn();
    const { renderer } = await renderScene(decorated, undefined, undefined, undefined, { onDecoratorTap });
    const group = decoratorGroup(root(renderer));
    const object = group.instance as unknown as THREE.Object3D;
    const icon = group.children.filter((c) => c.type === 'Mesh')[0];

    await act(async () => (icon.props.onPointerDown as Handler)(pointerEventAt(object, 0, 0, { x: 300, y: 200 })));
    await act(async () => (icon.props.onPointerUp as Handler)(pointerEventAt(object, 0, 0, { x: 300, y: 203 })));

    expect(onDecoratorTap).toHaveBeenCalledWith('d1');
  }, 30000);
});
