import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildNameDisplay, effectivePocketDepthMm, initialPrintGeometry, namePrintGeometry, nameOverlapsInitial } from './geometry';
import type { NameDisplayConfig } from './config';

const config: NameDisplayConfig = {
  initial: 'M',
  initialFontId: 'alfa-slab-one',
  initialHeightMm: 120,
  initialDepthMm: 12,
  initialColor: '#d9a9ab',
  name: 'Matilde',
  nameFontId: 'dancing-script',
  nameWidthMm: 150,
  nameDepthMm: 5,
  nameColor: '#f7f5f2',
  nameOffset: { x: 0, y: 45 },
  nameLetterGapsMm: [],
  pocketDepthMm: 2.5,
  pocketClearanceMm: 0.25,
  standMode: 'none',
  railHeightMm: 8,
  railDepthMm: 25,
  railMarginMm: 4,
  trimOffsetMm: 0,
};

function bounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

function vertexCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position').count;
}

describe('buildNameDisplay', () => {
  it('sizes the initial by height and the name by width', async () => {
    const built = await buildNameDisplay(config);
    const initialBb = bounds(built.initialGeometry);
    expect(initialBb.max.y - initialBb.min.y).toBeCloseTo(120, 0);

    const nameBb = new THREE.Box3();
    for (const letter of built.name.lines[0].letters) {
      nameBb.union(bounds(letter.geometry));
    }
    expect(nameBb.max.x - nameBb.min.x).toBeCloseTo(150, 0);
  }, 30000);

  it('keeps the initial exactly initialDepthMm thick despite being built as two slabs', async () => {
    const built = await buildNameDisplay(config);
    const bb = bounds(built.initialGeometry);
    expect(bb.min.z).toBeCloseTo(0, 3);
    expect(bb.max.z).toBeCloseTo(12, 3);
  }, 30000);

  it('seats the name in the pocket so it protrudes by depth minus pocket', async () => {
    const built = await buildNameDisplay(config);
    expect(built.nameZMm).toBeCloseTo(12 - 2.5, 5);
    expect(built.protrusionMm).toBeCloseTo(5 - 2.5, 5);
    // The name's far face ends up proud of the initial's front face.
    expect(built.nameZMm + config.nameDepthMm).toBeGreaterThan(12);
  }, 30000);

  it('actually removes material for the pocket', async () => {
    const built = await buildNameDisplay(config);
    const withoutPocket = await buildNameDisplay({ ...config, pocketDepthMm: 0 });
    // A pocketed front slab is a more complex polygon than a plain one, so it
    // triangulates to more vertices than the un-pocketed single extrusion.
    expect(vertexCount(built.initialGeometry)).toBeGreaterThan(vertexCount(withoutPocket.initialGeometry));
  }, 30000);

  it('cuts nothing when the name is dragged clear of the initial', async () => {
    const clear = { ...config, nameOffset: { x: 5000, y: 0 } };
    const built = await buildNameDisplay(clear);
    expect(nameOverlapsInitial(built, clear)).toBe(false);

    // Same silhouette as a pocket-less build: the overhang had nothing to cut.
    const withoutPocket = await buildNameDisplay({ ...clear, pocketDepthMm: 0 });
    expect(bounds(built.initialGeometry).min.x).toBeCloseTo(bounds(withoutPocket.initialGeometry).min.x, 3);
    expect(bounds(built.initialGeometry).max.x).toBeCloseTo(bounds(withoutPocket.initialGeometry).max.x, 3);
  }, 30000);

  it('reports that a centered name does overlap the initial', async () => {
    const built = await buildNameDisplay(config);
    expect(nameOverlapsInitial(built, config)).toBe(true);
  }, 30000);

  it('keeps the counter of an initial that has one', async () => {
    // "O" is a ring: the pocket must not fill its hole in, and the solid must
    // not swallow it either.
    const ring = { ...config, initial: 'O' };
    const built = await buildNameDisplay(ring);
    const holeless = await buildNameDisplay({ ...ring, initial: 'I' });
    expect(vertexCount(built.initialGeometry)).toBeGreaterThan(vertexCount(holeless.initialGeometry));
  }, 30000);
});

describe('effectivePocketDepthMm', () => {
  it('never lets the pocket cut through the initial', async () => {
    // 20mm requested into a 12mm-thick initial would sever it.
    expect(effectivePocketDepthMm({ ...config, pocketDepthMm: 20, nameDepthMm: 30 })).toBeLessThanOrEqual(12 * 0.6);
  });

  it('never exceeds the name that has to sit in it', () => {
    expect(effectivePocketDepthMm({ ...config, pocketDepthMm: 6, nameDepthMm: 4 })).toBe(4);
  });

  it('keeps a sane request as-is', () => {
    expect(effectivePocketDepthMm(config)).toBe(2.5);
  });

  it('is never negative', () => {
    expect(effectivePocketDepthMm({ ...config, pocketDepthMm: -5 })).toBe(0);
  });
});

describe('print geometry', () => {
  it('exports the initial with its pocket', async () => {
    const built = await buildNameDisplay(config);
    expect(vertexCount(initialPrintGeometry(built, config))).toBe(vertexCount(built.initialGeometry));
  }, 30000);

  it('adds a base rail under both pieces in rail mode', async () => {
    const railed = { ...config, standMode: 'rail' as const };
    const built = await buildNameDisplay(railed);

    const initialBb = bounds(initialPrintGeometry(built, railed));
    expect(initialBb.min.y).toBeLessThan(0); // rail hangs below the letter's own baseline-anchored bottom
    expect(initialBb.max.z - initialBb.min.z).toBeCloseTo(25, 1); // the deeper rail sets the footprint

    const nameBb = bounds(namePrintGeometry(built, railed));
    expect(nameBb.min.y).toBeLessThan(0);
  }, 30000);

  it('exports the name in its own frame, not shifted by where the pocket went', async () => {
    const built = await buildNameDisplay(config);
    const shifted = await buildNameDisplay({ ...config, nameOffset: { x: 40, y: 10 } });
    const a = bounds(namePrintGeometry(built, config));
    const b = bounds(namePrintGeometry(shifted, { ...config, nameOffset: { x: 40, y: 10 } }));
    expect(b.min.x).toBeCloseTo(a.min.x, 3);
    expect(b.min.y).toBeCloseTo(a.min.y, 3);
  }, 30000);

  it('moves the pocket when the name is dragged', async () => {
    const built = await buildNameDisplay(config);
    const shifted = await buildNameDisplay({ ...config, nameOffset: { x: 25, y: 45 } });
    // Same two pieces, differently pocketed initial.
    expect(vertexCount(shifted.initialGeometry)).not.toBe(vertexCount(built.initialGeometry));
  }, 30000);

  it('flattens the name onto a standing edge in trim mode', async () => {
    const trimmed = { ...config, standMode: 'trim' as const };
    const built = await buildNameDisplay(trimmed);
    const plain = await buildNameDisplay(config);
    // "Matilde" has no descenders, so the trim should barely move the bottom —
    // but it must not sit below the untrimmed one either.
    expect(bounds(namePrintGeometry(built, trimmed)).min.y).toBeGreaterThanOrEqual(bounds(namePrintGeometry(plain, config)).min.y - 0.01);
  }, 30000);
});
