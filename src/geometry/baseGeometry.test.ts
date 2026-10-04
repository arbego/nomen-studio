import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { baseRailGeometry, trimBlockBelow, trimCutY } from './baseGeometry';
import { rectRegion } from './clipper';
import { pointIsInsideSolid } from '../test-setup/pointInSolid';
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
/** Stands in for the block's silhouette: one bar down the middle of it, reaching the same lowest ink. */
const BLOCK_REGION = rectRegion(-10, 0, 10, 80);

const RAIL = {
  bounds: BLOCK_BOUNDS,
  baselineYMm: BASELINE_Y,
  heightMm: 8,
  depthMm: 20,
  marginMm: 6,
  blockDepthMm: 5,
  socketRegion: BLOCK_REGION,
  socketDepthMm: 5,
  socketClearanceMm: 0.25,
};

const solidAt = pointIsInsideSolid;

describe('baseRailGeometry', () => {
  it('spans the block plus the margin on each side', () => {
    const bb = bounds(baseRailGeometry(RAIL)!);
    expect(bb.min.x).toBeCloseTo(-56, 3);
    expect(bb.max.x).toBeCloseTo(56, 3);
  });

  it('tops out above the baseline by the socket depth, which is how far the piece sinks in', () => {
    const bb = bounds(baseRailGeometry(RAIL)!);
    expect(bb.max.y).toBeCloseTo(BASELINE_Y + RAIL.socketDepthMm, 3);
    expect(bb.min.y).toBeLessThan(BLOCK_BOUNDS.min.y);
  });

  it('cuts a socket shaped like the block, so the piece drops in instead of running through', () => {
    const rail = baseRailGeometry(RAIL)!;
    const midZ = RAIL.blockDepthMm / 2;
    // Inside the letter's footprint, above the lowest ink: hollow.
    expect(solidAt(rail, 0, BASELINE_Y + 2, midZ)).toBe(false);
    // Beside it, at the same height: solid.
    expect(solidAt(rail, 30, BASELINE_Y + 2, midZ)).toBe(true);
  });

  it('leaves a floor under the socket, so the piece lands in a cup rather than over a hole', () => {
    const rail = baseRailGeometry(RAIL)!;
    const bb = bounds(rail);
    // Directly under the block's lowest ink, near the rail's underside.
    expect(solidAt(rail, 0, bb.min.y + 0.5, RAIL.blockDepthMm / 2)).toBe(true);
    expect(bb.min.y).toBeLessThan(BLOCK_BOUNDS.min.y - RAIL.socketClearanceMm);
  });

  it('keeps its front and back walls, so the socket locates the piece in depth too', () => {
    const rail = baseRailGeometry(RAIL)!;
    // In the middle of the letter's footprint, but in front of where the block
    // itself sits — the socket is a pocket, not a slot sawn right through.
    expect(solidAt(rail, 0, BASELINE_Y + 2, bounds(rail).min.z + 0.5)).toBe(true);
    expect(solidAt(rail, 0, BASELINE_Y + 2, bounds(rail).max.z - 0.5)).toBe(true);
  });

  it('cuts the socket wider than the block by the clearance, so the parts actually go together', () => {
    const tight = baseRailGeometry({ ...RAIL, socketClearanceMm: 0 })!;
    const loose = baseRailGeometry({ ...RAIL, socketClearanceMm: 1 })!;
    const y = BASELINE_Y + 2;
    const z = RAIL.blockDepthMm / 2;
    // 0.5mm outside the block's own edge: solid with no clearance, cut away with 1mm of it.
    expect(solidAt(tight, 10.5, y, z)).toBe(true);
    expect(solidAt(loose, 10.5, y, z)).toBe(false);
  });

  it('grows past its nominal height when descenders reach below it', () => {
    // 2mm below a baseline at y=6 would stop at y=4, but the block's ink goes
    // down to y=0 — the rail has to hold it with material still underneath.
    const rail = baseRailGeometry({ ...RAIL, heightMm: 2 })!;
    expect(bounds(rail).min.y).toBeLessThan(BLOCK_BOUNDS.min.y - RAIL.socketClearanceMm);
  });

  it('is centered on the block depth, so it overhangs equally front and back', () => {
    const bb = bounds(baseRailGeometry({ ...RAIL, marginMm: 0 })!);
    expect((bb.min.z + bb.max.z) / 2).toBeCloseTo(2.5, 3);
    expect(bb.max.z - bb.min.z).toBeCloseTo(20, 3);
  });

  it('returns null rather than a degenerate solid when there is nothing to stand on', () => {
    expect(baseRailGeometry({ ...RAIL, bounds: new THREE.Box3() })).toBeNull();
    expect(baseRailGeometry({ ...RAIL, heightMm: 0 })).toBeNull();
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
