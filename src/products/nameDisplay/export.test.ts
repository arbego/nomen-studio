import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { assembleNameDisplay, blockRegion, buildNameDisplayBlocks, initialPrintGeometry, namePrintGeometry, placedNameGeometry } from './geometry';
import { growRegion, regionToShapes } from '../../geometry/clipper';
import { combined3mfBinary, printObjects } from './export';
import { crc32 } from '../../export/zip';
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

/**
 * Reads back a stored-entry ZIP, verifying each entry's CRC on the way — a
 * stand-in for the slicer, which will refuse the file outright if the container
 * is malformed.
 */
function unzip(data: Uint8Array): Map<string, string> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder();
  const files = new Map<string, string>();
  let at = 0;
  while (at + 4 <= data.length && view.getUint32(at, true) === 0x04034b50) {
    expect(view.getUint16(at + 8, true)).toBe(0); // stored, as every reader can handle
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 22, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const start = at + 30 + nameLength + extraLength;
    const name = decoder.decode(data.subarray(at + 30, at + 30 + nameLength));
    const body = data.subarray(start, start + size);
    expect(crc32(body)).toBe(crc);
    files.set(name, decoder.decode(body));
    at = start + size;
  }
  return files;
}

function modelOf(data: Uint8Array): string {
  const files = unzip(data);
  // The three parts an OPC package needs before a reader will even look at the model.
  expect([...files.keys()]).toEqual(['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']);
  return files.get('3D/3dmodel.model')!;
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

describe('3mf export', () => {
  it('keeps the initial and the name as two separate, named, colored objects', async () => {
    // The reason this is a 3mf and not an stl: an stl is one anonymous bag of
    // triangles, and splitting it in a slicer splits by connected shell, which
    // on this design is a dozen-odd slabs and loose letters.
    const built = await build();
    const model = modelOf(combined3mfBinary(built.blocks, built.assembly, built.config));

    const objects = [...model.matchAll(/<object id="(\d+)"[^>]*name="([^"]*)"/g)];
    expect(objects.map((m) => m[2])).toEqual(['M (initial)', 'Matilde (name)']);

    // One build item per object, so each is picked up and placed in its own right.
    expect([...model.matchAll(/<item objectid="(\d+)"/g)].map((m) => m[1])).toEqual(objects.map((m) => m[1]));

    expect(model).toContain('displaycolor="#D9A9ABFF"');
    expect(model).toContain('displaycolor="#F7F5F2FF"');
    expect(model).toContain('unit="millimeter"');
  }, 30000);

  it('writes every triangle of both pieces', async () => {
    const built = await build();
    const model = modelOf(combined3mfBinary(built.blocks, built.assembly, built.config));

    const written = [...model.matchAll(/<triangle /g)].length;
    const expected = triangleCount(initialPrintGeometry(built.blocks, built.assembly, built.config)) + triangleCount(placedNameGeometry(built.blocks, built.assembly, built.config));
    expect(written).toBeGreaterThan(0);
    // Degenerate triangles are dropped, so this is a ceiling rather than an
    // equality — but losing a meaningful share of the mesh would not be.
    expect(written).toBeLessThanOrEqual(expected);
    expect(written).toBeGreaterThan(expected * 0.99);
  }, 30000);

  it('indexes every triangle to a vertex that exists', async () => {
    const built = await build();
    const model = modelOf(combined3mfBinary(built.blocks, built.assembly, built.config));

    // Per object, since 3mf indices are object-local: an off-by-one between the
    // two meshes' vertex lists would make one piece unreadable.
    for (const mesh of model.matchAll(/<vertices>(.*?)<\/vertices><triangles>(.*?)<\/triangles>/g)) {
      const vertexCount = [...mesh[1].matchAll(/<vertex /g)].length;
      const indices = [...mesh[2].matchAll(/v[123]="(\d+)"/g)].map((m) => Number(m[1]));
      expect(vertexCount).toBeGreaterThan(0);
      expect(Math.max(...indices)).toBeLessThan(vertexCount);
      expect(Math.min(...indices)).toBeGreaterThanOrEqual(0);
    }
  }, 30000);

  it('welds the triangle soup down to a shared vertex list', async () => {
    const built = await build();
    const model = modelOf(combined3mfBinary(built.blocks, built.assembly, built.config));

    // The geometries arrive non-indexed, three vertices per triangle. If welding
    // silently stopped working the file would still be valid, just twice the size.
    const vertices = [...model.matchAll(/<vertex /g)].length;
    const triangles = [...model.matchAll(/<triangle /g)].length;
    expect(vertices).toBeLessThan(triangles * 2);
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

  it('escapes a name that would otherwise break the xml', async () => {
    const built = await build({ name: 'Tom & Jo' });
    const model = modelOf(combined3mfBinary(built.blocks, built.assembly, built.config));
    expect(model).toContain('name="Tom &amp; Jo (name)"');
    expect(model).not.toContain('Tom & Jo');
  }, 30000);
});
