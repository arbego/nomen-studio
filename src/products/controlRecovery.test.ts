import { afterEach, beforeEach, expect, it } from 'vitest';
import { DEFAULT_NAME_DISPLAY_CONFIG, nameDisplayHistory, selectNameDisplayConfig, useNameDisplayStore } from './nameDisplay/store';
import { cakeTopperHistory, selectCakeTopperConfig, useCakeTopperStore } from './cakeTopper/store';

beforeEach(() => {
  useNameDisplayStore.getState().reset();
  useCakeTopperStore.getState().reset();
  nameDisplayHistory.clear();
  cakeTopperHistory.clear();
});
afterEach(() => {
  useNameDisplayStore.getState().reset();
  useCakeTopperStore.getState().reset();
  nameDisplayHistory.clear();
  cakeTopperHistory.clear();
});

it('resets only the name position and can undo without losing other edits', () => {
  const store = useNameDisplayStore.getState();
  store.setConfig({ nameWidthMm: 135, nameAngleDeg: 18, nameColor: '#3368b0' });
  store.setNameOffset({ x: 999, y: -100 });
  const before = selectNameDisplayConfig(useNameDisplayStore.getState());
  store.resetNamePosition();
  expect(selectNameDisplayConfig(useNameDisplayStore.getState())).toEqual({ ...before, nameOffset: DEFAULT_NAME_DISPLAY_CONFIG.nameOffset });
  nameDisplayHistory.undo();
  expect(selectNameDisplayConfig(useNameDisplayStore.getState())).toEqual(before);
});

it('recovers an inlaid decorator without changing its angle, color, or dimensions', () => {
  const store = useNameDisplayStore.getState();
  const id = store.decorators[0]!.id;
  store.setDecoratorOffset(id, { x: 800, y: -100 });
  store.setDecoratorAngle(id, 28);
  store.setDecoratorColor(id, '#cc3a33');
  store.updateDecorator(id, { widthMm: 30 });
  const before = selectNameDisplayConfig(useNameDisplayStore.getState());
  store.resetDecoratorPosition(id);
  const expected = { ...before, decoratorPlacements: { ...before.decoratorPlacements, [id]: { ...before.decoratorPlacements[id], offset: DEFAULT_NAME_DISPLAY_CONFIG.decoratorPlacements[id]!.offset } } };
  expect(selectNameDisplayConfig(useNameDisplayStore.getState())).toEqual(expected);
  nameDisplayHistory.undo();
  expect(selectNameDisplayConfig(useNameDisplayStore.getState())).toEqual(before);
});

it('restores natural line layout without resetting text or spacing', () => {
  const store = useCakeTopperStore.getState();
  store.setLineOffset(0, { x: 999, y: -500 });
  store.setLetterGap(0, 0, -3);
  const before = selectCakeTopperConfig(useCakeTopperStore.getState());
  store.resetLinePositions();
  expect(selectCakeTopperConfig(useCakeTopperStore.getState())).toEqual({ ...before, lineOffsets: before.lines.map(() => ({ x: 0, y: 0 })) });
  cakeTopperHistory.undo();
  expect(selectCakeTopperConfig(useCakeTopperStore.getState())).toEqual(before);
});

it('recovers topper sticks and decorators as separate undoable actions', () => {
  const store = useCakeTopperStore.getState();
  const id = store.addDecorator('material:favorite');
  store.setDecoratorOffset(id, { x: 999, y: -500 });
  store.setDecoratorAngle(id, -20);
  store.setStickOffset('word', 0, { x: 999, y: -500 });
  const before = selectCakeTopperConfig(useCakeTopperStore.getState());
  store.resetDecoratorPosition(id);
  expect(selectCakeTopperConfig(useCakeTopperStore.getState())).toEqual({ ...before, decoratorPlacements: { ...before.decoratorPlacements, [id]: { offset: { x: 20, y: 40 }, angleDeg: -20 } } });
  cakeTopperHistory.undo();
  expect(selectCakeTopperConfig(useCakeTopperStore.getState())).toEqual(before);
  store.resetStickPositions('word');
  expect(selectCakeTopperConfig(useCakeTopperStore.getState())).toEqual({ ...before, stickOffsets: { word: [{ x: -7.5, y: 0 }, { x: 7.5, y: 0 }] } });
  cakeTopperHistory.undo();
  expect(selectCakeTopperConfig(useCakeTopperStore.getState())).toEqual(before);
});
