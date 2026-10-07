import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rectRegion, subtractRegions } from '../../geometry/clipper';
import { pointIsInsideSolid } from '../../test-setup/pointInSolid';
import { buildHollowInitial, initializeHollowGeometry } from './hollowGeometry';
import { DEFAULT_NAME_DISPLAY_CONFIG } from './store';
import { assembleNameDisplay, buildNameDisplayBlocks, effectivePocketDepthMm } from './geometry';

const config = { ...DEFAULT_NAME_DISPLAY_CONFIG, hollowEnabled: true, initialDepthMm: 20, name: '', decorators: [], pocketDepthMm: 0 };
const face = rectRegion(0, 0, 40, 60);

beforeAll(initializeHollowGeometry);

function volume(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position');
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let total = 0;
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i);
    b.fromBufferAttribute(positions, i + 1);
    c.fromBufferAttribute(positions, i + 2);
    total += a.dot(b.cross(c)) / 6;
  }
  return total;
}

function unmatchedEdges(geometry: THREE.BufferGeometry): string[] {
  const positions = geometry.getAttribute('position');
  const edges = new Map<string, number>();
  const key = (i: number) => [positions.getX(i), positions.getY(i), positions.getZ(i)].map((v) => Math.round(v * 10000)).join(',');
  for (let i = 0; i < positions.count; i += 3) {
    for (let j = 0; j < 3; j++) {
      const a = key(i + j);
      const b = key(i + (j + 1) % 3);
      const edge = [a, b].sort().join('|');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  return [...edges].filter(([, count]) => count !== 2).map(([edge, count]) => `${edge} (${count})`);
}

function expectClosed(geometry: THREE.BufferGeometry) {
  const edges = unmatchedEdges(geometry);
  expect(edges.length, edges.slice(0, 8).join('\n')).toBe(0);
}

describe('hollow bowl and inset lid', () => {
  it('leaves a real cavity, a back floor, and walls of the requested thickness', () => {
    const { bowlGeometry: bowl, lidGeometry: lid } = buildHollowInitial(face, [], config, 0);
    expect(pointIsInsideSolid(bowl, 20, 30, 1)).toBe(true);
    expect(pointIsInsideSolid(bowl, 20, 30, 10)).toBe(false);
    expect(pointIsInsideSolid(bowl, 1, 30, 10)).toBe(true);
    expect(pointIsInsideSolid(bowl, 2.1, 30, 10)).toBe(false);
    expect(pointIsInsideSolid(bowl, 20, 30, 18)).toBe(false);
    expect(pointIsInsideSolid(lid, 20, 30, 18)).toBe(true);
    expect(lid.boundingBox!.min.z).toBe(17);
    expect(lid.boundingBox!.max.z).toBe(20);
  });

  it('supports the lid on a sloped ledge below the recess, with a clearance gap', () => {
    const { bowlGeometry: bowl, lidGeometry: lid } = buildHollowInitial(face, [], config, 0);
    expect(pointIsInsideSolid(bowl, 2.6, 30, 15.7)).toBe(false);
    expect(pointIsInsideSolid(bowl, 2.6, 30, 16.2)).toBe(true);
    expect(pointIsInsideSolid(bowl, 2.6, 30, 18)).toBe(false);
    expect(pointIsInsideSolid(lid, 2.6, 30, 18)).toBe(true);
    expect(pointIsInsideSolid(bowl, 2.1, 30, 18)).toBe(false);
    expect(pointIsInsideSolid(lid, 2.1, 30, 18)).toBe(false);
  });

  it('uses 45° sloped faces beneath the lid support', () => {
    const { bowlGeometry: bowl } = buildHollowInitial(face, [], config, 0);
    const positions = bowl.getAttribute('position');
    const normals = bowl.getAttribute('normal');
    let slopes = 0;
    for (let i = 0; i < positions.count; i += 3) {
      const nz = normals.getZ(i);
      const z = positions.getZ(i);
      if (z >= 15.39 && z <= 16.61 && nz < -0.01 && nz > -0.99) {
        expect(Math.abs(nz)).toBeCloseTo(Math.SQRT1_2, 3);
        slopes++;
      }
    }
    expect(slopes).toBeGreaterThan(0);
  });

  it.each([0.8, 2, 5])('keeps configurable %s mm walls, a fitted lid and closed meshes', (wallThicknessMm) => {
    const { bowlGeometry: bowl, lidGeometry: lid } = buildHollowInitial(face, [], { ...config, wallThicknessMm }, 0);
    expect(pointIsInsideSolid(bowl, wallThicknessMm / 2, 30, 10)).toBe(true);
    expect(pointIsInsideSolid(bowl, wallThicknessMm + 0.1, 30, 10)).toBe(false);
    expect(pointIsInsideSolid(bowl, 20, 30, wallThicknessMm - 0.1)).toBe(true);
    expect(pointIsInsideSolid(bowl, 20, 30, wallThicknessMm + 0.1)).toBe(false);
    expect(lid.boundingBox!.min.x).toBeCloseTo(wallThicknessMm + config.lidClearanceMm, 4);
    expectClosed(bowl);
    expectClosed(lid);
  });

  it('produces closed, outward-facing meshes and saves solid volume', () => {
    const { bowlGeometry: bowl, lidGeometry: lid } = buildHollowInitial(face, [], config, 0);
    expect(unmatchedEdges(bowl).length, unmatchedEdges(bowl).slice(0, 8).join('\n')).toBe(0);
    expect(unmatchedEdges(lid).length, unmatchedEdges(lid).slice(0, 8).join('\n')).toBe(0);
    expect(volume(bowl)).toBeCloseTo(11928.192, 1);
    expect(volume(lid)).toBeCloseTo(5910.75, 1);
    expect(volume(bowl) + volume(lid)).toBeLessThan(40 * 60 * 20 / 2);
  });

  it('cuts lettering pockets across the lid and rim without opening the lid bottom', () => {
    const inlay = rectRegion(-2, 25, 30, 35);
    const { bowlGeometry: bowl, lidGeometry: lid } = buildHollowInitial(face, inlay, { ...config, pocketClearanceMm: 0 }, 1);
    expect(pointIsInsideSolid(lid, 20, 30, 19.5)).toBe(false);
    expect(pointIsInsideSolid(lid, 20, 30, 18.5)).toBe(true);
    expect(pointIsInsideSolid(bowl, 1, 30, 19.5)).toBe(false);
    expect(pointIsInsideSolid(bowl, 1, 30, 18.5)).toBe(true);
    expectClosed(bowl);
    expectClosed(lid);
  });

  it('keeps a letter counter open through both pieces', () => {
    const ring = subtractRegions(face, rectRegion(12, 15, 28, 45));
    const { bowlGeometry: bowl, lidGeometry: lid } = buildHollowInitial(ring, [], config, 0);
    expect(pointIsInsideSolid(bowl, 20, 30, 1)).toBe(false);
    expect(pointIsInsideSolid(lid, 20, 30, 18)).toBe(false);
    expect(pointIsInsideSolid(bowl, 11, 30, 10)).toBe(true);
    expect(pointIsInsideSolid(bowl, 8, 30, 10)).toBe(false);
    expectClosed(bowl);
    expectClosed(lid);
  });

  it('caps pockets against the lid thickness instead of the whole bowl', () => {
    expect(effectivePocketDepthMm({ ...config, name: 'Mia', pocketDepthMm: 5, nameDepthMm: 6, lidThicknessMm: 2 })).toBe(1.2);
  });

  it('rejects a hollow initial with no usable opening', () => {
    expect(() => buildHollowInitial(rectRegion(0, 0, 3, 60), [], config, 0)).toThrow('no room');
    expect(() => buildHollowInitial(rectRegion(0, 0, 6, 60), [], config, 0)).toThrow('no room');
  });

  it.each(['K', 'O', 'B', 'i'])('follows the actual %s glyph, including counters and disconnected regions', async (initial) => {
    const design = { ...config, initial, initialFontId: 'calistoga' };
    const blocks = await buildNameDisplayBlocks(design);
    const assembly = assembleNameDisplay(blocks, design);
    expect(assembly.lidGeometry).not.toBeNull();
    expect(volume(assembly.initialGeometry)).toBeGreaterThan(0);
    expect(volume(assembly.lidGeometry!)).toBeGreaterThan(0);
    expectClosed(assembly.initialGeometry);
    expectClosed(assembly.lidGeometry!);
  });

  it('keeps named and decorated hollow meshes closed while their inlays are tilted across the lid and rim', async () => {
    const design = { ...DEFAULT_NAME_DISPLAY_CONFIG, hollowEnabled: true, initialDepthMm: 30 };
    const blocks = await buildNameDisplayBlocks(design);
    const assembly = assembleNameDisplay(blocks, design);
    expectClosed(assembly.initialGeometry);
    expectClosed(assembly.lidGeometry!);
    expect(assembly.heldByInitial).toBe(true);
    expect(assembly.decorators[0].heldByInitial).toBe(true);
  });

  it.each(['K', 'O', 'B', 'i'])('keeps pocket cuts watertight on a named %s', async (initial) => {
    const design = { ...DEFAULT_NAME_DISPLAY_CONFIG, initial, hollowEnabled: true, initialDepthMm: 30 };
    const blocks = await buildNameDisplayBlocks(design);
    const assembly = assembleNameDisplay(blocks, design);
    expectClosed(assembly.initialGeometry);
    expectClosed(assembly.lidGeometry!);
  });
});
