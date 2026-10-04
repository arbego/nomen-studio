import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { assembleNameDisplay, assembledPrintGeometry, blockRegion, buildNameDisplayBlocks, initialPrintGeometry, namePrintGeometry, placedNameGeometry } from './geometry';
import { growRegion, regionToShapes } from '../../geometry/clipper';
import { combinedStlBinary } from './export';
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
  nameAngleDeg: 0,
  pocketDepthMm: 2.5,
  pocketClearanceMm: 0.25,
  standMode: 'none',
  standColor: '#2b2b2b',
  railHeightMm: 8,
  railDepthMm: 25,
  railMarginMm: 4,
  trimOffsetMm: 0,
};

async function build(overrides: Partial<NameDisplayConfig> = {}) {
  const merged = { ...config, ...overrides };
  const blocks = await buildNameDisplayBlocks(merged);
  return { blocks, assembly: assembleNameDisplay(blocks, merged), config: merged };
}

function bounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

function vertexCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position').count;
}

/** The XY footprint of the void cut into the initial — the grown name silhouette, where it was placed. */
function pocketBounds(blocks: Awaited<ReturnType<typeof build>>['blocks'], assembly: Awaited<ReturnType<typeof build>>['assembly'], cfg: NameDisplayConfig): THREE.Box2 {
  const region = growRegion(blockRegion(blocks.name, [cfg.nameLetterGapsMm], assembly.namePlacement), cfg.pocketClearanceMm);
  const box = new THREE.Box2();
  for (const shape of regionToShapes(region)) {
    for (const point of shape.getPoints()) box.expandByPoint(point);
  }
  return box;
}

describe('one-file STL export', () => {
  it.each([0, 30, -25])('seats the name in the pocket that was cut for it, at %i°', async (nameAngleDeg) => {
    // The whole point of exporting one file: the fit between the two pieces is
    // carried in the file. If the exported name does not land inside the recess,
    // the design is wrong in a way no slicer can recover.
    const { blocks, assembly, config: used } = await build({ nameAngleDeg, nameOffset: { x: 18, y: 40 } });
    const name = bounds(placedNameGeometry(blocks, assembly, used));
    const pocket = pocketBounds(blocks, assembly, used);

    // Inside the recess, and within the clearance of filling it — the pocket is
    // the name grown by exactly that much.
    const slack = used.pocketClearanceMm + 0.01;
    expect(name.min.x).toBeGreaterThan(pocket.min.x);
    expect(name.max.x).toBeLessThan(pocket.max.x);
    expect(name.min.x - pocket.min.x).toBeLessThan(slack);
    expect(pocket.max.x - name.max.x).toBeLessThan(slack);
    expect(name.min.y - pocket.min.y).toBeLessThan(slack);
    expect(pocket.max.y - name.max.y).toBeLessThan(slack);
  }, 30000);

  it('rests the name on the pocket floor, standing proud by what it protrudes', async () => {
    const { blocks, assembly, config: used } = await build();
    const name = bounds(placedNameGeometry(blocks, assembly, used));
    expect(name.min.z).toBeCloseTo(assembly.nameZMm, 4);
    expect(name.max.z).toBeCloseTo(used.initialDepthMm + assembly.protrusionMm, 4);
  }, 30000);

  it('carries both pieces, whole, into the one file', async () => {
    const { blocks, assembly, config: used } = await build();
    const combined = assembledPrintGeometry(blocks, assembly, used);
    expect(vertexCount(combined)).toBe(vertexCount(initialPrintGeometry(blocks, assembly, used)) + vertexCount(namePrintGeometry(blocks, used)));
  }, 30000);

  it('leaves the preview geometry untouched, so exporting never moves what is on screen', async () => {
    const { blocks, assembly, config: used } = await build();
    const before = bounds(assembly.initialGeometry).clone();
    const nameBefore = bounds(namePrintGeometry(blocks, used)).clone();

    assembledPrintGeometry(blocks, assembly, used);

    expect(bounds(assembly.initialGeometry).equals(before)).toBe(true);
    expect(bounds(namePrintGeometry(blocks, used)).equals(nameBefore)).toBe(true);
  }, 30000);

  it.each(['', '  '])('never reaches the exporter with a nameless design (%j)', async (name) => {
    // Why assembledPrintGeometry needs no empty-name guard: a name with no
    // lettering fails during the build, long before there is an assembly to
    // export, and the button stays disabled on a design that never built.
    await expect(build({ name })).rejects.toThrow();
  }, 30000);

  it('writes a valid binary STL whose triangle count matches the solid', async () => {
    const { blocks, assembly, config: used } = await build();
    const dv = combinedStlBinary(blocks, assembly, used);

    // binary STL: 80-byte header, uint32 triangle count, then 50 bytes/triangle
    const triangleCount = dv.getUint32(80, true);
    expect(triangleCount).toBeGreaterThan(0);
    expect(dv.byteLength).toBe(84 + triangleCount * 50);
    expect(triangleCount).toBe(vertexCount(assembledPrintGeometry(blocks, assembly, used)) / 3);
  }, 30000);

  it('includes the base rail when the design stands on one', async () => {
    const { blocks, assembly, config: used } = await build({ standMode: 'rail' });
    const railed = bounds(assembledPrintGeometry(blocks, assembly, used));
    const plain = await build();
    const plainBounds = bounds(assembledPrintGeometry(plain.blocks, plain.assembly, plain.config));

    expect(railed.min.y).toBeLessThan(plainBounds.min.y);
    expect(railed.max.z - railed.min.z).toBeGreaterThan(plainBounds.max.z - plainBounds.min.z);
  }, 30000);
});
