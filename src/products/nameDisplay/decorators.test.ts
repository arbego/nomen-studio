import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { assembleNameDisplay, blockRegion, buildNameDisplayBlocks, placedDecoratorGeometry } from './geometry';
import { growRegion, regionToShapes } from '../../geometry/clipper';
import { printObjects } from './export';
import { useNameDisplayStore } from './store';
import type { DecoratorConfig, NameDisplayConfig } from './config';

const base: NameDisplayConfig = {
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

const heart: DecoratorConfig = { id: 'd1', iconName: 'favorite', widthMm: 25, depthMm: 5 };

/** On the initial's upper arm, clear of the name at y=45. */
const ON_THE_LETTER = { x: 0, y: 90 };
/** Well off the side of a 120mm initial. */
const OFF_THE_LETTER = { x: 400, y: 90 };

async function build(overrides: Partial<NameDisplayConfig> = {}) {
  const config = { ...base, ...overrides };
  const blocks = await buildNameDisplayBlocks(config);
  return { blocks, assembly: assembleNameDisplay(blocks, config), config };
}

function withHeart(offset = ON_THE_LETTER, decorator: DecoratorConfig = heart) {
  return build({ decorators: [decorator], decoratorOffsets: { [decorator.id]: offset } });
}

function bounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position').count / 3;
}

describe('decorator geometry', () => {
  it('builds one block per decorator, from the icon it names', async () => {
    const { blocks } = await withHeart();
    expect(blocks.decorators).toHaveLength(1);
    expect(blocks.decorators[0].id).toBe('d1');
    expect(blocks.decorators[0].block.label).toBe('favorite');
  }, 30000);

  it('cuts its own pocket into the initial', async () => {
    // A recess is a hole in the front slab, and a hole is more geometry, not
    // less — if the decorator never reached the boolean these would be equal.
    const plain = await build();
    const decorated = await withHeart();
    expect(triangleCount(decorated.assembly.initialGeometry)).toBeGreaterThan(triangleCount(plain.assembly.initialGeometry));
  }, 30000);

  it('cuts nothing when it has been dragged off the initial', async () => {
    const plain = await build();
    const adrift = await withHeart(OFF_THE_LETTER);
    expect(triangleCount(adrift.assembly.initialGeometry)).toBe(triangleCount(plain.assembly.initialGeometry));
    expect(adrift.assembly.decorators[0].overlapsInitial).toBe(false);
  }, 30000);

  it('reports whether the initial is there to hold it', async () => {
    expect((await withHeart()).assembly.decorators[0].overlapsInitial).toBe(true);
    expect((await withHeart(OFF_THE_LETTER)).assembly.decorators[0].overlapsInitial).toBe(false);
  }, 30000);

  it('seats in the recess cut for it, within the fit clearance', async () => {
    const built = await withHeart();
    const placed = bounds(placedDecoratorGeometry(built.blocks.decorators[0], built.assembly));

    const pocket = new THREE.Box2();
    const region = growRegion(blockRegion(built.blocks.decorators[0].block, [], built.assembly.decorators[0].placement), built.config.pocketClearanceMm);
    for (const shape of regionToShapes(region)) for (const point of shape.getPoints()) pocket.expandByPoint(point);

    const slack = built.config.pocketClearanceMm + 0.01;
    expect(placed.min.x).toBeGreaterThan(pocket.min.x);
    expect(placed.max.x).toBeLessThan(pocket.max.x);
    expect(placed.min.x - pocket.min.x).toBeLessThan(slack);
    expect(pocket.max.x - placed.max.x).toBeLessThan(slack);
  }, 30000);

  it('rests on the same pocket floor as the name, standing proud by its own thickness', async () => {
    const built = await withHeart();
    const placed = bounds(placedDecoratorGeometry(built.blocks.decorators[0], built.assembly));
    expect(placed.min.z).toBeCloseTo(built.assembly.nameZMm, 4);
    expect(placed.max.z).toBeCloseTo(built.assembly.nameZMm + heart.depthMm, 4);
  }, 30000);

  it('lands where it was dragged to', async () => {
    const moved = await withHeart({ x: 40, y: 20 });
    const origin = await withHeart({ x: 0, y: 0 });
    const a = bounds(placedDecoratorGeometry(moved.blocks.decorators[0], moved.assembly));
    const b = bounds(placedDecoratorGeometry(origin.blocks.decorators[0], origin.assembly));
    expect(a.min.x - b.min.x).toBeCloseTo(40, 4);
    expect(a.min.y - b.min.y).toBeCloseTo(20, 4);
  }, 30000);

  it('is built at the width and thickness it was given', async () => {
    const built = await withHeart(ON_THE_LETTER, { ...heart, widthMm: 40, depthMm: 8 });
    const placed = bounds(placedDecoratorGeometry(built.blocks.decorators[0], built.assembly));
    expect(placed.max.x - placed.min.x).toBeCloseTo(40, 1);
    expect(placed.max.z - placed.min.z).toBeCloseTo(8, 3);
  }, 30000);

  it('carries several ornaments at once, each cutting its own pocket', async () => {
    const two: DecoratorConfig[] = [heart, { id: 'd2', iconName: 'star', widthMm: 20, depthMm: 5 }];
    const one = await withHeart();
    const both = await build({ decorators: two, decoratorOffsets: { d1: { x: -30, y: 90 }, d2: { x: 30, y: 90 } } });

    expect(both.blocks.decorators.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(both.assembly.decorators).toHaveLength(2);
    expect(triangleCount(both.assembly.initialGeometry)).toBeGreaterThan(triangleCount(one.assembly.initialGeometry));
  }, 30000);

  it('exports each ornament as its own printable part', async () => {
    const built = await withHeart();
    const objects = printObjects(built.blocks, built.assembly, built.config);
    expect(objects.map((o) => o.name)).toEqual(['M (initial)', 'Matilde (name)', 'favorite (decorator)']);
    // It prints in the inlay filament, like the name it sits beside.
    expect(objects[2].color).toBe(built.config.nameColor);
  }, 30000);
});

describe('decorator store', () => {
  it('adds one with an icon, a size and a place to stand', () => {
    useNameDisplayStore.getState().reset();
    useNameDisplayStore.getState().addDecorator('star');

    const { decorators, decoratorOffsets } = useNameDisplayStore.getState();
    expect(decorators).toHaveLength(1);
    expect(decorators[0].iconName).toBe('star');
    expect(decorators[0].widthMm).toBeGreaterThan(0);
    expect(decoratorOffsets[decorators[0].id]).toBeDefined();
  });

  it('puts a second one somewhere other than exactly on top of the first', () => {
    useNameDisplayStore.getState().reset();
    useNameDisplayStore.getState().addDecorator('star');
    useNameDisplayStore.getState().addDecorator('favorite');

    const { decorators, decoratorOffsets } = useNameDisplayStore.getState();
    expect(decoratorOffsets[decorators[0].id]).not.toEqual(decoratorOffsets[decorators[1].id]);
  });

  it('takes the offset away with the ornament, so a later one cannot inherit it', () => {
    useNameDisplayStore.getState().reset();
    useNameDisplayStore.getState().addDecorator('star');
    const [{ id }] = useNameDisplayStore.getState().decorators;

    useNameDisplayStore.getState().removeDecorator(id);
    expect(useNameDisplayStore.getState().decorators).toHaveLength(0);
    expect(useNameDisplayStore.getState().decoratorOffsets[id]).toBeUndefined();
  });

  it('edits one ornament without touching the others', () => {
    useNameDisplayStore.getState().reset();
    useNameDisplayStore.getState().addDecorator('star');
    useNameDisplayStore.getState().addDecorator('favorite');
    const [first, second] = useNameDisplayStore.getState().decorators;

    useNameDisplayStore.getState().updateDecorator(second.id, { widthMm: 60, iconName: 'pets' });
    const after = useNameDisplayStore.getState().decorators;
    expect(after[0]).toEqual(first);
    expect(after[1].widthMm).toBe(60);
    expect(after[1].iconName).toBe('pets');
  });

  it('never lets an ornament end up thinner than the pocket it drops into', () => {
    useNameDisplayStore.getState().reset();
    useNameDisplayStore.getState().setConfig({ pocketDepthMm: 4 });
    useNameDisplayStore.getState().addDecorator('star');
    const [{ id }] = useNameDisplayStore.getState().decorators;

    useNameDisplayStore.getState().updateDecorator(id, { depthMm: 1 });
    expect(useNameDisplayStore.getState().decorators[0].depthMm).toBe(4);
  });

  it('caps the pocket at the thinnest thing inlaid into it, ornaments included', () => {
    useNameDisplayStore.getState().reset();
    useNameDisplayStore.getState().addDecorator('star');
    const [{ id }] = useNameDisplayStore.getState().decorators;
    useNameDisplayStore.getState().updateDecorator(id, { depthMm: 3 });

    // The name is 5mm thick, so without the ornament this would have been allowed.
    useNameDisplayStore.getState().setConfig({ pocketDepthMm: 4 });
    expect(useNameDisplayStore.getState().pocketDepthMm).toBe(3);
  });

  it('keeps ornaments out of the async build key, so dragging one never re-extrudes a font', async () => {
    const { selectNameDisplayBlocksConfig } = await import('./store');
    useNameDisplayStore.getState().reset();
    useNameDisplayStore.getState().addDecorator('star');
    const [{ id }] = useNameDisplayStore.getState().decorators;

    const before = JSON.stringify(selectNameDisplayBlocksConfig(useNameDisplayStore.getState()));
    useNameDisplayStore.getState().setDecoratorOffset(id, { x: 123, y: 45 });
    expect(JSON.stringify(selectNameDisplayBlocksConfig(useNameDisplayStore.getState()))).toBe(before);

    // Changing what the ornament *is* must still rebuild it.
    useNameDisplayStore.getState().updateDecorator(id, { widthMm: 99 });
    expect(JSON.stringify(selectNameDisplayBlocksConfig(useNameDisplayStore.getState()))).not.toBe(before);
  });
});
