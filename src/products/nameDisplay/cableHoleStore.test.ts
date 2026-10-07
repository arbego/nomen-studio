import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nameDisplayHistory, useNameDisplayStore } from './store';

const placement = { point: { x: -20, y: 30, z: 5 }, normal: { x: -1, y: 0, z: 0 } };

beforeEach(() => {
  useNameDisplayStore.getState().reset();
  nameDisplayHistory.clear();
});
afterEach(() => {
  useNameDisplayStore.getState().reset();
  nameDisplayHistory.clear();
});

describe('cable-hole design and preview state', () => {
  it('preserves the chosen position while changing diameter, color or inlays', () => {
    const store = useNameDisplayStore.getState();
    store.setConfig({ cableHolePlacement: placement });
    store.setConfig({ cableHoleDiameterMm: 10, initialColor: '#ffffff', name: 'Mia' });
    expect(useNameDisplayStore.getState().cableHolePlacement).toEqual(placement);
  });

  it.each([
    { initial: 'O' },
    { initialFontId: 'alfa-slab-one' },
    { initialHeightMm: 200 },
    { trimOffsetMm: 2 },
    { standMode: 'trim' as const },
  ])('returns to automatic placement when the initial silhouette changes ($0)', (edit) => {
    const store = useNameDisplayStore.getState();
    store.setConfig({ cableHolePlacement: placement });
    store.setConfig(edit);
    expect(useNameDisplayStore.getState().cableHolePlacement).toBeNull();
  });

  it('resets placement when the standing control trims the glyph', () => {
    const store = useNameDisplayStore.getState();
    store.setConfig({ cableHolePlacement: placement });
    store.setStandMode('rail');
    expect(useNameDisplayStore.getState().cableHolePlacement).toEqual(placement);
    store.setStandMode('trim');
    expect(useNameDisplayStore.getState().cableHolePlacement).toBeNull();
  });

  it('does not add lid transparency changes to undo history', () => {
    const store = useNameDisplayStore.getState();
    store.setLidTransparent(true);
    expect(useNameDisplayStore.getState().lidTransparent).toBe(true);
    store.setLidTransparent(false);
    expect(useNameDisplayStore.getState().lidTransparent).toBe(false);
    expect(nameDisplayHistory.getState().canUndo).toBe(false);
  });

  it('undoes and redoes the hole size and selected side position', () => {
    const store = useNameDisplayStore.getState();
    store.setConfig({ hollowEnabled: true, cableHoleEnabled: true });
    nameDisplayHistory.clear();
    store.setConfig({ cableHoleDiameterMm: 8, cableHolePlacement: placement });
    nameDisplayHistory.undo();
    expect(useNameDisplayStore.getState()).toMatchObject({ cableHoleDiameterMm: 6, cableHolePlacement: null });
    nameDisplayHistory.redo();
    expect(useNameDisplayStore.getState()).toMatchObject({ cableHoleDiameterMm: 8, cableHolePlacement: placement });
  });
});
