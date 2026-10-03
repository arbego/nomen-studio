import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GroundCenter } from './GroundCenter';

/** A 10x20x5 box sitting well away from the origin, so centering has something real to correct. */
function OffsetBox() {
  const geometry = new THREE.BoxGeometry(10, 20, 5);
  geometry.translate(60, 40, 25);
  return <mesh geometry={geometry} />;
}

function Scene({ show, onFirstCenter }: { show: boolean; onFirstCenter?: () => void }) {
  return <GroundCenter onFirstCenter={onFirstCenter}>{show ? <OffsetBox /> : null}</GroundCenter>;
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

  it('settles in one pass and then leaves the content alone', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene show />);
    await renderer.advanceFrames(2, 16);
    const settled = (await outerOf(renderer)).position.clone();

    await renderer.advanceFrames(10, 16);
    expect((await outerOf(renderer)).position.toArray()).toEqual(settled.toArray());
  });
});
