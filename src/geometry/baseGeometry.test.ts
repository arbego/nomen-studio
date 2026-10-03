import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { baseRailGeometry, trimBlockBelow, trimCutY } from './baseGeometry';
import { buildTextBlock } from './textGeometry';
import { combinedBlockBounds } from './letterLayout';
import type { TextBlock } from './types';

function bounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

// A block whose descenders reach 6mm below its baseline.
const BASELINE_Y = 6;
const BLOCK_BOUNDS = new THREE.Box3(new THREE.Vector3(-50, 0, 0), new THREE.Vector3(50, 80, 5));

describe('baseRailGeometry', () => {
  it('spans the block plus the margin on each side', () => {
    const rail = baseRailGeometry({ bounds: BLOCK_BOUNDS, baselineYMm: BASELINE_Y, heightMm: 8, depthMm: 20, marginMm: 6, blockDepthMm: 5 })!;
    const bb = bounds(rail);
    expect(bb.min.x).toBeCloseTo(-56, 3);
    expect(bb.max.x).toBeCloseTo(56, 3);
  });

  it('tops out above the baseline, so every letter resting on it is bonded', () => {
    // Anchoring to the block's lowest ink instead would put the rail under the
    // descenders only, leaving letters like "P" and "e" floating above it.
    const rail = baseRailGeometry({ bounds: BLOCK_BOUNDS, baselineYMm: BASELINE_Y, heightMm: 8, depthMm: 20, marginMm: 6, blockDepthMm: 5 })!;
    const bb = bounds(rail);
    expect(bb.max.y).toBeGreaterThan(BASELINE_Y);
    expect(bb.min.y).toBeLessThan(BLOCK_BOUNDS.min.y);
  });

  it('grows past its nominal height when descenders reach below it', () => {
    // 2mm below a baseline at y=6 would stop at y=4, but the block's ink goes
    // down to y=0 — the rail has to swallow it rather than let it poke out.
    const rail = baseRailGeometry({ bounds: BLOCK_BOUNDS, baselineYMm: BASELINE_Y, heightMm: 2, depthMm: 20, marginMm: 6, blockDepthMm: 5 })!;
    expect(bounds(rail).min.y).toBeLessThan(BLOCK_BOUNDS.min.y);
  });

  it('is centered on the block depth, so it overhangs equally front and back', () => {
    const rail = baseRailGeometry({ bounds: BLOCK_BOUNDS, baselineYMm: BASELINE_Y, heightMm: 8, depthMm: 20, marginMm: 0, blockDepthMm: 5 })!;
    const bb = bounds(rail);
    expect((bb.min.z + bb.max.z) / 2).toBeCloseTo(2.5, 3);
    expect(bb.max.z - bb.min.z).toBeCloseTo(20, 3);
  });

  it('returns null rather than a degenerate solid when there is nothing to stand on', () => {
    expect(baseRailGeometry({ bounds: new THREE.Box3(), baselineYMm: BASELINE_Y, heightMm: 8, depthMm: 20, marginMm: 6, blockDepthMm: 5 })).toBeNull();
    expect(baseRailGeometry({ bounds: BLOCK_BOUNDS, baselineYMm: BASELINE_Y, heightMm: 0, depthMm: 20, marginMm: 6, blockDepthMm: 5 })).toBeNull();
  });
});

describe('trimCutY', () => {
  it('cuts at the baseline by default, and the offset moves it', async () => {
    const block = await buildBlock('Happy');
    expect(trimCutY(block, 0)).toBeCloseTo(block.baselineYMm, 5);
    expect(trimCutY(block, 3)).toBeCloseTo(block.baselineYMm + 3, 5);
  }, 30000);
});

async function buildBlock(text: string, fontId = 'dancing-script'): Promise<TextBlock> {
  return buildTextBlock({ id: 'word', label: text, lines: [text], fontId, fit: { mode: 'width', mm: 100 }, extrudeDepthMm: 3 });
}

describe('trimBlockBelow', () => {
  it('leaves nothing below the cut', async () => {
    // "Happy" has two descenders in a script face, so there is real material below the baseline to remove.
    const block = await buildBlock('Happy');
    const cut = trimCutY(block, 0);
    expect(combinedBlockBounds(block, [[]], [{ x: 0, y: 0 }]).min.y).toBeLessThan(cut - 0.5);

    const trimmed = trimBlockBelow(block, cut, 3);
    expect(combinedBlockBounds(trimmed, [[]], [{ x: 0, y: 0 }]).min.y).toBeGreaterThanOrEqual(cut - 0.01);
  }, 30000);

  it('keeps the letters, their characters and their natural anchors', async () => {
    const block = await buildBlock('Happy');
    const trimmed = trimBlockBelow(block, trimCutY(block, 0), 3);
    expect(trimmed.lines[0].letters.map((l) => l.char)).toEqual(['H', 'a', 'p', 'p', 'y']);
    expect(trimmed.lines[0].letters.map((l) => l.naturalXMm)).toEqual(block.lines[0].letters.map((l) => l.naturalXMm));
  }, 30000);

  it('preserves the extrude depth', async () => {
    const block = await buildBlock('Happy');
    const trimmed = trimBlockBelow(block, trimCutY(block, 0), 3);
    const bb = combinedBlockBounds(trimmed, [[]], [{ x: 0, y: 0 }]);
    expect(bb.max.z - bb.min.z).toBeCloseTo(3, 2);
  }, 30000);

  it('removes nothing when the cut is below everything', async () => {
    const block = await buildBlock('Emma');
    const before = combinedBlockBounds(block, [[]], [{ x: 0, y: 0 }]);
    const trimmed = trimBlockBelow(block, before.min.y - 10, 3);
    const after = combinedBlockBounds(trimmed, [[]], [{ x: 0, y: 0 }]);
    expect(after.min.y).toBeCloseTo(before.min.y, 1);
    expect(after.max.y).toBeCloseTo(before.max.y, 1);
    expect(after.min.x).toBeCloseTo(before.min.x, 1);
  }, 30000);

  it('empties a letter that falls entirely below the cut, without dropping its slot', async () => {
    const block = await buildBlock('Emma');
    const top = combinedBlockBounds(block, [[]], [{ x: 0, y: 0 }]).max.y;
    const trimmed = trimBlockBelow(block, top + 1, 3);
    expect(trimmed.lines[0].letters).toHaveLength(4); // letter-gap overrides stay index-aligned
    for (const letter of trimmed.lines[0].letters) {
      expect(letter.geometry.getAttribute('position')?.count ?? 0).toBe(0);
    }
  }, 30000);
});
