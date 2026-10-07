import { describe, expect, it } from 'vitest';
import { PRODUCT_REGISTRY, getProduct } from '../products/registry';
import { parseProjectFile, serializeProject } from './projectFile';
import { useNameDisplayStore, selectNameDisplayConfig } from '../products/nameDisplay/store';
import { useCakeTopperStore, selectCakeTopperConfig } from '../products/cakeTopper/store';
import { parseNameDisplayConfig } from '../products/nameDisplay/project';
import { parseCakeTopperConfig } from '../products/cakeTopper/project';

const known = (id: string) => getProduct(id) !== undefined;

/** Saves, reads back, and loads — the whole trip a file actually makes. */
function roundTrip(productId: string) {
  const product = getProduct(productId)!;
  const { design } = product.project.snapshot();
  const file = parseProjectFile(serializeProject(productId, design), known);
  product.project.load(file.design);
  return { saved: design, loaded: product.project.snapshot().design };
}

describe('every product can be saved and opened', () => {
  it.each(PRODUCT_REGISTRY.map((p) => p.id))('%s', (productId) => {
    const { saved, loaded } = roundTrip(productId);
    // The whole promise of the feature: what comes back is what went in.
    expect(loaded).toEqual(saved);
  });

  it.each(PRODUCT_REGISTRY.map((p) => p.id))('%s names the file after the design', (productId) => {
    const { name } = getProduct(productId)!.project.snapshot();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });
});

/**
 * A reset design with nothing on it. The studio opens on one that already
 * carries an ornament (see nameDisplay/store.ts); this test builds its own set
 * and counts on them being the only ones.
 */
function resetWithoutDecorators() {
  useNameDisplayStore.getState().reset();
  for (const decorator of useNameDisplayStore.getState().decorators) {
    useNameDisplayStore.getState().removeDecorator(decorator.id);
  }
}

describe('name display round trip', () => {
  it.each([
    { point: { x: -20, y: 15, z: 0 }, normal: { x: 0, y: 0, z: -1 } },
    { point: { x: -25, y: 45, z: 10 }, normal: { x: -1, y: 0, z: 0 } },
    { point: { x: -22.45, y: 45.75, z: 10 }, normal: { x: -Math.SQRT1_2, y: Math.SQRT1_2, z: 0 } },
  ])('preserves the cable hole diameter and back or side placement ($normal)', (placement) => {
    resetWithoutDecorators();
    const store = useNameDisplayStore.getState();
    store.setConfig({ hollowEnabled: true, cableHoleEnabled: true, cableHoleDiameterMm: 8.5, cableHolePlacement: placement });
    store.setLidTransparent(true);
    const { saved, loaded } = roundTrip('name-display');
    expect(loaded).toEqual(saved);
    expect(loaded).not.toHaveProperty('lidTransparent');
  });

  it('keeps legacy bowls without a cable hole and validates malformed hole settings', () => {
    expect(parseNameDisplayConfig({ hollowEnabled: true })).toMatchObject({ cableHoleEnabled: false, cableHolePlacement: null });
    expect(parseNameDisplayConfig({ cableHoleDiameterMm: 999, cableHolePlacement: { point: { x: NaN, y: 20, z: 999 }, normal: { x: -3, y: 4, z: 0 } } }))
      .toMatchObject({ cableHoleDiameterMm: 30, cableHolePlacement: { point: { x: 0, y: 20, z: 100 }, normal: { x: -0.6, y: 0.8, z: 0 } } });
    expect(parseNameDisplayConfig({ cableHolePlacement: { point: {}, normal: {} } }).cableHolePlacement!.normal).toEqual({ x: 0, y: 0, z: -1 });
  });

  it('preserves the hollow bowl and lid settings while excluding the open-lid preview', () => {
    resetWithoutDecorators();
    const store = useNameDisplayStore.getState();
    store.setConfig({ hollowEnabled: true, initialDepthMm: 30, wallThicknessMm: 2.6, lidThicknessMm: 3.4, lidClearanceMm: 0.3, initialColor: '#f7f5f2', lidColor: '#d9a9ab' });
    store.setLidTransparent(true);
    const { saved, loaded } = roundTrip('name-display');
    expect(loaded).toEqual(saved);
    expect(loaded).not.toHaveProperty('lidTransparent');
    expect(useNameDisplayStore.getState().lidTransparent).toBe(false);
  });

  it('keeps older projects solid and repairs impossible hollow dimensions', () => {
    expect(parseNameDisplayConfig({ name: 'Mia' }).hollowEnabled).toBe(false);
    const parsed = parseNameDisplayConfig({ hollowEnabled: true, initialDepthMm: 2, wallThicknessMm: 10, lidThicknessMm: 10, lidClearanceMm: 20 });
    expect(parsed.initialDepthMm).toBeGreaterThan(parsed.wallThicknessMm + parsed.lidThicknessMm);
    expect(parsed.lidClearanceMm).toBe(1);
  });

  it.each(['', '   '])('preserves a nameless design and names its project after the initial (%j)', (name) => {
    resetWithoutDecorators();
    const store = useNameDisplayStore.getState();
    store.setConfig({ name, nameDepthMm: 1, pocketDepthMm: 4 });
    store.addDecorator({ kind: 'icon', iconName: 'star' });
    store.setStandMode('rail');
    const { saved, loaded } = roundTrip('name-display');
    expect(loaded).toEqual(saved);
    expect(useNameDisplayStore.getState().name).toBe(name);
    expect(useNameDisplayStore.getState().nameLetterGapsMm).toHaveLength(Math.max(name.length - 1, 0));
    expect(useNameDisplayStore.getState().pocketDepthMm).toBe(4);
    expect(getProduct('name-display')!.project.snapshot().name).toBe(useNameDisplayStore.getState().initial);
  });

  it('brings back an edited design exactly, ornaments and all', () => {
    const store = useNameDisplayStore.getState();
    resetWithoutDecorators();
    store.setConfig({ initial: 'B', name: 'Johanna', nameAngleDeg: 12, initialHeightMm: 150 });
    store.setStandMode('rail');
    store.addDecorator({ kind: 'icon', iconName: 'favorite' });
    store.addDecorator({ kind: 'icon', iconName: 'star' });
    store.addDecorator({ kind: 'text' });
    const [first, second, third] = useNameDisplayStore.getState().decorators;
    store.updateDecorator(second.id, { widthMm: 33 });
    store.setDecoratorAngle(second.id, -40);
    store.setDecoratorOffset(first.id, { x: -12, y: 70 });
    store.updateDecorator(third.id, { text: 'est. 2019', fontId: 'pacifico' });
    store.setDecoratorColor(third.id, '#b7c4ac');
    const before = selectNameDisplayConfig(useNameDisplayStore.getState());

    const file = parseProjectFile(serializeProject('name-display', before), known);
    useNameDisplayStore.getState().reset();
    getProduct('name-display')!.project.load(file.design);

    expect(selectNameDisplayConfig(useNameDisplayStore.getState())).toEqual(before);
  });

  it('does not hand a newly added ornament an id a loaded one is already using', () => {
    // Loading restores ids like `decorator-2`; a session counter starting from
    // zero would hand the same id out again, and the two would share a
    // placement.
    const store = useNameDisplayStore.getState();
    store.reset();
    store.addDecorator({ kind: 'icon', iconName: 'favorite' });
    store.addDecorator({ kind: 'icon', iconName: 'star' });
    const saved = selectNameDisplayConfig(useNameDisplayStore.getState());

    useNameDisplayStore.getState().reset();
    getProduct('name-display')!.project.load(saved);
    useNameDisplayStore.getState().addDecorator({ kind: 'icon', iconName: 'pets' });

    const ids = useNameDisplayStore.getState().decorators.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('reading a damaged or foreign design', () => {
  it('falls back to defaults rather than producing a design made of NaN', () => {
    const parsed = parseNameDisplayConfig({ initialHeightMm: Number.NaN, nameWidthMm: 'wide', nameOffset: { x: 'left' }, pocketDepthMm: Infinity });
    for (const value of Object.values(parsed)) {
      expect(typeof value === 'number' ? Number.isFinite(value) : true).toBe(true);
    }
    expect(Number.isFinite(parsed.nameOffset.x)).toBe(true);
    expect(parsed.initialHeightMm).toBeGreaterThan(0);
  });

  it('clamps a value no slider could have produced', () => {
    expect(parseNameDisplayConfig({ initialHeightMm: 1e9 }).initialHeightMm).toBeLessThanOrEqual(500);
    expect(parseCakeTopperConfig({ sizeMm: -50 }).sizeMm).toBeGreaterThan(0);
  });

  it('drops an ornament naming an icon this build does not have', () => {
    // Substituting a different symbol would be worse: a design that comes back
    // quietly wrong beats nothing only if you notice.
    const parsed = parseNameDisplayConfig({
      decorators: [
        { kind: 'icon', id: 'a', iconName: 'favorite', widthMm: 20, depthMm: 4 },
        { kind: 'icon', id: 'b', iconName: 'not_a_real_icon', widthMm: 20, depthMm: 4 },
      ],
    });
    expect(parsed.decorators.map((d) => (d.kind === 'icon' ? d.iconName : d.text))).toEqual(['favorite']);
  });

  it('gives every ornament exactly one placement and one color, and keeps no orphans', () => {
    const parsed = parseNameDisplayConfig({
      decorators: [{ kind: 'icon', id: 'a', iconName: 'star', widthMm: 20, depthMm: 4 }],
      decoratorPlacements: { ghost: { offset: { x: 5, y: 5 }, angleDeg: 90 } },
      decoratorColors: { ghost: '#b7c4ac' },
    });
    expect(Object.keys(parsed.decoratorPlacements)).toEqual(['a']);
    expect(Object.keys(parsed.decoratorColors)).toEqual(['a']);
  });

  it('reads an ornament written before they had kinds as the icon it was', () => {
    const parsed = parseNameDisplayConfig({ nameColor: '#f0c6d0', decorators: [{ id: 'a', iconName: 'star', widthMm: 20, depthMm: 4 }] });
    expect(parsed.decorators[0]).toMatchObject({ kind: 'icon', iconName: 'star' });
    // And in the filament it was shown and exported in back then: the name's.
    expect(parsed.decoratorColors.a).toBe('#f0c6d0');
  });

  it('drops a word ornament with nothing left to say', () => {
    const parsed = parseNameDisplayConfig({
      decorators: [
        { kind: 'text', id: 'a', text: 'est. 2019', fontId: 'pacifico', widthMm: 60, depthMm: 5 },
        { kind: 'text', id: 'b', text: '   ', fontId: 'pacifico', widthMm: 60, depthMm: 5 },
      ],
    });
    expect(parsed.decorators.map((d) => d.id)).toEqual(['a']);
    expect(parsed.decorators[0]).toMatchObject({ kind: 'text', text: 'est. 2019', fontId: 'pacifico' });
  });

  it('never loads a pocket deep enough to swallow what sits in it', () => {
    const parsed = parseNameDisplayConfig({
      nameDepthMm: 5,
      pocketDepthMm: 40,
      decorators: [{ kind: 'icon', id: 'a', iconName: 'star', widthMm: 20, depthMm: 2 }],
    });
    expect(parsed.pocketDepthMm).toBeLessThanOrEqual(2);
  });

  it('keeps the cake topper line arrays in step with its lines', () => {
    // letterGapsMm[i] is the gaps of lines[i]; a file saying otherwise would
    // misalign every letter after the discrepancy.
    const parsed = parseCakeTopperConfig({ lines: ['Ava', 'Bo'], letterGapsMm: [[1, 2, 3, 4, 5]], lineOffsets: [] });
    expect(parsed.letterGapsMm.map((gaps) => gaps.length)).toEqual([2, 1]);
    expect(parsed.lineOffsets).toHaveLength(2);
    expect(parsed.letterGapsMm[0]).toEqual([1, 2]);
  });

  it('reads an empty object as the default design, so nothing can load as nothing', () => {
    expect(() => parseCakeTopperConfig({})).not.toThrow();
    expect(parseCakeTopperConfig({}).lines.length).toBeGreaterThan(0);
    expect(parseNameDisplayConfig({}).initial.length).toBe(1);
  });

  it('survives a design that is not an object at all', () => {
    for (const raw of [null, undefined, 42, 'nope', []]) {
      expect(() => parseCakeTopperConfig(raw)).not.toThrow();
      expect(() => parseNameDisplayConfig(raw)).not.toThrow();
    }
  });
});

describe('cake topper round trip', () => {
  it('brings back its ornaments, where they sit and what colour they are', () => {
    useCakeTopperStore.getState().reset();
    const id = useCakeTopperStore.getState().addDecorator('star');
    useCakeTopperStore.getState().updateDecorator(id, { widthMm: 33, depthMm: 4 });
    useCakeTopperStore.getState().setDecoratorOffset(id, { x: -12, y: 48 });
    useCakeTopperStore.getState().setDecoratorAngle(id, -25);
    useCakeTopperStore.getState().setDecoratorColor(id, '#b7c4ac');
    const before = selectCakeTopperConfig(useCakeTopperStore.getState());

    const file = parseProjectFile(serializeProject('cake-topper', before), known);
    useCakeTopperStore.getState().reset();
    getProduct('cake-topper')!.project.load(file.design);

    expect(selectCakeTopperConfig(useCakeTopperStore.getState())).toEqual(before);
  });

  it('drops a placement for an ornament that is not in the file, rather than keeping a key nothing uses', () => {
    const orphaned = {
      ...selectCakeTopperConfig(useCakeTopperStore.getState()),
      decorators: [],
      decoratorPlacements: { 'decorator-9': { offset: { x: 1, y: 2 }, angleDeg: 0 } },
      decoratorColors: { 'decorator-9': '#000000' },
    };
    getProduct('cake-topper')!.project.load(orphaned);

    expect(useCakeTopperStore.getState().decoratorPlacements).toEqual({});
    expect(useCakeTopperStore.getState().decoratorColors).toEqual({});
  });
});

describe('loading restores the design wholesale', () => {
  it('does not apply the edit-time corrections that would rewrite it', () => {
    // setConfig resets letter gaps when the name changes, which is right for an
    // edit and wrong for a file: the gaps in it were tuned for that very name.
    const tuned = { ...selectNameDisplayConfig(useNameDisplayStore.getState()), name: 'Mia', nameLetterGapsMm: [-3, 4] };
    useNameDisplayStore.getState().reset();
    getProduct('name-display')!.project.load(tuned);
    expect(useNameDisplayStore.getState().nameLetterGapsMm).toEqual([-3, 4]);
  });

  it('replaces the previous design rather than merging with it', () => {
    const store = useCakeTopperStore.getState();
    store.reset();
    store.setConfig({ lines: ['Alpha', 'Beta', 'Gamma'] });
    const threeLines = selectCakeTopperConfig(useCakeTopperStore.getState());

    useCakeTopperStore.getState().reset();
    useCakeTopperStore.getState().setConfig({ lines: ['One'] });
    getProduct('cake-topper')!.project.load(threeLines);
    expect(useCakeTopperStore.getState().lines).toEqual(['Alpha', 'Beta', 'Gamma']);

    getProduct('cake-topper')!.project.load({ ...threeLines, lines: ['Solo'] });
    expect(useCakeTopperStore.getState().lines).toEqual(['Solo']);
    expect(useCakeTopperStore.getState().letterGapsMm).toHaveLength(1);
  });
});
