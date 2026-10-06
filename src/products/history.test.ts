import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cakeTopperHistory, selectCakeTopperConfig, useCakeTopperStore } from './cakeTopper/store';
import { nameDisplayHistory, selectNameDisplayConfig, useNameDisplayStore } from './nameDisplay/store';
import { PRODUCT_REGISTRY } from './registry';
import { useAppStore } from '../store/appStore';
import { hasUnsavedChanges } from '../project/projectSession';
import type { DesignHistory } from '../store/designHistory';

function reset() {
  useCakeTopperStore.getState().reset();
  useNameDisplayStore.getState().reset();
  cakeTopperHistory.clear();
  nameDisplayHistory.clear();
}
beforeEach(reset);
afterEach(reset);

function expectTimeline(history: DesignHistory, snapshot: () => unknown, edits: (() => void)[]) {
  const states = [snapshot()];
  for (const edit of edits) {
    edit();
    states.push(snapshot());
  }
  for (let i = states.length - 2; i >= 0; i--) {
    history.undo();
    expect(snapshot()).toEqual(states[i]);
  }
  expect(history.getState().canUndo).toBe(false);
  for (const state of states.slice(1)) {
    history.redo();
    expect(snapshot()).toEqual(state);
  }
  expect(history.getState().canRedo).toBe(false);
}

describe('product history integration', () => {
  it('reverses topper edits including dependent letter, hole, and ornament data', () => {
    const s = useCakeTopperStore.getState();
    let ornament = '';
    expectTimeline(cakeTopperHistory, () => selectCakeTopperConfig(useCakeTopperStore.getState()), [
      () => s.setLetterGap(0, 0, -4),
      () => s.toggleClosedOutlineHole('line-0-letter-1'),
      () => s.setLineText(0, 'Birthday'),
      () => s.setConfig({ wordFontId: 'pacifico' }),
      () => s.setConfig({ extrudeDepthMm: 1 }),
      () => s.setConfig({ previewColor: '#123456', outlineColor: '#654321' }),
      () => s.setLineOffset(1, { x: 5, y: 8 }),
      () => s.setStickOffset('word', 0, { x: 12, y: 4 }),
      () => s.removeLine(1),
      () => s.addLine(),
      () => s.addStick('word'),
      () => s.removeStick('word', 0),
      () => s.setSticksEnabled('word', false),
      () => { ornament = s.addDecorator('star'); },
      () => s.updateDecorator(ornament, { widthMm: 35 }),
      () => s.setDecoratorOffset(ornament, { x: 3, y: 9 }),
      () => s.setDecoratorAngle(ornament, 30),
      () => s.setDecoratorColor(ornament, '#112233'),
      () => s.removeDecorator(ornament),
      () => s.reset(),
    ]);
    expect(useCakeTopperStore.getState().setLineText).toBe(s.setLineText);
  });

  it('reverses name-display inlays, placement, stand settings, and ornaments', () => {
    const s = useNameDisplayStore.getState();
    let ornament = '';
    expectTimeline(nameDisplayHistory, () => selectNameDisplayConfig(useNameDisplayStore.getState()), [
      () => s.setNameLetterGap(0, -3),
      () => s.setConfig({ name: 'Mia' }),
      () => s.setConfig({ initial: 'M', initialColor: '#123456' }),
      () => s.setConfig({ nameFontId: 'pacifico' }),
      () => s.setNameOffset({ x: 7, y: 13 }),
      () => s.setConfig({ nameAngleDeg: 20, pocketDepthMm: 2 }),
      () => s.setConfig({ nameDepthMm: 1.5 }),
      () => s.setStandMode('rail'),
      () => s.setConfig({ railHeightMm: 10, standColor: '#112233' }),
      () => { ornament = s.addDecorator({ kind: 'text', text: '2026' }); },
      () => s.updateDecorator(ornament, { text: 'Birthday', depthMm: 6 }),
      () => s.setDecoratorOffset(ornament, { x: 3, y: 9 }),
      () => s.setDecoratorAngle(ornament, 30),
      () => s.setDecoratorColor(ornament, '#112233'),
      () => s.removeDecorator(ornament),
      () => s.reset(),
    ]);
    expect(useNameDisplayStore.getState().setConfig).toBe(s.setConfig);
  });

  it('keeps products independent', () => {
    useCakeTopperStore.getState().setConfig({ sizeMm: 200 });
    useNameDisplayStore.getState().setConfig({ name: 'Mia' });
    cakeTopperHistory.undo();
    expect(useNameDisplayStore.getState().name).toBe('Mia');
    expect(nameDisplayHistory.getState().canUndo).toBe(true);
    nameDisplayHistory.undo();
    cakeTopperHistory.redo();
    expect(useCakeTopperStore.getState().sizeMm).toBe(200);
    expect(useNameDisplayStore.getState().name).toBe('Liam');
  });

  it.each(PRODUCT_REGISTRY)('starts a fresh history when opening a $label project', (product) => {
    product.project.load(product.id === 'cake-topper' ? { lines: ['Old'] } : { name: 'Old' });
    product.history.undo();
    expect(product.history.getState().canRedo).toBe(true);
    product.project.load(product.id === 'cake-topper' ? { lines: ['Mia'], decorators: [] } : { name: 'Mia', decorators: [] });
    useAppStore.getState().selectProduct(product.id);
    const opened = product.project.snapshot().design;
    expect(product.history.getState()).toEqual({ canUndo: false, canRedo: false });
    expect(hasUnsavedChanges(product)).toBe(false);
    product.history.undo();
    product.history.redo();
    expect(product.project.snapshot().design).toEqual(opened);
    product.project.load(product.id === 'cake-topper' ? { lines: ['Edited'] } : { name: 'Edited' });
    expect(hasUnsavedChanges(product)).toBe(true);
    product.history.undo();
    expect(hasUnsavedChanges(product)).toBe(false);
    product.history.redo();
    expect(hasUnsavedChanges(product)).toBe(true);
    useAppStore.getState().clearProduct();
    useAppStore.getState().selectProduct(product.id);
    expect(product.history.getState()).toEqual({ canUndo: false, canRedo: false });
  });
});
