import { describe, expect, it } from 'vitest';
import { linesToLineGeometries } from './textGeometry';
import { FONT_REGISTRY } from '../fonts/registry';

describe('linesToLineGeometries (single line)', () => {
  it('renders every registered font to one valid geometry per letter, together spanning the target width', async () => {
    for (const font of FONT_REGISTRY) {
      const sample = 'Emma';
      const [{ letters }] = await linesToLineGeometries([sample], font.id, 100, 3);
      expect(letters).toHaveLength(sample.length);

      let combinedMinX = Infinity;
      let combinedMaxX = -Infinity;
      for (const letter of letters) {
        letter.geometry.computeBoundingBox();
        const bb = letter.geometry.boundingBox!;
        expect(bb.max.x - bb.min.x, `${font.id} letter width`).toBeGreaterThan(0);
        expect(bb.max.y - bb.min.y, `${font.id} letter height`).toBeGreaterThan(0);
        combinedMinX = Math.min(combinedMinX, bb.min.x);
        combinedMaxX = Math.max(combinedMaxX, bb.max.x);

        const position = letter.geometry.getAttribute('position');
        expect(position.count, `${font.id} vertex count`).toBeGreaterThan(0);
        for (let i = 0; i < position.array.length; i++) {
          expect(Number.isFinite(position.array[i]), `${font.id} finite vertex`).toBe(true);
        }
      }

      expect(combinedMaxX - combinedMinX, `${font.id} combined width`).toBeCloseTo(100, 3);
    }
  }, 30000);

  it('rejects empty text', async () => {
    await expect(linesToLineGeometries([''], 'dancing-script', 100, 3)).rejects.toThrow();
  });

  it('positions letters left to right, each at its own distinct natural x', async () => {
    const [{ letters }] = await linesToLineGeometries(['Emma'], 'dancing-script', 100, 3);
    for (let i = 1; i < letters.length; i++) {
      expect(letters[i].naturalXMm).toBeGreaterThan(letters[i - 1].naturalXMm);
    }
  });

  it('anchors every letter to the same shared baseline, not each independently', async () => {
    // 'p' descends below the classic baseline; 'H' doesn't. If each letter were
    // independently bottom-anchored (the way a single whole-word extrusion is),
    // both would incorrectly start at the same y, losing the descender.
    const [{ letters }] = await linesToLineGeometries(['Happy'], 'dancing-script', 100, 3);
    const [h, , p] = letters;
    h.geometry.computeBoundingBox();
    p.geometry.computeBoundingBox();
    expect(p.geometry.boundingBox!.min.y).toBeLessThan(h.geometry.boundingBox!.min.y);

    // And the word as a whole is still bottom-anchored at y=0 — the deepest
    // point across every letter, not any one letter's own bottom.
    let overallMinY = Infinity;
    for (const letter of letters) {
      letter.geometry.computeBoundingBox();
      overallMinY = Math.min(overallMinY, letter.geometry.boundingBox!.min.y);
    }
    expect(overallMinY).toBeCloseTo(0, 1);
  });
});

describe('linesToLineGeometries (multi-line)', () => {
  it('gives every line the same letter size, even when line lengths differ wildly', async () => {
    const [short, long] = await linesToLineGeometries(['Hi', 'Happy Birthday'], 'dancing-script', 100, 3);

    short.letters[0].geometry.computeBoundingBox();
    long.letters[0].geometry.computeBoundingBox();
    // Same font, same letter ('H' starts both) -> same size if the scale is
    // shared. If each line were independently stretched to 100mm wide, the
    // 2-letter line's "H" would be dramatically larger than the 14-letter
    // line's "H".
    const shortHeight = short.letters[0].geometry.boundingBox!.max.y - short.letters[0].geometry.boundingBox!.min.y;
    const longHeight = long.letters[0].geometry.boundingBox!.max.y - long.letters[0].geometry.boundingBox!.min.y;
    expect(shortHeight).toBeCloseTo(longHeight, 3);
  });

  it('stacks a second line below the first, both sharing one horizontal centerline', async () => {
    const [line0, line1] = await linesToLineGeometries(['Hi', 'Bye'], 'dancing-script', 100, 3);

    const bb0 = line0.letters.reduce(
      (box, letter) => {
        letter.geometry.computeBoundingBox();
        return { min: Math.min(box.min, letter.geometry.boundingBox!.min.y), max: Math.max(box.max, letter.geometry.boundingBox!.max.y) };
      },
      { min: Infinity, max: -Infinity },
    );
    const bb1 = line1.letters.reduce(
      (box, letter) => {
        letter.geometry.computeBoundingBox();
        return { min: Math.min(box.min, letter.geometry.boundingBox!.min.y), max: Math.max(box.max, letter.geometry.boundingBox!.max.y) };
      },
      { min: Infinity, max: -Infinity },
    );
    // line 0 sits entirely above line 1 (higher y = higher on screen, y-up).
    expect(bb0.min).toBeGreaterThanOrEqual(bb1.max);
  });

  it('gives an empty line zero letters without breaking the other lines', async () => {
    const [empty, real] = await linesToLineGeometries(['', 'Emma'], 'dancing-script', 100, 3);
    expect(empty.letters).toHaveLength(0);
    expect(real.letters).toHaveLength(4);
  });
});
