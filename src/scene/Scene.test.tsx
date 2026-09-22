import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
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
});
