import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { OutlineHoleTargets } from './OutlineHoleTargets';
import type { OutlineHoleCandidate } from '../geometry/outline';

function hole(key: string, x: number): OutlineHoleCandidate {
  return {
    key,
    lineIndex: 0,
    letterIndex: 1,
    char: 'a',
    holeIndex: 0,
    points: [new THREE.Vector2(x, 0), new THREE.Vector2(x + 4, 0), new THREE.Vector2(x + 4, 4), new THREE.Vector2(x, 4)],
  };
}

const candidates = [hole('hole-a', 0), hole('hole-b', 10)];

/** Only the two things the patches read off an event: where the pointer was on screen, so a tap can be told from a drag. */
function pointerAt(x: number, y: number): ThreeEvent<PointerEvent> {
  return { clientX: x, clientY: y, pointerId: 1, stopPropagation: () => {} } as unknown as ThreeEvent<PointerEvent>;
}

async function render(props: Partial<Parameters<typeof OutlineHoleTargets>[0]> = {}) {
  const onToggle = vi.fn();
  const onHoverChange = vi.fn();
  const renderer = await ReactThreeTestRenderer.create(
    <OutlineHoleTargets
      candidates={candidates}
      positionX={0}
      cardDepthMm={1.5}
      hoveredKey={null}
      highlightedKey={null}
      interactive
      onHoverChange={onHoverChange}
      onToggle={onToggle}
      {...props}
    />,
  );
  const patches = renderer.scene.children[0].children;
  return { renderer, patches, onToggle, onHoverChange };
}

type Handler = (event: ThreeEvent<PointerEvent>) => void;

describe('OutlineHoleTargets', () => {
  it('puts one patch over every hole, in front of the card', async () => {
    const { renderer, patches } = await render();
    expect(patches).toHaveLength(candidates.length);

    const group = renderer.scene.children[0].instance as unknown as THREE.Group;
    // Just in front of the card's face, so a patch over a hole that is
    // currently filled in doesn't fight it for depth.
    expect(group.position.z).toBeGreaterThan(1.5);
    expect(group.position.z).toBeLessThan(1.7);
  });

  it('marks every hole but the one being pointed at, which is shown as it would be instead', async () => {
    const { patches } = await render({ hoveredKey: 'hole-a' });
    const opacity = (index: number) => (patches[index].instance as unknown as { material: { opacity: number } }).material.opacity;

    // The card behind it is rebuilt with that hole toggled, so the patch gets
    // out of the way rather than drawing its own idea of the result.
    expect(opacity(0)).toBe(0);
    expect(opacity(1)).toBeGreaterThan(0);
  });

  it('toggles the hole that was clicked', async () => {
    const { patches, onToggle } = await render();

    await act(async () => (patches[1].props.onPointerDown as Handler)(pointerAt(300, 200)));
    await act(async () => (patches[1].props.onPointerUp as Handler)(pointerAt(301, 200)));

    expect(onToggle).toHaveBeenCalledWith('hole-b');
  });

  it('does not toggle one because the camera was dragged off it', async () => {
    const { patches, onToggle } = await render();

    await act(async () => (patches[0].props.onPointerDown as Handler)(pointerAt(300, 200)));
    await act(async () => (patches[0].props.onPointerUp as Handler)(pointerAt(380, 240)));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('marks the one the panel is pointing at more strongly than the rest', async () => {
    const { patches } = await render({ highlightedKey: 'hole-b' });
    const opacity = (index: number) => (patches[index].instance as unknown as { material: { opacity: number } }).material.opacity;

    expect(opacity(1)).toBeGreaterThan(opacity(0));
  });

  it('takes no clicks when it is only up to say which hole a row means', async () => {
    // The modifier is not held, so a click there still belongs to whatever is
    // behind the patch.
    const { patches, onToggle } = await render({ interactive: false });
    expect(patches[0].props.onPointerDown).toBeUndefined();

    await act(async () => (patches[0].props.onPointerUp as Handler | undefined)?.(pointerAt(300, 200)));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('reports what is under the pointer, and that nothing is once it leaves', async () => {
    const { patches, onHoverChange } = await render();

    await act(async () => (patches[0].props.onPointerOver as Handler)(pointerAt(0, 0)));
    expect(onHoverChange).toHaveBeenLastCalledWith('hole-a');

    await act(async () => (patches[0].props.onPointerOut as Handler)(pointerAt(0, 0)));
    expect(onHoverChange).toHaveBeenLastCalledWith(null);
  });
});
