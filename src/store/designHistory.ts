import { createStore, type StoreApi } from 'zustand/vanilla';

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

/** Product-independent history exposed to the studio shell. */
export interface DesignHistory extends Pick<StoreApi<HistoryState>, 'getState' | 'getInitialState' | 'subscribe'> {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  /** Consecutive edits from one control form a step until the gesture ends. */
  group: (key: object, edit: () => void, mergeWindowMs?: number) => void;
  /** Pass a control key to finish only that control's group. */
  endGroup: (key?: object) => void;
  dispose: () => void;
}

export const HISTORY_LIMIT = 100;

/**
 * Attach once, beside a product's store. Select its complete JSON-safe config,
 * excluding actions and transient UI/geometry state. Restoring via setState
 * deliberately bypasses edit-time corrections (e.g. resetting letter gaps).
 */
export function createDesignHistory<State, Config extends Partial<State>>(
  store: StoreApi<State>,
  select: (state: State) => Config,
): DesignHistory {
  const status = createStore<HistoryState>(() => ({ canUndo: false, canRedo: false }));
  const past: string[] = [];
  const future: string[] = [];
  const snapshot = () => JSON.stringify(select(store.getState()));
  let present = snapshot();
  let restoring = false;
  let activeGroup: { key: object; windowMs: number } | undefined;
  let lastGroup: { key: object; at: number } | undefined;

  function publish() {
    const next = { canUndo: past.length > 0, canRedo: future.length > 0 };
    const previous = status.getState();
    if (next.canUndo !== previous.canUndo || next.canRedo !== previous.canRedo) status.setState(next);
  }

  const unsubscribe = store.subscribe(() => {
    if (restoring) return;
    const next = snapshot();
    // A tap on a mesh can write an identical offset with a new object identity.
    if (next === present) return;
    const now = Date.now();
    const merge = activeGroup && lastGroup?.key === activeGroup.key && now - lastGroup.at <= activeGroup.windowMs;
    if (!merge) {
      past.push(present);
      if (past.length > HISTORY_LIMIT) past.shift();
    }
    present = next;
    future.length = 0;
    lastGroup = activeGroup ? { key: activeGroup.key, at: now } : undefined;
    publish();
  });

  function restore(from: string[], to: string[]) {
    lastGroup = undefined;
    const next = from.pop();
    if (next === undefined) return;
    to.push(present);
    present = next;
    restoring = true;
    try {
      store.setState(JSON.parse(next) as Config);
    } finally {
      restoring = false;
      publish();
    }
  }

  return {
    getState: status.getState,
    getInitialState: status.getInitialState,
    subscribe: status.subscribe,
    undo: () => restore(past, future),
    redo: () => restore(future, past),
    clear: () => {
      past.length = 0;
      future.length = 0;
      lastGroup = undefined;
      present = snapshot();
      publish();
    },
    group: (key, edit, mergeWindowMs = Infinity) => {
      const previous = activeGroup;
      activeGroup = { key, windowMs: mergeWindowMs };
      try {
        edit();
      } finally {
        activeGroup = previous;
      }
    },
    endGroup: (key) => {
      if (key === undefined || lastGroup?.key === key) lastGroup = undefined;
    },
    dispose: unsubscribe,
  };
}
