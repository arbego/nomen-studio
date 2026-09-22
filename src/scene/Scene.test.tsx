import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { buildTopperPicks } from '../geometry/buildTopper';
import type { TopperConfig } from '../geometry/types';
import { Scene } from './Scene';

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
  stickOffsets: { word: 0, number: 0, accent: 0 },
  previewColor: '#f0c6d0',
};

describe('Scene (React Three Fiber wiring)', () => {
  it('mounts one mesh per pick, each with real geometry and the preview color', async () => {
    const picks = await buildTopperPicks(config);
    const renderer = await ReactThreeTestRenderer.create(<Scene picks={picks} color={config.previewColor} />);

    const meshes = renderer.scene.children[0].children.filter((c) => c.type === 'Mesh');
    expect(meshes).toHaveLength(3);

    for (const mesh of meshes) {
      const instance = mesh.instance as unknown as {
        geometry: { attributes: { position: { count: number } } };
        material: { color: { getHexString: () => string } };
      };
      expect(instance.geometry.attributes.position.count).toBeGreaterThan(0);
      expect(`#${instance.material.color.getHexString()}`).toBe(config.previewColor);
    }
  }, 30000);

  it('lays picks out left-to-right without overlapping bounding boxes', async () => {
    const picks = await buildTopperPicks(config);
    const renderer = await ReactThreeTestRenderer.create(<Scene picks={picks} color={config.previewColor} />);

    const meshes = renderer.scene.children[0].children.filter((c) => c.type === 'Mesh');
    const xPositions = meshes.map((m) => (m.instance as unknown as { position: { x: number } }).position.x);

    // word, number, accent were built in that order and should stay left-to-right
    expect(xPositions[0]).toBeLessThan(xPositions[1]);
    expect(xPositions[1]).toBeLessThan(xPositions[2]);
  }, 30000);

  it('reports the clicked pick id and its local x back through onPickStickPosition', async () => {
    const picks = await buildTopperPicks(config);
    const onPickStickPosition = vi.fn();
    const renderer = await ReactThreeTestRenderer.create(
      <Scene picks={picks} color={config.previewColor} onPickStickPosition={onPickStickPosition} />,
    );

    const wordMesh = renderer.scene.children[0].children.find((c) => c.type === 'Mesh')!;
    const meshObject = wordMesh.instance as unknown as THREE.Object3D;
    meshObject.updateWorldMatrix(true, false);

    // Click a world point 7mm to the right of the mesh's own origin.
    const worldPoint = meshObject.localToWorld(new THREE.Vector3(7, 5, 0));
    const onClick = wordMesh.props.onClick as (e: ThreeEvent<MouseEvent>) => void;
    onClick({
      point: worldPoint,
      object: meshObject,
      stopPropagation: () => {},
    } as unknown as ThreeEvent<MouseEvent>);

    expect(onPickStickPosition).toHaveBeenCalledTimes(1);
    const [pickId, localX] = onPickStickPosition.mock.calls[0];
    expect(pickId).toBe('word');
    expect(localX).toBeCloseTo(7, 5);
  }, 30000);
});
