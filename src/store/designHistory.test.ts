import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createDesignHistory, HISTORY_LIMIT } from './designHistory';

function setup() {
  const store = createStore(() => ({ name: 'Liam', size: 100, selection: null as string | null, nested: { offsets: [1, 2] } }));
  const history = createDesignHistory(store, ({ name, size, nested }) => ({ name, size, nested }));
  return { store, history };
}

describe('design history', () => {
  it('restores complete configs without rewinding UI state', () => {
    const { store, history } = setup();
    expect(history.getState()).toEqual({ canUndo: false, canRedo: false });
    history.undo();
    history.redo();
    store.setState({ name: 'Mia', nested: { offsets: [3, 4] } });
    store.setState({ selection: 'name' });
    history.undo();
    expect(store.getState()).toEqual({ name: 'Liam', size: 100, selection: 'name', nested: { offsets: [1, 2] } });
    expect(history.getState()).toEqual({ canUndo: false, canRedo: true });
    history.redo();
    expect(store.getState()).toMatchObject({ name: 'Mia', nested: { offsets: [3, 4] } });
    expect(history.getState()).toEqual({ canUndo: true, canRedo: false });
  });

  it('ignores equal-value writes and clears redo only on an actual new edit', () => {
    const { store, history } = setup();
    store.setState({ nested: { offsets: [1, 2] } });
    expect(history.getState().canUndo).toBe(false);
    store.setState({ size: 120 });
    history.undo();
    store.setState({ size: 100 });
    expect(history.getState().canRedo).toBe(true);
    store.setState({ name: 'Emma' });
    expect(history.getState().canRedo).toBe(false);
    history.redo();
    expect(store.getState().size).toBe(100);
  });

  it('groups a long slider gesture, separating releases and other controls', () => {
    const { store, history } = setup();
    const size = {};
    const name = {};
    history.group(size, () => store.setState({ size: 110 }));
    history.group(size, () => store.setState({ size: 140 }));
    history.endGroup();
    history.group(size, () => store.setState({ size: 180 }));
    history.group(name, () => store.setState({ name: 'Mia' }));
    history.undo();
    expect(store.getState()).toMatchObject({ size: 180, name: 'Liam' });
    history.undo();
    expect(store.getState().size).toBe(140);
    history.undo();
    expect(store.getState().size).toBe(100);
    expect(history.getState().canUndo).toBe(false);
    history.redo();
    expect(store.getState().size).toBe(140);
  });

  it('splits typing at a pause and starts a fresh group after undo or redo', () => {
    vi.useFakeTimers();
    try {
      const { store, history } = setup();
      const field = {};
      const type = (name: string) => history.group(field, () => store.setState({ name }), 750);
      type('M');
      vi.advanceTimersByTime(200);
      type('Mi');
      vi.advanceTimersByTime(800);
      type('Mia');
      history.undo();
      expect(store.getState().name).toBe('Mi');
      history.redo();
      type('Mila');
      history.undo();
      expect(store.getState().name).toBe('Mia');
      history.undo();
      expect(store.getState().name).toBe('Mi');
      type('Milo');
      expect(history.getState().canRedo).toBe(false);
      history.undo();
      expect(store.getState().name).toBe('Mi');
      history.undo();
      expect(store.getState().name).toBe('Liam');
    } finally {
      vi.useRealTimers();
    }
  });

  it('retains the most recent 100 steps and clears without changing the design', () => {
    const { store, history } = setup();
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) store.setState({ size: 100 + i });
    for (let i = 0; i < HISTORY_LIMIT; i++) history.undo();
    expect(store.getState().size).toBe(105);
    expect(history.getState().canUndo).toBe(false);
    history.clear();
    expect(history.getState()).toEqual({ canUndo: false, canRedo: false });
    store.setState({ size: 200 });
    history.undo();
    expect(store.getState().size).toBe(105);
  });
});
