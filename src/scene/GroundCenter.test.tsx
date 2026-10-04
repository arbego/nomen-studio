import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GroundCenter } from './GroundCenter';

/** A 10x20x5 box sitting well away from the origin, so centering has something real to correct. */
function OffsetBox() {
  const geometry = new THREE.BoxGeometry(10, 20, 5);
  geometry.translate(60, 40, 25);
  return <mesh geometry={geometry} />;
}

/** A slab hung under the box, like a base rail: new geometry, reaching lower than anything before it. */
function Rail() {
  const geometry = new THREE.BoxGeometry(20, 8, 25);
  geometry.translate(60, 26, 25);
  return <mesh geometry={geometry} />;
}

/**
 * Stands in for a drag in progress.
 *
 * Every drag in the studio turns the orbit controls off for its duration, which
 * is how GroundCenter knows one is happening — so a test of that behaviour has
 * to put a controls object in the scene's state the same way OrbitControls'
 * `makeDefault` does.
 */
function HeldPointer({ held }: { held: boolean }) {
  const set = useThree((state) => state.set);
  useEffect(() => {
    set({ controls: { enabled: !held } as unknown as THREE.EventDispatcher });
  }, [set, held]);
  return null;
}

/** A piece whose geometry is rebuilt — not merely moved — every time it is handed a new position, as a stick is while dragged. */
function Dragged({ held, y }: { held: boolean; y: number }) {
  const geometry = new THREE.BoxGeometry(10, 20, 5);
  geometry.translate(0, y, 0);
  return (
    <>
      <HeldPointer held={held} />
      <GroundCenter>
        <mesh geometry={geometry} />
      </GroundCenter>
    </>
  );
}

function Scene({ show, rail = false, onFirstCenter }: { show: boolean; rail?: boolean; onFirstCenter?: () => void }) {
  return (
    <GroundCenter onFirstCenter={onFirstCenter}>
      {show ? <OffsetBox /> : null}
      {rail ? <Rail /> : null}
    </GroundCenter>
  );
}

async function outerOf(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  return renderer.scene.children[0].instance as unknown as THREE.Object3D;
}

/** The world-space box of whatever is rendered, which is what the viewer actually sees. */
function worldBox(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  const root = renderer.scene.children[0].instance as unknown as THREE.Object3D;
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root, true);
}

describe('GroundCenter', () => {
  it('centers content horizontally and rests its bottom on the ground', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene show />);
    await renderer.advanceFrames(2, 16);

    const box = worldBox(renderer);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 4);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 4);
    expect(box.min.y).toBeCloseTo(0, 4);
  });

  it('centers content that only arrives after the first measurement', async () => {
    // The regression. Every product builds its geometry asynchronously, so the
    // first measurable frame has nothing in it; drei's Center measured that
    // empty group once, derived +Infinity from it, and never re-measured,
    // leaving the design invisible until the studio was reopened.
    const renderer = await ReactThreeTestRenderer.create(<Scene show={false} />);
    await renderer.advanceFrames(3, 16);

    const outer = await outerOf(renderer);
    expect(Number.isFinite(outer.position.y)).toBe(true);

    await renderer.update(<Scene show />);
    await renderer.advanceFrames(2, 16);

    const box = worldBox(renderer);
    expect(box.min.y).toBeCloseTo(0, 4);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 4);
  });

  it('never moves content to a non-finite position while it is empty', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene show={false} />);
    await renderer.advanceFrames(5, 16);

    const outer = await outerOf(renderer);
    expect(outer.position.toArray().every(Number.isFinite)).toBe(true);
    expect(outer.position.toArray()).toEqual([0, 0, 0]);
  });

  it('reports the first centering once, so the camera is framed to real content', async () => {
    const onFirstCenter = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(<Scene show={false} onFirstCenter={onFirstCenter} />);
    await renderer.advanceFrames(3, 16);
    expect(onFirstCenter).not.toHaveBeenCalled(); // nothing to frame yet

    await renderer.update(<Scene show onFirstCenter={onFirstCenter} />);
    await renderer.advanceFrames(4, 16);
    expect(onFirstCenter).toHaveBeenCalledTimes(1);
  });

  it('puts the design back on the ground when it grows downward', async () => {
    // Adding a base rail hangs a slab under the piece. Grounded only once, the
    // letter stayed where it was and the rail hung below the floor — which is
    // the whole point of the rail, missed.
    const renderer = await ReactThreeTestRenderer.create(<Scene show />);
    await renderer.advanceFrames(2, 16);
    expect(worldBox(renderer).min.y).toBeCloseTo(0, 4);

    await renderer.update(<Scene show rail />);
    await renderer.advanceFrames(2, 16);

    const box = worldBox(renderer);
    expect(box.min.y).toBeCloseTo(0, 4);
    // And the rail is what is now touching it: the design sits 8mm higher than
    // it did, rather than the floor cutting through it.
    expect(box.max.y - box.min.y).toBeCloseTo(28, 4);
  });

  it('lets the design back down when what it was standing on is taken away', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene show rail />);
    await renderer.advanceFrames(2, 16);
    const standing = worldBox(renderer);
    expect(standing.min.y).toBeCloseTo(0, 4);

    await renderer.update(<Scene show />);
    await renderer.advanceFrames(2, 16);

    // Without the rail the letter is the lowest thing again, so it comes back
    // down to the floor rather than hovering where the rail used to hold it.
    const box = worldBox(renderer);
    expect(box.min.y).toBeCloseTo(0, 4);
    expect(box.max.y - box.min.y).toBeCloseTo(20, 4);
  });

  it('leaves a design alone while it is only being moved about', async () => {
    // Letters and ornaments are dragged by transforming them, not by rebuilding
    // them. Re-grounding on that would fight the drag: the piece would rise as
    // the thing being dragged went down, and the cursor would never catch it.
    const geometry = new THREE.BoxGeometry(10, 20, 5);
    const Moving = ({ y }: { y: number }) => <mesh geometry={geometry} position={[0, y, 0]} />;

    const renderer = await ReactThreeTestRenderer.create(
      <GroundCenter>
        <Moving y={0} />
      </GroundCenter>,
    );
    await renderer.advanceFrames(2, 16);
    const settled = (await outerOf(renderer)).position.clone();

    await renderer.update(
      <GroundCenter>
        <Moving y={-30} />
      </GroundCenter>,
    );
    await renderer.advanceFrames(3, 16);
    expect((await outerOf(renderer)).position.toArray()).toEqual(settled.toArray());
  });

  it('sits out a drag that rebuilds geometry as it goes, then grounds once it is let go', async () => {
    // A cake topper's stick changes length as it is dragged, to keep its tip
    // level, so it hands over new geometry every frame of the drag. Grounding
    // that would chase the pointer: the piece rises, the cursor's place in the
    // design drops, the stick stretches further, and away it goes.
    const renderer = await ReactThreeTestRenderer.create(<Dragged held={false} y={0} />);
    await renderer.advanceFrames(2, 16);
    const settled = (await outerOf(renderer)).position.clone();

    // Held: new geometry arrives, reaching further down each time, and nothing
    // may move.
    for (const y of [-5, -10, -15, -20]) {
      await renderer.update(<Dragged held y={y} />);
      await renderer.advanceFrames(2, 16);
      expect((await outerOf(renderer)).position.toArray()).toEqual(settled.toArray());
    }

    // Let go, and it settles onto the floor at the extent it ended up with.
    await renderer.update(<Dragged held={false} y={-20} />);
    await renderer.advanceFrames(2, 16);
    expect(worldBox(renderer).min.y).toBeCloseTo(0, 4);
  });

  it('settles in one pass and then leaves the content alone', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene show />);
    await renderer.advanceFrames(2, 16);
    const settled = (await outerOf(renderer)).position.clone();

    await renderer.advanceFrames(10, 16);
    expect((await outerOf(renderer)).position.toArray()).toEqual(settled.toArray());
  });
});
