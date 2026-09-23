import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildOutlineShapes, buildOutlineGeometry } from './outline';
import { shapesBoundingBox } from './svgPathToShapes';
import { combinedLetterBounds } from './letterLayout';
import { wordToLetterGeometries } from './textGeometry';
import type { LetterGeometry, Pick } from './types';

function square(minX: number, maxX: number, minY: number, maxY: number): THREE.Vector2[] {
  return [new THREE.Vector2(minX, minY), new THREE.Vector2(maxX, minY), new THREE.Vector2(maxX, maxY), new THREE.Vector2(minX, maxY)];
}

function fakeLetter(naturalXMm: number, contours: THREE.Vector2[][]): LetterGeometry {
  return { char: '?', geometry: new THREE.BoxGeometry(1, 1, 1), naturalXMm, outlineContours: contours };
}

function fakePick(letters: LetterGeometry[]): Pick {
  return { id: 'word', label: 'test', letters };
}

describe('buildOutlineShapes', () => {
  it('is empty when growMm is zero or negative', () => {
    const pick = fakePick([fakeLetter(0, [square(0, 10, 0, 10)])]);
    expect(buildOutlineShapes(pick, [], 0)).toEqual([]);
    expect(buildOutlineShapes(pick, [], -1)).toEqual([]);
  });

  it('is empty when there are no letters', () => {
    expect(buildOutlineShapes(fakePick([]), [], 3)).toEqual([]);
  });

  it('grows a single square outward on every side, filled solid (no hole)', () => {
    const pick = fakePick([fakeLetter(0, [square(0, 10, 0, 10)])]);
    const shapes = buildOutlineShapes(pick, [0], 2);

    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(0);

    const outerBox = shapesBoundingBox(shapes, 64);
    // Round-joined offset of a square grows the bounding box by ~growMm on every side.
    expect(outerBox.min.x).toBeLessThan(-1.5);
    expect(outerBox.min.x).toBeGreaterThan(-2.5);
    expect(outerBox.max.x).toBeGreaterThan(11.5);
    expect(outerBox.max.x).toBeLessThan(12.5);
    expect(outerBox.min.y).toBeLessThan(-1.5);
    expect(outerBox.max.y).toBeGreaterThan(11.5);
  });

  it('produces one separate filled fragment per shape when they stay far apart after growing', () => {
    // A 2mm gap between the squares; growing each by 0.5mm closes only 1mm of it.
    const pick = fakePick([fakeLetter(0, [square(0, 10, 0, 10)]), fakeLetter(0, [square(12, 22, 0, 10)])]);
    const shapes = buildOutlineShapes(pick, [0], 0.5);

    expect(shapes).toHaveLength(2);
    for (const shape of shapes) {
      expect(shape.holes).toHaveLength(0);
    }
  });

  it('merges two fragments into one connected shape once they grow into each other — the "i dot merges with the stem" case', () => {
    const pick = fakePick([fakeLetter(0, [square(0, 10, 0, 10)]), fakeLetter(0, [square(12, 22, 0, 10)])]);
    const shapes = buildOutlineShapes(pick, [0], 2); // 2mm each side closes the 2mm gap

    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(0);
  });

  it('reflects the current (gap-cascaded) letter positions, not the natural ones', () => {
    const pick = fakePick([fakeLetter(0, [square(0, 10, 0, 10)]), fakeLetter(0, [square(12, 22, 0, 10)])]);
    // Same shapes as the "far apart" case above (2mm gap, unmerged at
    // growMm=0.5) — but a -1.5mm gap override closes most of that distance
    // (down to 0.5mm) before the outline is even built, so the same growMm
    // now closes the rest and merges them.
    const shapes = buildOutlineShapes(pick, [-1.5], 0.5);

    expect(shapes).toHaveLength(1);
  });

  it('handles a glyph with multiple disconnected contours (e.g. an "i") as separate pieces to grow', () => {
    const stem = square(0, 4, 0, 20);
    const dot = square(1, 3, 23, 25); // a 3mm gap above the stem
    const pick = fakePick([fakeLetter(0, [stem, dot])]);

    expect(buildOutlineShapes(pick, [], 0.5)).toHaveLength(2); // still separate
    expect(buildOutlineShapes(pick, [], 3)).toHaveLength(1); // grown enough to merge
  });
});

describe('buildOutlineGeometry', () => {
  it('returns null when there is nothing to build', () => {
    const pick = fakePick([fakeLetter(0, [square(0, 10, 0, 10)])]);
    expect(buildOutlineGeometry(pick, [0], 0, 3)).toBeNull();
  });

  it('extrudes to the requested depth and reports matching bounds', () => {
    const pick = fakePick([fakeLetter(0, [square(0, 10, 0, 10)])]);
    const outline = buildOutlineGeometry(pick, [0], 2, 5);

    expect(outline).not.toBeNull();
    expect(outline!.bounds.max.z - outline!.bounds.min.z).toBeCloseTo(5, 5);
    outline!.mainGeometry.computeBoundingBox();
    expect(outline!.mainGeometry.boundingBox!.equals(outline!.bounds)).toBe(true);
  });
});

describe('buildOutlineGeometry (integration, real font)', () => {
  it('returns null when disabled (growMm = 0)', async () => {
    const letters = await wordToLetterGeometries('Emma', 'dancing-script', 100, 3);
    expect(buildOutlineGeometry(fakePick(letters), [0, 0, 0], 0, 3)).toBeNull();
  }, 30000);

  it('encompasses the word once grown', async () => {
    const letters = await wordToLetterGeometries('Emma', 'dancing-script', 100, 3);
    const pick = fakePick(letters);
    const wordBounds = combinedLetterBounds(letters, [0, 0, 0]);

    const outline = buildOutlineGeometry(pick, [0, 0, 0], 3, 3);
    expect(outline).not.toBeNull();
    expect(outline!.bounds.min.x).toBeLessThan(wordBounds.min.x);
    expect(outline!.bounds.max.x).toBeGreaterThan(wordBounds.max.x);
    expect(outline!.bounds.min.y).toBeLessThan(wordBounds.min.y);
    expect(outline!.bounds.max.y).toBeGreaterThan(wordBounds.max.y);
  }, 30000);
});
