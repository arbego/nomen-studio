// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { createDesignHistory, type DesignHistory } from '../store/designHistory';
import { DesignHistoryProvider, DesignInput, HistoryButtons } from './DesignHistory';

let container: HTMLDivElement;
let root: Root;
const store = createStore(() => ({ name: 'Liam', size: 100 }));
let history: DesignHistory;

function Editor({ activeHistory = history }: { activeHistory?: DesignHistory }) {
  const state = useStore(store);
  return (
    <DesignHistoryProvider history={activeHistory}>
      <HistoryButtons history={activeHistory} />
      <DesignInput aria-label="Name" value={state.name} onChange={(e) => store.setState({ name: e.target.value })} />
      <DesignInput aria-label="Size" type="range" min={50} max={250} value={state.size} onChange={(e) => store.setState({ size: Number(e.target.value) })} />
      <input type="search" aria-label="Search fonts" />
      <input type="checkbox" aria-label="Backing card" />
      <div contentEditable suppressContentEditableWarning>Notes</div>
    </DesignHistoryProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  store.setState({ name: 'Liam', size: 100 });
  history = createDesignHistory(store, (state) => state);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Editor />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  history.dispose();
  vi.unstubAllGlobals();
});

function input(label: string) {
  return container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
}
function button(label: string) {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
}
function change(field: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function shortcut(key: string, options: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ctrlKey: true, ...options });
  act(() => { target.dispatchEvent(event); });
  return event;
}

describe('studio undo/redo controls', () => {
  it('updates disabled buttons and groups typing into a single step', () => {
    expect(button('Undo').disabled).toBe(true);
    expect(button('Redo').disabled).toBe(true);
    change(input('Name'), 'M');
    change(input('Name'), 'Mi');
    change(input('Name'), 'Mia');
    expect(store.getState().name).toBe('Mia');
    expect(button('Undo').disabled).toBe(false);
    act(() => button('Undo').click());
    expect(input('Name').value).toBe('Liam');
    expect(button('Undo').disabled).toBe(true);
    expect(button('Redo').disabled).toBe(false);
    act(() => button('Redo').click());
    expect(input('Name').value).toBe('Mia');
    expect(button('Redo').disabled).toBe(true);
  });

  it('separates slider drags even when the pointer is released outside the control', () => {
    change(input('Size'), '110');
    change(input('Size'), '140');
    act(() => window.dispatchEvent(new Event('pointerup')));
    change(input('Size'), '180');
    shortcut('z');
    expect(input('Size').value).toBe('140');
    shortcut('z');
    expect(input('Size').value).toBe('100');
    expect(button('Undo').disabled).toBe(true);
  });

  it('starts another step when returning to the same text field', () => {
    act(() => input('Name').focus());
    change(input('Name'), 'Mia');
    act(() => input('Search fonts').focus());
    act(() => input('Name').focus());
    change(input('Name'), 'Emma');
    shortcut('z', {}, input('Name'));
    expect(input('Name').value).toBe('Mia');
    shortcut('z', {}, input('Name'));
    expect(input('Name').value).toBe('Liam');
  });

  it('keeps the initial range-track jump with its drag when input precedes focus', () => {
    act(() => input('Name').focus());
    change(input('Name'), 'Mia');
    act(() => input('Size').dispatchEvent(new Event('pointerdown', { bubbles: true })));
    // Chromium updates the range before blurring the old field and focusing it.
    change(input('Size'), '110');
    act(() => input('Size').focus());
    change(input('Size'), '180');
    act(() => window.dispatchEvent(new Event('pointerup')));
    shortcut('z');
    expect(store.getState()).toEqual({ name: 'Mia', size: 100 });
    shortcut('z');
    expect(store.getState()).toEqual({ name: 'Liam', size: 100 });
  });

  it('supports Windows and Mac shortcuts, including within design fields', () => {
    change(input('Name'), 'Mia');
    expect(shortcut('z', {}, input('Name')).defaultPrevented).toBe(true);
    expect(store.getState().name).toBe('Liam');
    shortcut('y');
    expect(store.getState().name).toBe('Mia');
    shortcut('z', { ctrlKey: false, metaKey: true });
    expect(store.getState().name).toBe('Liam');
    shortcut('Z', { ctrlKey: false, metaKey: true, shiftKey: true });
    expect(store.getState().name).toBe('Mia');
    shortcut('z');
    shortcut('z', { shiftKey: true });
    expect(store.getState().name).toBe('Mia');
  });

  it('leaves search, contenteditable, composition, and unrelated shortcuts alone', () => {
    change(input('Name'), 'Mia');
    const notes = container.querySelector('[contenteditable]')!;
    for (const target of [input('Search fonts'), notes]) {
      expect(shortcut('z', {}, target).defaultPrevented).toBe(false);
    }
    for (const options of [{ ctrlKey: false }, { altKey: true }, { isComposing: true }]) {
      expect(shortcut('z', options).defaultPrevented).toBe(false);
    }
    expect(store.getState().name).toBe('Mia');
  });

  it('keeps design shortcuts available when a checkbox has focus', () => {
    change(input('Name'), 'Mia');
    expect(shortcut('z', {}, input('Backing card')).defaultPrevented).toBe(true);
    expect(store.getState().name).toBe('Liam');
  });

  it('switches shortcuts to the active product and removes them on leaving the studio', () => {
    change(input('Name'), 'Mia');
    const secondStore = createStore(() => ({ name: 'Cake' }));
    const secondHistory = createDesignHistory(secondStore, (state) => state);
    secondStore.setState({ name: 'Birthday' });
    act(() => root.render(<Editor activeHistory={secondHistory} />));
    shortcut('z');
    expect(secondStore.getState().name).toBe('Cake');
    expect(store.getState().name).toBe('Mia');
    act(() => root.render(<div>All products</div>));
    expect(shortcut('z').defaultPrevented).toBe(false);
    secondHistory.dispose();
  });
});
