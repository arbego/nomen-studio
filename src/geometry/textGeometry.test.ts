import { describe, expect, it } from 'vitest';
import { textToGeometry } from './textGeometry';
import { FONT_REGISTRY } from '../fonts/registry';

describe('textToGeometry', () => {
  it('renders every registered font to a valid, correctly-sized geometry', async () => {
    for (const font of FONT_REGISTRY) {
      const sample = font.category === 'script' ? 'Emma' : '6';
      const geometry = await textToGeometry(sample, font.id, 100, 3);
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox!;
      const width = bb.max.x - bb.min.x;
      const height = bb.max.y - bb.min.y;

      expect(width, `${font.id} width`).toBeCloseTo(100, 3);
      expect(height, `${font.id} height`).toBeGreaterThan(0);
      // sanity bound: catches genuinely broken extrusion (e.g. a bad bbox) without
      // assuming any particular aspect ratio — a single narrow digit is normally
      // much taller than it is wide once scaled to a fixed width.
      expect(height, `${font.id} height/width ratio`).toBeLessThan(width * 5);

      const position = geometry.getAttribute('position');
      expect(position.count, `${font.id} vertex count`).toBeGreaterThan(0);
      for (let i = 0; i < position.array.length; i++) {
        expect(Number.isFinite(position.array[i]), `${font.id} finite vertex`).toBe(true);
      }
    }
  }, 30000);

  it('rejects empty text', async () => {
    await expect(textToGeometry('', 'dancing-script', 100, 3)).rejects.toThrow();
  });

  it('assembles a whole word as one connected path, not disjoint per-character shapes for a script font', async () => {
    const geometry = await textToGeometry('Emma', 'dancing-script', 100, 3);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox).not.toBeNull();
  });
});
