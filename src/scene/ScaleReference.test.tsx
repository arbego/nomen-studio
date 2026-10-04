import { describe, expect, it, vi } from 'vitest';
import { useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { COIN_DIAMETER_MM, COIN_THICKNESS_MM, ScaleReference } from './ScaleReference';

/** A design-shaped stand-in: 80mm wide, 120mm tall, 12mm deep, resting on the ground like a real part. */
function Design({ widthMm = 80 }: { widthMm?: number }) {
  const geometry = new THREE.BoxGeometry(widthMm, 120, 12);
  geometry.translate(0, 60, 6);
  return <mesh geometry={geometry} />;
}

/** Mirrors StudioCanvas: the coin sits beside the content group, never inside it. */
function Scene({ children, onFirstPlaced }: { children?: ReactNode; onFirstPlaced?: () => void }) {
  const contentRef = useRef<THREE.Group>(null);
  return (
    <group>
      <group ref={contentRef}>{children}</group>
      <ScaleReference contentRef={contentRef} onFirstPlaced={onFirstPlaced} />
    </group>
  );
}

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function coinGroup(renderer: Renderer): THREE.Object3D {
  const root = renderer.scene.children[0].instance as unknown as THREE.Object3D;
  return root.children[1];
}

/** The world box of the coin only. */
function coinBox(renderer: Renderer): THREE.Box3 {
  const coin = coinGroup(renderer);
  coin.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(coin, true);
}

async function render(node: ReactNode) {
  const renderer = await ReactThreeTestRenderer.create(node);
  await renderer.advanceFrames(2, 16);
  return renderer;
}

describe('ScaleReference', () => {
  it('is a 2 euro coin at true scale — 25.75mm across, 2.2mm thick', async () => {
    const renderer = await render(
      <Scene>
        <Design />
      </Scene>,
    );

    const box = coinBox(renderer);
    // The only thing this component is for: if these drift, the comparison lies.
    expect(box.max.x - box.min.x).toBeCloseTo(COIN_DIAMETER_MM, 1);
    expect(box.max.z - box.min.z).toBeCloseTo(COIN_DIAMETER_MM, 1);
    expect(COIN_DIAMETER_MM).toBe(25.75);
    expect(COIN_THICKNESS_MM).toBe(2.2);
  });

  it('lies flat on the ground, not standing on edge or floating', async () => {
    const renderer = await render(
      <Scene>
        <Design />
      </Scene>,
    );

    const box = coinBox(renderer);
    expect(box.min.y).toBeCloseTo(0, 1);
    // Thickness is the short axis, so the coin is lying down. The silver core is
    // a touch thicker than the ring to keep their faces off one plane.
    expect(box.max.y - box.min.y).toBeLessThan(COIN_THICKNESS_MM + 0.1);
  });

  it('stands clear of the design, beside it and centered on its depth', async () => {
    const renderer = await render(
      <Scene>
        <Design widthMm={80} />
      </Scene>,
    );

    const box = coinBox(renderer);
    expect(box.min.x).toBeGreaterThan(40); // past the design's right edge at x=40
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(6, 1); // the design's mid-depth
  });

  it('follows the design when it is resized, instead of ending up inside it', async () => {
    const renderer = await render(
      <Scene>
        <Design widthMm={80} />
      </Scene>,
    );
    const near = coinBox(renderer).min.x;

    await renderer.update(
      <Scene>
        <Design widthMm={300} />
      </Scene>,
    );
    await renderer.advanceFrames(2, 16);

    const far = coinBox(renderer).min.x;
    expect(far).toBeGreaterThan(150); // clear of the wider design's edge
    expect(far - near).toBeCloseTo(110, 1); // exactly how much wider it got, each side
  });

  it('stays hidden while the design is still being built', async () => {
    // Every product builds its geometry asynchronously, so the first frames have
    // nothing to measure. A coin placed from an empty box would sit on top of
    // the design when it finally appeared.
    const renderer = await render(<Scene />);
    expect(coinGroup(renderer).visible).toBe(false);

    await renderer.update(
      <Scene>
        <Design />
      </Scene>,
    );
    await renderer.advanceFrames(2, 16);
    expect(coinGroup(renderer).visible).toBe(true);
  });

  it('reports its first placement once, so the view can be framed to include it', async () => {
    const onFirstPlaced = vi.fn();
    const renderer = await render(<Scene onFirstPlaced={onFirstPlaced} />);
    expect(onFirstPlaced).not.toHaveBeenCalled(); // nothing to stand beside yet

    await renderer.update(
      <Scene onFirstPlaced={onFirstPlaced}>
        <Design />
      </Scene>,
    );
    await renderer.advanceFrames(4, 16);
    expect(onFirstPlaced).toHaveBeenCalledTimes(1);
  });
});
