import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { assembleNameDisplay, blockRegion, buildNameDisplayBlocks, placedDecoratorGeometry } from './geometry';
import { growRegion, regionToShapes } from '../../geometry/clipper';
import { printObjects } from './export';
import { DEFAULT_NAME_DISPLAY_CONFIG, useNameDisplayStore } from './store';
import type { DecoratorConfig, NameDisplayConfig, TextDecoratorConfig } from './config';

const base: NameDisplayConfig = {
  ...DEFAULT_NAME_DISPLAY_CONFIG,
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

const heart: DecoratorConfig = { kind: 'icon', id: 'd1', iconName: 'favorite', widthMm: 25, depthMm: 5 };

/** On the initial's upper arm, clear of the name at y=45. */
const ON_THE_LETTER = { x: 0, y: 90 };
/** Well off the side of a 120mm initial. */
const OFF_THE_LETTER = { x: 400, y: 90 };

async function build(overrides: Partial<NameDisplayConfig> = {}) {
  const config = { ...base, ...overrides };
  const blocks = await buildNameDisplayBlocks(config);
  return { blocks, assembly: assembleNameDisplay(blocks, config), config };
}

function withHeart(offset = ON_THE_LETTER, decorator: DecoratorConfig = heart, angleDeg = 0) {
  return build({ decorators: [decorator], decoratorPlacements: { [decorator.id]: { offset, angleDeg } } });
}

function bounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!;
}

/** The icon off an ornament that has to be one — a test expecting a symbol should fail loudly if it got a word instead. */
function iconNameOf(decorator: DecoratorConfig): string {
  if (decorator.kind !== 'icon') {
    throw new Error(`Expected an icon ornament, got ${decorator.kind}`);
  }
  return decorator.iconName;
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
    expect(adrift.assembly.decorators[0].heldByInitial).toBe(false);
  }, 30000);

  it('reports whether the initial is there to hold it', async () => {
    expect((await withHeart()).assembly.decorators[0].heldByInitial).toBe(true);
    expect((await withHeart(OFF_THE_LETTER)).assembly.decorators[0].heldByInitial).toBe(false);
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

  it('turns about its own center, so an angle spins it in place', async () => {
    const straight = await withHeart(ON_THE_LETTER);
    const turned = await withHeart(ON_THE_LETTER, heart, 90);

    const a = bounds(placedDecoratorGeometry(straight.blocks.decorators[0], straight.assembly));
    const b = bounds(placedDecoratorGeometry(turned.blocks.decorators[0], turned.assembly));

    // Same centre, turned footprint: a heart is taller than it is wide, so at
    // 90° those swap. Swinging about the origin instead would move the centre.
    expect((b.min.x + b.max.x) / 2).toBeCloseTo((a.min.x + a.max.x) / 2, 3);
    expect((b.min.y + b.max.y) / 2).toBeCloseTo((a.min.y + a.max.y) / 2, 3);
    expect(b.max.x - b.min.x).toBeCloseTo(a.max.y - a.min.y, 2);
    expect(b.max.y - b.min.y).toBeCloseTo(a.max.x - a.min.x, 2);
  }, 30000);

  it('cuts its pocket from the turned silhouette, so a turned icon still drops in', async () => {
    const turned = await withHeart(ON_THE_LETTER, heart, 40);
    const placed = bounds(placedDecoratorGeometry(turned.blocks.decorators[0], turned.assembly));

    const pocket = new THREE.Box2();
    const region = growRegion(blockRegion(turned.blocks.decorators[0].block, [], turned.assembly.decorators[0].placement), turned.config.pocketClearanceMm);
    for (const shape of regionToShapes(region)) for (const point of shape.getPoints()) pocket.expandByPoint(point);

    const slack = turned.config.pocketClearanceMm + 0.01;
    expect(placed.min.x).toBeGreaterThan(pocket.min.x);
    expect(placed.max.x).toBeLessThan(pocket.max.x);
    expect(placed.min.x - pocket.min.x).toBeLessThan(slack);
    expect(pocket.max.y - placed.max.y).toBeLessThan(slack);
  }, 30000);

  it('is built at the width and thickness it was given', async () => {
    const built = await withHeart(ON_THE_LETTER, { ...heart, widthMm: 40, depthMm: 8 });
    const placed = bounds(placedDecoratorGeometry(built.blocks.decorators[0], built.assembly));
    expect(placed.max.x - placed.min.x).toBeCloseTo(40, 1);
    expect(placed.max.z - placed.min.z).toBeCloseTo(8, 3);
  }, 30000);

  it('carries several ornaments at once, each cutting its own pocket', async () => {
    const two: DecoratorConfig[] = [heart, { kind: 'icon', id: 'd2', iconName: 'star', widthMm: 20, depthMm: 5 }];
    const one = await withHeart();
    const both = await build({ decorators: two, decoratorPlacements: { d1: { offset: { x: -30, y: 90 }, angleDeg: 0 }, d2: { offset: { x: 30, y: 90 }, angleDeg: 0 } } });

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

describe('text ornaments', () => {
  const word: TextDecoratorConfig = { kind: 'text', id: 't1', text: 'Mia', fontId: 'dancing-script', widthMm: 60, depthMm: 5 };

  function withWord(text = word.text, offset = ON_THE_LETTER) {
    return withHeart(offset, { ...word, text });
  }

  it('is built from its own words, in its own face, at the width it was given', async () => {
    const built = await withWord();
    expect(built.blocks.decorators).toHaveLength(1);
    expect(built.blocks.decorators[0].block.label).toBe('Mia');
    // One solid per letter, exactly as the name is built — an ornament is a text
    // block, not a special case.
    expect(built.blocks.decorators[0].block.lines[0].letters.map((letter) => letter.char)).toEqual(['M', 'i', 'a']);

    const placed = bounds(placedDecoratorGeometry(built.blocks.decorators[0], built.assembly));
    expect(placed.max.x - placed.min.x).toBeCloseTo(60, 1);
  }, 30000);

  it('cuts its own pocket and seats in it, like any other ornament', async () => {
    const plain = await build();
    // Lower down the M than the heart sits: at y=90 the dot of its "i" lands in
    // the letter's notch with nothing under it, which is the next test.
    const built = await withWord(word.text, { x: 0, y: 60 });
    expect(triangleCount(built.assembly.initialGeometry)).toBeGreaterThan(triangleCount(plain.assembly.initialGeometry));
    expect(built.assembly.decorators[0].heldByInitial).toBe(true);

    const placed = bounds(placedDecoratorGeometry(built.blocks.decorators[0], built.assembly));
    expect(placed.min.z).toBeCloseTo(built.assembly.nameZMm, 4);
    expect(placed.max.z).toBeCloseTo(built.assembly.nameZMm + word.depthMm, 4);
  }, 30000);

  it('is not held just because most of it is — the dot of an "i" needs the letter under it too', async () => {
    // A word ornament is one printed part but several solids, and a solid with
    // no pocket under it is held by nothing, whatever it is grouped with. Here
    // the M's notch opens right where the dot falls.
    const inTheNotch = await withWord(word.text, { x: 0, y: 90 });
    expect(inTheNotch.assembly.decorators[0].heldByInitial).toBe(false);
  }, 30000);

  it.each(['', '   '])('is dropped from the build while its text is cleared (%p), not left to fail it', async (text) => {
    // The state you pass through every time you retype one: it must leave the
    // rest of the piece standing, since the preview is what you are typing at.
    const plain = await build();
    const built = await withWord(text);
    expect(built.blocks.decorators).toHaveLength(0);
    expect(built.assembly.decorators).toHaveLength(0);
    expect(triangleCount(built.assembly.initialGeometry)).toBe(triangleCount(plain.assembly.initialGeometry));
  }, 30000);

  it('exports as its own part, named after what it says', async () => {
    const built = await withWord();
    expect(printObjects(built.blocks, built.assembly, built.config).map((o) => o.name)).toEqual(['M (initial)', 'Matilde (name)', 'Mia (decorator)']);
  }, 30000);
});

describe('decorator colors', () => {
  it('prints each ornament in its own filament', async () => {
    const built = await build({
      decorators: [heart, { kind: 'icon', id: 'd2', iconName: 'star', widthMm: 20, depthMm: 5 }],
      decoratorPlacements: { d1: { offset: { x: -30, y: 90 }, angleDeg: 0 }, d2: { offset: { x: 30, y: 90 }, angleDeg: 0 } },
      decoratorColors: { d1: '#b7c4ac' },
    });

    const objects = printObjects(built.blocks, built.assembly, built.config);
    expect(objects[2].color).toBe('#b7c4ac');
    // d2 was never given one, so it prints in the inlay filament — which is
    // also what a file saved before ornaments had colors describes.
    expect(objects[3].color).toBe(built.config.nameColor);
  }, 30000);
});

/**
 * A reset design with nothing on it.
 *
 * The studio opens on a design that already carries an ornament (see store.ts),
 * which is right for someone arriving at it and wrong for these: they are about
 * what adding, editing and removing *do*, so they start from none and count
 * from zero.
 */
function resetWithoutDecorators() {
  useNameDisplayStore.getState().reset();
  for (const decorator of useNameDisplayStore.getState().decorators) {
    useNameDisplayStore.getState().removeDecorator(decorator.id);
  }
}

describe('decorator store', () => {
  it('increases total thickness when necessary to preserve space for the hollow bowl and lid', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().setConfig({ initialDepthMm: 5, hollowEnabled: true, wallThicknessMm: 4, lidThicknessMm: 4 });
    expect(useNameDisplayStore.getState().initialDepthMm).toBeGreaterThan(4 + 4 + 1.2);
  });

  it('adds one with an icon, a size and a place to stand', () => {
    resetWithoutDecorators();
    const id = useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });

    const { decorators, decoratorPlacements } = useNameDisplayStore.getState();
    expect(decorators).toHaveLength(1);
    // Handed back so the picker that added it can go on changing that same one
    // rather than adding a second with the next click.
    expect(id).toBe(decorators[0].id);
    expect(iconNameOf(decorators[0])).toBe('star');
    expect(decorators[0].widthMm).toBeGreaterThan(0);
    expect(decoratorPlacements[decorators[0].id].offset).toBeDefined();
    expect(decoratorPlacements[decorators[0].id].angleDeg).toBe(0);
  });

  it('adds a word in the name\'s own face, so it looks like it belongs to the piece', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().setConfig({ nameFontId: 'pacifico' });
    useNameDisplayStore.getState().addDecorator({ kind: 'text' });

    const [added] = useNameDisplayStore.getState().decorators;
    expect(added.kind).toBe('text');
    expect(added.kind === 'text' && added.fontId).toBe('pacifico');
    // Something is there to see and to drag, rather than an ornament that
    // exists only in the panel.
    expect(added.kind === 'text' && added.text.trim().length).toBeGreaterThan(0);
  });

  it('gives a new ornament the inlay filament, and takes it away again with it', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    const [{ id }] = useNameDisplayStore.getState().decorators;
    expect(useNameDisplayStore.getState().decoratorColors[id]).toBe(useNameDisplayStore.getState().nameColor);

    useNameDisplayStore.getState().removeDecorator(id);
    expect(useNameDisplayStore.getState().decoratorColors[id]).toBeUndefined();
  });

  it('recolors one ornament without touching the others, or what they are', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'favorite' });
    const [first, second] = useNameDisplayStore.getState().decorators;
    const before = useNameDisplayStore.getState().decoratorColors[first.id];

    useNameDisplayStore.getState().setDecoratorColor(second.id, '#b7c4ac');
    expect(useNameDisplayStore.getState().decoratorColors[second.id]).toBe('#b7c4ac');
    expect(useNameDisplayStore.getState().decoratorColors[first.id]).toBe(before);
    expect(useNameDisplayStore.getState().decorators).toEqual([first, second]);
  });

  it('puts a second one somewhere other than exactly on top of the first', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'favorite' });

    const { decorators, decoratorPlacements } = useNameDisplayStore.getState();
    expect(decoratorPlacements[decorators[0].id].offset).not.toEqual(decoratorPlacements[decorators[1].id].offset);
  });

  it('takes the offset away with the ornament, so a later one cannot inherit it', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    const [{ id }] = useNameDisplayStore.getState().decorators;

    useNameDisplayStore.getState().removeDecorator(id);
    expect(useNameDisplayStore.getState().decorators).toHaveLength(0);
    expect(useNameDisplayStore.getState().decoratorPlacements[id]).toBeUndefined();
  });

  it('edits one ornament without touching the others', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'favorite' });
    const [first, second] = useNameDisplayStore.getState().decorators;

    useNameDisplayStore.getState().updateDecorator(second.id, { widthMm: 60, iconName: 'pets' });
    const after = useNameDisplayStore.getState().decorators;
    expect(after[0]).toEqual(first);
    expect(after[1].widthMm).toBe(60);
    expect(iconNameOf(after[1])).toBe('pets');
  });

  it('turns one ornament without moving it, and without touching the others', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'favorite' });
    const [first, second] = useNameDisplayStore.getState().decorators;
    const firstPlacement = useNameDisplayStore.getState().decoratorPlacements[first.id];

    useNameDisplayStore.getState().setDecoratorAngle(second.id, 35);

    const placements = useNameDisplayStore.getState().decoratorPlacements;
    expect(placements[second.id].angleDeg).toBe(35);
    expect(placements[second.id].offset).toEqual(useNameDisplayStore.getState().decoratorPlacements[second.id].offset);
    expect(placements[first.id]).toEqual(firstPlacement);
  });

  it('keeps the angle when the ornament is dragged, and the position when it is turned', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    const [{ id }] = useNameDisplayStore.getState().decorators;

    useNameDisplayStore.getState().setDecoratorAngle(id, 60);
    useNameDisplayStore.getState().setDecoratorOffset(id, { x: 10, y: 20 });
    expect(useNameDisplayStore.getState().decoratorPlacements[id]).toEqual({ offset: { x: 10, y: 20 }, angleDeg: 60 });

    useNameDisplayStore.getState().setDecoratorAngle(id, -15);
    expect(useNameDisplayStore.getState().decoratorPlacements[id]).toEqual({ offset: { x: 10, y: 20 }, angleDeg: -15 });
  });

  it('never lets an ornament end up thinner than the pocket it drops into', () => {
    resetWithoutDecorators();
    // The name is set thick enough in the same breath: a pocket is capped at
    // the thinnest thing inlaid into it, so asking for 4mm against the default
    // 3mm name would quietly get a 3mm pocket and test nothing.
    useNameDisplayStore.getState().setConfig({ nameDepthMm: 6, pocketDepthMm: 4 });
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    const [{ id }] = useNameDisplayStore.getState().decorators;

    useNameDisplayStore.getState().updateDecorator(id, { depthMm: 1 });
    expect(useNameDisplayStore.getState().decorators[0].depthMm).toBe(4);
  });

  it('caps the pocket at the thinnest thing inlaid into it, ornaments included', () => {
    resetWithoutDecorators();
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    const [{ id }] = useNameDisplayStore.getState().decorators;
    useNameDisplayStore.getState().updateDecorator(id, { depthMm: 3 });

    // The name is 5mm thick, so without the ornament this would have been allowed.
    useNameDisplayStore.getState().setConfig({ pocketDepthMm: 4 });
    expect(useNameDisplayStore.getState().pocketDepthMm).toBe(3);
  });

  it('keeps ornaments out of the async build key, so dragging one never re-extrudes a font', async () => {
    const { selectNameDisplayBlocksConfig } = await import('./store');
    resetWithoutDecorators();
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'star' });
    const [{ id }] = useNameDisplayStore.getState().decorators;

    const before = JSON.stringify(selectNameDisplayBlocksConfig(useNameDisplayStore.getState()));
    useNameDisplayStore.getState().setDecoratorOffset(id, { x: 123, y: 45 });
    expect(JSON.stringify(selectNameDisplayBlocksConfig(useNameDisplayStore.getState()))).toBe(before);

    // Nor does recoloring one: a color is not a shape, and clicking a swatch
    // should not re-extrude every glyph on the piece.
    useNameDisplayStore.getState().setDecoratorColor(id, '#b7c4ac');
    expect(JSON.stringify(selectNameDisplayBlocksConfig(useNameDisplayStore.getState()))).toBe(before);

    // Changing what the ornament *is* must still rebuild it.
    useNameDisplayStore.getState().updateDecorator(id, { widthMm: 99 });
    expect(JSON.stringify(selectNameDisplayBlocksConfig(useNameDisplayStore.getState()))).not.toBe(before);
  });
});
