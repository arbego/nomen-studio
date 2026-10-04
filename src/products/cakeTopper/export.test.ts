import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { buildCakeTopperBlocks, mergedBlockGeometry } from './geometry';
import type { CakeTopperConfig } from './config';
import { combined3mfBinary, printObjects } from './export';
import { slugifyFilename } from '../../export/filename';

const config: CakeTopperConfig = {
  lines: ['Emma'],
  wordFontId: 'dancing-script',
  sizeMm: 100,
  extrudeDepthMm: 3,
  stickLengthMm: 70,
  stickWidthMm: 4,
  stickEmbedMm: 15,
  stickOffsets: { word: [{ x: 0, y: 0 }] },
  letterGapsMm: [[0, 0, 0]],
  lineOffsets: [{ x: 0, y: 0 }],
  previewColor: '#f0c6d0',
  outlineEnabled: false,
  outlineGrowMm: 3,
  outlineColor: '#f7f5f2',
  outlineDepthMm: 1.5,
  closedOutlineHoles: [],
};

function triangleCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position').count / 3;
}

async function block(overrides: Partial<CakeTopperConfig> = {}) {
  const merged = { ...config, ...overrides };
  const blocks = await buildCakeTopperBlocks(merged);
  return { block: blocks[0], config: merged };
}

describe('what the cake topper puts in the file', () => {
  it('exports the lettering as one piece, its sticks merged into it', async () => {
    // The sticks print in the same filament and are embedded in the letters
    // rather than sitting beside them, so they are not a part of their own.
    const { block: word, config: used } = await block();
    const objects = printObjects(word, used);

    expect(objects.map((o) => o.name)).toEqual(['Lettering']);
    expect(objects[0].color).toBe('#f0c6d0');
    expect(triangleCount(objects[0].geometry)).toBe(triangleCount(mergedBlockGeometry(word, used)));
  }, 30000);

  it('adds the backing card as a second piece, in its own color', async () => {
    const { block: word, config: used } = await block({ outlineEnabled: true });
    const objects = printObjects(word, used);

    expect(objects.map((o) => o.name)).toEqual(['Lettering', 'Backing card']);
    expect(objects[1].color).toBe('#f7f5f2');
    // The card is grown out from under the letters, so it is wider than they are.
    objects.forEach((o) => o.geometry.computeBoundingBox());
    expect(objects[1].geometry.boundingBox!.min.x).toBeLessThan(objects[0].geometry.boundingBox!.min.x);
  }, 30000);

  it('leaves the card out entirely when it is switched off, rather than exporting an empty part', async () => {
    const { block: word, config: used } = await block();
    expect(printObjects(word, used)).toHaveLength(1);
  }, 30000);

  it('exports the letter-gap overrides, not the natural layout', async () => {
    const { block: word, config: used } = await block();
    const tightened = { ...used, letterGapsMm: [[-5, 0, 0]] };

    const natural = combined3mfBinary(word, used, 'Emma');
    const moved = combined3mfBinary(word, tightened, 'Emma');
    // Same letters and stick, just moved: the same mesh, written differently.
    expect(moved.length).not.toBe(0);
    expect(moved).not.toEqual(natural);
    expect(triangleCount(printObjects(word, tightened)[0].geometry)).toBe(triangleCount(printObjects(word, used)[0].geometry));
  }, 30000);

  it('writes a package carrying both part names', async () => {
    // Entries are stored rather than deflated, so the text is in the bytes
    // verbatim — enough to confirm end to end that the pieces reached the file.
    const { block: word, config: used } = await block({ outlineEnabled: true });
    const text = new TextDecoder().decode(combined3mfBinary(word, used, 'Emma'));

    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('3D/3dmodel.model');
    expect(text).toContain('value="Lettering"');
    expect(text).toContain('value="Backing card"');
    expect(text).toContain('value="Emma"');
  }, 30000);
});

describe('slugifyFilename', () => {
  it('lowercases, strips accents/punctuation, and hyphenates', () => {
    expect(slugifyFilename('Emma-6')).toBe('emma-6');
    expect(slugifyFilename('  Théo!! ')).toBe('th-o');
  });

  it('falls back to the caller-supplied name for an empty/unusable one', () => {
    // The cake topper passes 'topper' (see ExportButtons); each product names its own fallback.
    expect(slugifyFilename('', 'topper')).toBe('topper');
    expect(slugifyFilename('!!!', 'topper')).toBe('topper');
    expect(slugifyFilename('')).toBe('design');
  });
});
