import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { assembleNameDisplay, blockRegion, buildNameDisplayBlocks, initialPrintGeometry, namePrintGeometry, placedNameGeometry } from './geometry';
import { growRegion, regionToShapes } from '../../geometry/clipper';
import { combined3mfBinary, printObjects } from './export';
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
  decorators: [],
  decoratorOffsets: {},
  pocketDepthMm: 2.5,
  pocketClearanceMm: 0.25,
  standMode: 'none',
  standColor: '#2b2b2b',
  railHeightMm: 8,
  railDepthMm: 25,
  railMarginMm: 4,
  trimOffsetMm: 0,
};

type Built = { blocks: Awaited<ReturnType<typeof buildNameDisplayBlocks>>; assembly: ReturnType<typeof assembleNameDisplay>; config: NameDisplayConfig };

async function build(overrides: Partial<NameDisplayConfig> = {}): Promise<Built> {
  const merged = { ...config, ...overrides };
  const blocks = await buildNameDisplayBlocks(merged);
  return { blocks, assembly: assembleNameDisplay(blocks, merged), config: merged };
}

function bounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position').count / 3;
}

/** The XY footprint of the void cut into the initial — the grown name silhouette, where it was placed. */
function pocketBounds(built: Built): THREE.Box2 {
  const region = growRegion(blockRegion(built.blocks.name, [built.config.nameLetterGapsMm], built.assembly.namePlacement), built.config.pocketClearanceMm);
  const box = new THREE.Box2();
  for (const shape of regionToShapes(region)) {
    for (const point of shape.getPoints()) box.expandByPoint(point);
  }
  return box;
}

describe('placing the name for export', () => {
  it.each([0, 30, -25])('seats the name in the pocket that was cut for it, at %i°', async (nameAngleDeg) => {
    // The whole point of exporting one file: the fit between the two pieces is
    // carried in the file. If the exported name does not land inside the recess,
    // the design is wrong in a way no slicer can recover.
    const built = await build({ nameAngleDeg, nameOffset: { x: 18, y: 40 } });
    const name = bounds(placedNameGeometry(built.blocks, built.assembly, built.config));
    const pocket = pocketBounds(built);

    // Inside the recess, and within the clearance of filling it — the pocket is
    // the name grown by exactly that much.
    const slack = built.config.pocketClearanceMm + 0.01;
    expect(name.min.x).toBeGreaterThan(pocket.min.x);
    expect(name.max.x).toBeLessThan(pocket.max.x);
    expect(name.min.x - pocket.min.x).toBeLessThan(slack);
    expect(pocket.max.x - name.max.x).toBeLessThan(slack);
    expect(name.min.y - pocket.min.y).toBeLessThan(slack);
    expect(pocket.max.y - name.max.y).toBeLessThan(slack);
  }, 30000);

  it('rests the name on the pocket floor, standing proud by what it protrudes', async () => {
    const built = await build();
    const name = bounds(placedNameGeometry(built.blocks, built.assembly, built.config));
    expect(name.min.z).toBeCloseTo(built.assembly.nameZMm, 4);
    expect(name.max.z).toBeCloseTo(built.config.initialDepthMm + built.assembly.protrusionMm, 4);
  }, 30000);

  it('leaves the preview geometry untouched, so exporting never moves what is on screen', async () => {
    const built = await build();
    const before = bounds(built.assembly.initialGeometry).clone();
    const nameBefore = bounds(namePrintGeometry(built.blocks, built.config)).clone();

    printObjects(built.blocks, built.assembly, built.config);

    expect(bounds(built.assembly.initialGeometry).equals(before)).toBe(true);
    expect(bounds(namePrintGeometry(built.blocks, built.config)).equals(nameBefore)).toBe(true);
  }, 30000);

  it.each(['', '  '])('never reaches the exporter with a nameless design (%j)', async (name) => {
    // Why the exporter needs no empty-name guard: a name with no lettering fails
    // during the build, long before there is an assembly to export, and the
    // button stays disabled on a design that never built.
    await expect(build({ name })).rejects.toThrow();
  }, 30000);
});

describe('what the name display puts in the file', () => {
  it('keeps the initial and the name as two separate, named, colored pieces', async () => {
    // The reason this is a 3mf and not an stl: an stl is one anonymous bag of
    // triangles, and splitting it in a slicer splits by connected shell, which
    // on this design is a dozen-odd slabs and loose letters.
    const built = await build();
    const objects = printObjects(built.blocks, built.assembly, built.config);

    expect(objects.map((o) => o.name)).toEqual(['M (initial)', 'Matilde (name)']);
    expect(objects.map((o) => o.color)).toEqual(['#d9a9ab', '#f7f5f2']);
  }, 30000);

  it('puts the base rail in the initial, not the name', async () => {
    const railed = await build({ standMode: 'rail' });
    const plain = await build();

    const [railedInitial, railedName] = printObjects(railed.blocks, railed.assembly, railed.config);
    const [plainInitial, plainName] = printObjects(plain.blocks, plain.assembly, plain.config);

    expect(triangleCount(railedInitial.geometry)).toBeGreaterThan(triangleCount(plainInitial.geometry));
    expect(bounds(railedInitial.geometry).min.y).toBeLessThan(bounds(plainInitial.geometry).min.y);
    expect(triangleCount(railedName.geometry)).toBe(triangleCount(plainName.geometry));
  }, 30000);

  it('writes a package carrying every triangle of both pieces', async () => {
    // Entries are stored rather than deflated, so the written text is in the
    // bytes verbatim — enough to confirm end to end that both meshes got there.
    const built = await build();
    const text = new TextDecoder().decode(combined3mfBinary(built.blocks, built.assembly, built.config));

    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('value="M (initial)"');
    expect(text).toContain('value="Matilde (name)"');

    const written = [...text.matchAll(/<triangle /g)].length;
    const expected = triangleCount(initialPrintGeometry(built.blocks, built.assembly, built.config)) + triangleCount(placedNameGeometry(built.blocks, built.assembly, built.config));
    // Degenerate triangles are dropped, so this is a ceiling rather than an
    // equality — but losing a meaningful share of the mesh would not be.
    expect(written).toBeLessThanOrEqual(expected);
    expect(written).toBeGreaterThan(expected * 0.99);
  }, 30000);
});
