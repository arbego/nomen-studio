import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { assembleNameDisplay, blockRegion, buildNameDisplayBlocks, namePrintGeometry, placedNameGeometry } from './geometry';
import { growRegion, regionToShapes } from '../../geometry/clipper';
import { combined3mfBinary, printObjects } from './export';
import { pointIsInsideSolid } from '../../test-setup/pointInSolid';
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
  decoratorPlacements: {},
  decoratorColors: {},
  pocketDepthMm: 2.5,
  pocketClearanceMm: 0.25,
  standMode: 'none',
  standColor: '#2b2b2b',
  railHeightMm: 8,
  railDepthMm: 25,
  railMarginMm: 4,
  railSocketDepthMm: 5,
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
  const region = growRegion(blockRegion(built.blocks.name!, [built.config.nameLetterGapsMm], built.assembly.namePlacement), built.config.pocketClearanceMm);
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

  it.each(['', '  '])('exports an initial without an empty name part (%j)', async (name) => {
    const built = await build({ name });
    const objects = printObjects(built.blocks, built.assembly, built.config);
    expect(objects.map((object) => object.name)).toEqual(['M (initial)']);
    const text = new TextDecoder().decode(combined3mfBinary(built.blocks, built.assembly, built.config));
    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('value="M (initial)"');
    expect(text).toContain('<triangle ');
    expect(text).not.toContain('(name)');
  }, 30000);
});

describe('what the name display puts in the file', () => {
  it('keeps the rail and decorated pockets when the name is absent', async () => {
    const built = await build({
      name: '',
      nameDepthMm: 1,
      pocketDepthMm: 4,
      standMode: 'rail',
      decorators: [{ kind: 'icon', id: 'heart', iconName: 'favorite', widthMm: 25, depthMm: 5 }],
      decoratorPlacements: { heart: { offset: { x: 0, y: 90 }, angleDeg: 0 } },
      decoratorColors: { heart: '#b7c4ac' },
    });
    const objects = printObjects(built.blocks, built.assembly, built.config);
    expect(objects.map((object) => object.name)).toEqual(['M (initial)', 'Base rail', 'favorite (decorator)']);
    expect(objects[2].color).toBe('#b7c4ac');
    expect(bounds(objects[2].geometry).min.z).toBeCloseTo(config.initialDepthMm - 4, 4);
    expect(built.assembly.decorators[0].heldByInitial).toBe(true);
    const plain = await build({ name: '', pocketDepthMm: 0 });
    expect(triangleCount(objects[0].geometry)).toBeGreaterThan(triangleCount(plain.assembly.initialGeometry));
    const text = new TextDecoder().decode(combined3mfBinary(built.blocks, built.assembly, built.config));
    expect(text).toContain('value="Base rail"');
    expect(text).toContain('value="favorite (decorator)"');
    expect(text).not.toContain('(name)');
  }, 30000);

  it('keeps the initial and the name as two separate, named, colored pieces', async () => {
    // The reason this is a 3mf and not an stl: an stl is one anonymous bag of
    // triangles, and splitting it in a slicer splits by connected shell, which
    // on this design is a dozen-odd slabs and loose letters.
    const built = await build();
    const objects = printObjects(built.blocks, built.assembly, built.config);

    expect(objects.map((o) => o.name)).toEqual(['M (initial)', 'Matilde (name)']);
    expect(objects.map((o) => o.color)).toEqual(['#d9a9ab', '#f7f5f2']);
  }, 30000);

  it('writes the base rail as its own part, in its own color', async () => {
    // Separate because it is the piece a filament swap most obviously applies
    // to: these print standing up, so the rail is the first layers, and a part
    // is what a slicer lets you point at.
    const railed = await build({ standMode: 'rail' });
    const objects = printObjects(railed.blocks, railed.assembly, railed.config);

    expect(objects.map((o) => o.name)).toEqual(['M (initial)', 'Base rail', 'Matilde (name)']);
    expect(objects[1].color).toBe(railed.config.standColor);
    expect(objects[1].color).not.toBe(objects[0].color);
  }, 30000);

  it('leaves the letter and the name untouched by the rail', async () => {
    const railed = await build({ standMode: 'rail' });
    const plain = await build();

    const [railedInitial, rail, railedName] = printObjects(railed.blocks, railed.assembly, railed.config);
    const [plainInitial, plainName] = printObjects(plain.blocks, plain.assembly, plain.config);

    // The rail is a piece beside the letter now, not merged into it — so the
    // letter is the same solid it was without one.
    expect(triangleCount(railedInitial.geometry)).toBe(triangleCount(plainInitial.geometry));
    expect(triangleCount(railedName.geometry)).toBe(triangleCount(plainName.geometry));
    // And it is the rail that reaches below the letter and stands on the bed.
    expect(bounds(rail.geometry).min.y).toBeLessThan(bounds(railedInitial.geometry).min.y);
  }, 30000);

  it('cuts the rail\'s socket from the real letter, not from a box around it', async () => {
    // The wiring this proves: the letter's own silhouette reaches the socket.
    // An "M" has a gap between its legs that no bounding box knows about — the
    // rail has to be solid there and hollow inside the stems.
    const railed = await build({ standMode: 'rail' });
    const [initial, rail] = printObjects(railed.blocks, railed.assembly, railed.config);

    const letter = bounds(initial.geometry);
    const inTheSocket = railed.config.railSocketDepthMm / 2; // partway up the socket, well above its floor
    const z = railed.config.initialDepthMm / 2;

    // This M is a slab serif, so just above the baseline it is at its widest:
    // the serif foot is ink, and the counter beside it is not. A socket cut
    // from a bounding box would be hollow at both.
    expect(pointIsInsideSolid(rail.geometry, letter.min.x + 25, inTheSocket, z)).toBe(false);
    expect(pointIsInsideSolid(rail.geometry, letter.min.x + 60, inTheSocket, z)).toBe(true);
  }, 30000);

  it('clears the letter everywhere, so the two are parts to assemble rather than one fused lump', async () => {
    // The opposite of what this used to be: the rail reached into the letter so
    // a slicer would union them. Now they have to stay apart, with the fit
    // clearance between them, or the letter would not go in.
    const railed = await build({ standMode: 'rail' });
    const [initial, rail] = printObjects(railed.blocks, railed.assembly, railed.config);

    const railBounds = bounds(rail.geometry);
    const letter = bounds(initial.geometry);
    // The rail reaches above the letter's bottom — that is the socket — while
    // the letter's own material at that height sits in clear air.
    expect(railBounds.max.y).toBeCloseTo(letter.min.y + railed.config.railSocketDepthMm, 3);
    expect(pointIsInsideSolid(rail.geometry, letter.min.x + 4, 1, railed.config.initialDepthMm / 2)).toBe(false);
  }, 30000);

  it('writes no rail part for a design that stands on nothing', async () => {
    for (const standMode of ['none', 'trim'] as const) {
      const built = await build({ standMode });
      expect(printObjects(built.blocks, built.assembly, built.config).map((o) => o.name)).not.toContain('Base rail');
    }
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
    const expected = printObjects(built.blocks, built.assembly, built.config).reduce((total, object) => total + triangleCount(object.geometry), 0);
    // Degenerate triangles are dropped, so this is a ceiling rather than an
    // equality — but losing a meaningful share of the mesh would not be.
    expect(written).toBeLessThanOrEqual(expected);
    expect(written).toBeGreaterThan(expected * 0.99);
  }, 30000);
});
