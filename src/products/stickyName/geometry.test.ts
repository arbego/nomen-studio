import { beforeAll, describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { initializeSolidGeometry, withSolidGeometry } from '../../geometry/solidGeometry';
import { rectRegion, subtractRegions } from '../../geometry/clipper';
import { pointIsInsideSolid } from '../../test-setup/pointInSolid';
import { DEFAULT_MAGNET, DEFAULT_STICKY_NAME_CONFIG as DEFAULT } from './config';
import { bubbleTheme } from './themes/bubble';
import { buildStickyNameGeometry, disposeStickyNameGeometry } from './geometry';
import { cutMagnets } from './magnets';
import { stickyName3mf } from './export';

beforeAll(initializeSolidGeometry);

describe('inflated bubble solids', () => {
  it('has a flat back, a continuously domed face, and deterministic closed geometry', () => {
    const region = rectRegion(0, 0, 30, 40);
    const a = bubbleTheme.build(region, DEFAULT);
    const b = bubbleTheme.build(region, DEFAULT);
    expect(a.getAttribute('position').array).toEqual(b.getAttribute('position').array);
    expect(a.boundingBox!.min.z).toBeCloseTo(0, 4);
    expect(a.boundingBox!.max.z).toBeCloseTo(DEFAULT.depthMm, 1);
    expect(pointIsInsideSolid(a, 15, 20, 10)).toBe(true);
    expect(pointIsInsideSolid(a, 2, 20, 10)).toBe(false);
    expect(pointIsInsideSolid(a, 2, 20, 1)).toBe(true);
    withSolidGeometry((_e, _track, fromGeometry) => {
      const solid = fromGeometry(a);
      expect(solid.status()).toBe('NoError');
      expect(solid.volume()).toBeGreaterThan(1000);
    });
    a.dispose(); b.dispose();
  }, 20000);

  it('keeps counters open and rounds corners without changing topology', () => {
    const ring = subtractRegions(rectRegion(0, 0, 35, 40), rectRegion(11, 10, 24, 30));
    const geometry = bubbleTheme.build(ring, DEFAULT);
    expect(pointIsInsideSolid(geometry, 17, 20, 1)).toBe(false);
    expect(pointIsInsideSolid(geometry, 5, 20, 1)).toBe(true);
    expect(pointIsInsideSolid(geometry, 0.1, 0.1, 1)).toBe(false);
    withSolidGeometry((_e, _t, fromGeometry) => expect(fromGeometry(geometry).status()).toBe('NoError'));
    geometry.dispose();
  }, 20000);

  it.each(['coiny', 'lilita-one', 'calistoga'])('builds real %s glyphs with independent repeated letters, spaces and printable backs', async (fontId) => {
    const config = { ...DEFAULT, fontId, name: 'B OOi', magnets: [] };
    const result = await buildStickyNameGeometry(config);
    expect(result.letters.map((l) => l.index)).toEqual([0, 2, 3, 4]);
    expect(result.canExport).toBe(true);
    expect(result.letters[1].geometry).not.toBe(result.letters[2].geometry);
    expect(result.letters[1].geometry.getAttribute('position').array).toEqual(result.letters[2].geometry.getAttribute('position').array);
    for (const letter of result.letters) {
      expect(letter.geometry.boundingBox!.min.z).toBeCloseTo(0, 4);
      withSolidGeometry((_e, _t, fromGeometry) => expect(fromGeometry(letter.geometry).status()).toBe('NoError'));
    }
    expect(result.warnings.join(' ')).toContain('separate pieces');
    disposeStickyNameGeometry(result);
  }, 30000);
});

describe('sealed in-print magnet cavities', () => {
  it('keeps every exported edge paired after layout translation and serialization', async () => {
    const config = { ...DEFAULT, magnets: [[DEFAULT_MAGNET, DEFAULT_MAGNET], [], [], []] };
    const result = await buildStickyNameGeometry(config);
    // Also exercise large layout coordinates, which used to collapse nearby
    // vertices when the translated positions were stored as float32.
    result.letters[2].x += 1200;
    const xml = new TextDecoder().decode(stickyName3mf(result, config));
    const meshes = [...xml.matchAll(/<mesh>([\s\S]*?)<\/mesh>/g)];
    expect(meshes).toHaveLength(4);
    for (const [index, match] of meshes.entries()) {
      const edges = new Map<string, number>();
      for (const face of match[1].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)) {
        const ids = face.slice(1).map(Number);
        for (let i = 0; i < 3; i++) {
          const a = ids[i], b = ids[(i + 1) % 3];
          const key = a < b ? `${a},${b}` : `${b},${a}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      expect([...edges.values()].filter((count) => count !== 2), `Letter ${index + 1}`).toEqual([]);
    }
    disposeStickyNameGeometry(result);
  }, 30000);

  it('cuts the requested diameter, thickness and height while preserving the floor and roof', () => {
    const body = bubbleTheme.build(rectRegion(0, 0, 30, 40), DEFAULT);
    const magnet = { ...DEFAULT_MAGNET, position: { x: 15, y: 20 } };
    const cut = cutMagnets(body, [magnet], 0.2);
    expect(cut.magnets[0].valid).toBe(true);
    expect(cut.magnets[0].pauseHeightMm).toBeCloseTo(3.2);
    expect(pointIsInsideSolid(cut.geometry, 15, 20, 0.5)).toBe(true);
    expect(pointIsInsideSolid(cut.geometry, 15, 20, 2)).toBe(false);
    expect(pointIsInsideSolid(cut.geometry, 18, 20, 2)).toBe(false);
    expect(pointIsInsideSolid(cut.geometry, 18.3, 20, 2)).toBe(true);
    expect(pointIsInsideSolid(cut.geometry, 15, 20, 3.4)).toBe(true);
    withSolidGeometry((_e, _t, fromGeometry) => expect(fromGeometry(cut.geometry).status()).toBe('NoError'));
    cut.geometry.dispose(); body.dispose();
  }, 20000);

  it('rejects a surface breakthrough, a counter, overlapping cavities and an impossible size', () => {
    const body = bubbleTheme.build(subtractRegions(rectRegion(0, 0, 35, 40), rectRegion(12, 12, 23, 28)), DEFAULT);
    for (const magnets of [
      [{ ...DEFAULT_MAGNET, position: { x: 0, y: 20 } }],
      [{ ...DEFAULT_MAGNET, position: { x: 17, y: 20 } }],
      [{ ...DEFAULT_MAGNET, heightMm: 11, position: { x: 6, y: 20 } }],
      [{ ...DEFAULT_MAGNET, diameterMm: 30 }],
      [{ ...DEFAULT_MAGNET, position: { x: 6, y: 20 } }, { ...DEFAULT_MAGNET, position: { x: 6, y: 20 } }],
    ]) {
      const cut = cutMagnets(body, magnets, 0.2);
      expect(cut.magnets.at(-1)!.valid).toBe(false);
      if (cut.geometry !== body) cut.geometry.dispose();
    }
    body.dispose();
  }, 30000);

  it('auto-places per-letter magnets deterministically and exports actual cavities with roof heights', async () => {
    const config = { ...DEFAULT, name: 'OO', magnets: [[DEFAULT_MAGNET, DEFAULT_MAGNET], [{ ...DEFAULT_MAGNET, diameterMm: 4, thicknessMm: 1 }]] };
    const a = await buildStickyNameGeometry(config);
    const b = await buildStickyNameGeometry(config);
    expect(a.letters.map((l) => l.magnets)).toEqual(b.letters.map((l) => l.magnets));
    expect(a.canExport, a.warnings.join('\n')).toBe(true);
    expect(a.letters[0].magnets).toHaveLength(2);
    expect(a.letters[1].magnets).toHaveLength(1);
    const data = new TextDecoder().decode(stickyName3mf(a, config));
    expect(data).toContain('unit="millimeter"');
    expect(data).toContain('pause before covering 3.20 mm');
    expect(data).toContain('pause before covering 2.20 mm');
    expect(data).toContain('<build><item objectid="2"/><item objectid="3"/></build>');
    expect(data).not.toContain('<components>');
    expect(data).not.toContain('key="extruder" value="2"');
    const bounds = new Box3();
    for (const l of a.letters) bounds.union(l.geometry.boundingBox!.clone().translate(new Vector3(l.x, 0, 0)));
    expect(bounds.min.x + bounds.max.x).toBeCloseTo(0, 2);
    disposeStickyNameGeometry(a); disposeStickyNameGeometry(b);
  }, 60000);

  it('blocks export for invalid cavities and reports empty or unsupported text', async () => {
    const config = { ...DEFAULT, name: 'O', magnets: [[{ ...DEFAULT_MAGNET, position: { x: -10, y: -10 } }]] };
    const result = await buildStickyNameGeometry(config);
    expect(result.canExport).toBe(false);
    expect(() => stickyName3mf(result, config)).toThrow('Resolve');
    await expect(buildStickyNameGeometry({ ...DEFAULT, name: '  ' })).rejects.toThrow('Enter a name');
    await expect(buildStickyNameGeometry({ ...DEFAULT, name: '🚀' })).rejects.toThrow('does not contain');
    disposeStickyNameGeometry(result);
  }, 20000);
});
