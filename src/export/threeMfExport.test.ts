import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { threeMfBinary, type ThreeMfObject } from './threeMfExport';
import { crc32 } from './zip';

/** A box at a known place, so a piece's coordinates can be followed through the file. */
function box(width: number, height: number, depth: number, x = 0): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, 0, 0);
  return geometry;
}

const pieces: ThreeMfObject[] = [
  { name: 'Lettering', color: '#f0c6d0', geometry: box(40, 20, 3) },
  { name: 'Backing card', color: '#f7f5f2', geometry: box(50, 30, 1.5, 100) },
];

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

function packageOf(objects: ThreeMfObject[], title = 'Test design') {
  const files = unzip(threeMfBinary(objects, title));
  return { files, model: files.get('3D/3dmodel.model')!, settings: files.get('Metadata/model_settings.config')! };
}

const meshIdsIn = (model: string) => [...model.matchAll(/<object id="(\d+)"[^>]*pindex="\d+"/g)].map((m) => m[1]);
const componentsIn = (model: string) => [...model.matchAll(/<component objectid="(\d+)"/g)].map((m) => m[1]);
const itemsIn = (model: string) => [...model.matchAll(/<item objectid="(\d+)"/g)].map((m) => m[1]);

describe('3mf package', () => {
  it('holds the parts an OPC reader needs, each with a valid CRC', () => {
    const { files } = packageOf(pieces);
    expect([...files.keys()]).toEqual(['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model', 'Metadata/model_settings.config']);
    expect(files.get('[Content_Types].xml')).toContain('Extension="model"');
    expect(files.get('_rels/.rels')).toContain('Target="/3D/3dmodel.model"');
  });

  it('is deterministic, so the same design always writes the same bytes', () => {
    // Timestamps are the usual reason an archive differs from itself; this one
    // has none of its own.
    expect(threeMfBinary(pieces, 'Test design')).toEqual(threeMfBinary(pieces, 'Test design'));
  });

  it('declares millimeters, so nothing arrives at a tenth of its size', () => {
    expect(packageOf(pieces).model).toContain('unit="millimeter"');
  });
});

describe('3mf objects', () => {
  it('gives every piece its own named, colored mesh', () => {
    const { model } = packageOf(pieces);
    expect([...model.matchAll(/<object id="\d+"[^>]*name="([^"]*)"[^>]*pindex="\d+"/g)].map((m) => m[1])).toEqual(['Lettering', 'Backing card']);
    expect(model).toContain('displaycolor="#F0C6D0FF"');
    expect(model).toContain('displaycolor="#F7F5F2FF"');
  });

  it('groups the pieces into one object, so no slicer has to ask whether they belong together', () => {
    // Separate top-level objects are separate models to a slicer: Bambu Studio
    // prompts ("multi-part object detected") and, answered the other way,
    // scatters the pieces across the plate and loses the fit between them.
    const { model } = packageOf(pieces);
    expect(componentsIn(model)).toEqual(meshIdsIn(model));

    const items = itemsIn(model);
    expect(items).toHaveLength(1);
    expect(meshIdsIn(model)).not.toContain(items[0]); // the assembly, not one of the pieces
  });

  it('defines every object before the component that references it', () => {
    // 3mf resolves resources in document order; a forward reference is a file a
    // reader can refuse.
    const { model } = packageOf(pieces);
    for (const id of componentsIn(model)) {
      expect(model.indexOf(`<object id="${id}"`)).toBeLessThan(model.indexOf(`<component objectid="${id}"`));
    }
  });

  it('leaves components untransformed, so pieces keep the coordinates they were designed at', () => {
    const { model } = packageOf(pieces);
    expect(model).not.toContain('<component objectid="2" transform=');
    // The second piece was built 100mm to the right and must still be there.
    expect(model).toMatch(/<vertex x="1[12]\d(\.\d+)?"/);
  });

  it('works for a one-piece design, which is most of them', () => {
    const { model, settings } = packageOf([pieces[0]]);
    expect(meshIdsIn(model)).toHaveLength(1);
    expect(componentsIn(model)).toEqual(meshIdsIn(model));
    expect(itemsIn(model)).toHaveLength(1);
    expect([...settings.matchAll(/<part /g)]).toHaveLength(1);
  });
});

describe('3mf slicer settings', () => {
  it('names each part and puts it on its own filament', () => {
    const { model, settings } = packageOf(pieces, 'Emma');
    expect(settings).toContain(`<object id="${itemsIn(model)[0]}">`);
    expect([...settings.matchAll(/<part id="(\d+)" subtype="normal_part">/g)].map((m) => m[1])).toEqual(componentsIn(model));
    expect(settings).toContain('<metadata key="name" value="Lettering"/>');
    expect(settings).toContain('<metadata key="name" value="Backing card"/>');
    expect([...settings.matchAll(/key="extruder" value="(\d+)"/g)].map((m) => m[1])).toEqual(['1', '2']);
  });

  it('carries the design name through as the object name', () => {
    expect(packageOf(pieces, 'Emma').settings).toContain('<metadata key="name" value="Emma"/>');
  });
});

describe('3mf meshes', () => {
  it.each([
    ['indexed', box(40, 20, 3)],
    ['non-indexed', box(40, 20, 3).toNonIndexed()],
  ])('welds a %s box down to its 8 real corners', (_label, geometry) => {
    // A box is 8 corners and 12 triangles however it is stored. Non-indexed it
    // arrives as 36 loose corners, which is what welding is for; indexed, its
    // triangles live in the index, and reading straight down the position
    // buffer instead yields a mesh of nonsense.
    const { model } = packageOf([{ name: 'Box', color: '#ffffff', geometry }]);
    expect([...model.matchAll(/<vertex /g)]).toHaveLength(8);
    expect([...model.matchAll(/<triangle /g)]).toHaveLength(12);
  });

  it('indexes every triangle to a vertex that exists, per object', () => {
    // 3mf indices are object-local: an off-by-one between the two meshes' vertex
    // lists would make one piece unreadable.
    const { model } = packageOf(pieces);
    const meshes = [...model.matchAll(/<vertices>(.*?)<\/vertices><triangles>(.*?)<\/triangles>/g)];
    expect(meshes).toHaveLength(2);
    for (const mesh of meshes) {
      const vertexCount = [...mesh[1].matchAll(/<vertex /g)].length;
      const indices = [...mesh[2].matchAll(/v[123]="(\d+)"/g)].map((m) => Number(m[1]));
      expect(Math.max(...indices)).toBeLessThan(vertexCount);
      expect(Math.min(...indices)).toBeGreaterThanOrEqual(0);
    }
  });

  it('drops triangles that collapse when rounded, since they enclose nothing', () => {
    // Stricter readers reject a degenerate triangle outright, and a sliver this
    // far below printable resolution is not geometry worth defending.
    const sliver = new THREE.BufferGeometry();
    sliver.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1e-6, 0, 0, 0, 1e-6, 0, 0, 0, 0, 10, 0, 0, 0, 10, 0]), 3));
    const { model } = packageOf([{ name: 'Slivers', color: '#ffffff', geometry: sliver }]);
    expect([...model.matchAll(/<triangle /g)]).toHaveLength(1);
  });

  it('escapes a design name that would otherwise break the xml', () => {
    const { model, settings } = packageOf([{ ...pieces[0], name: 'Tom & Jo' }], 'Tom & Jo');
    expect(model).toContain('name="Tom &amp; Jo"');
    expect(settings).toContain('value="Tom &amp; Jo"');
    expect(model).not.toContain('Tom & Jo');
  });
});
