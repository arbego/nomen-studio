// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { saveAs } from 'file-saver';
import { createDesignHistory } from '../store/designHistory';
import { startProjectSession } from '../project/projectSession';
import type { ProductDefinition } from '../products/types';
import { SaveProjectButton } from './ProjectButtons';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../products/registry', () => ({ getProduct: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
const store = createStore(() => ({ text: 'Hello' }));
let product: ProductDefinition;
function saveButton() { return container.querySelector('button')!; }
async function save() { await act(async () => saveButton().click()); }
function edit(text: string) { act(() => store.setState({ text })); }

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('showSaveFilePicker', undefined);
  vi.spyOn(window, 'prompt').mockReturnValue('project.json');
  store.setState({ text: 'Hello' });
  product = {
    id: 'cake', label: 'Cake', tagline: '', history: createDesignHistory(store, (state) => state),
    project: { snapshot: () => ({ name: 'Cake', design: store.getState() }), load: () => {} },
    Thumbnail: () => null, Controls: () => null, SceneContent: () => null, Export: () => null,
  };
  startProjectSession(product);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<SaveProjectButton product={product} />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  product.history.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('save button availability', () => {
  it('follows live edits, saves, undo, and redo even when history availability stays the same', async () => {
    expect(saveButton().disabled).toBe(true);
    await save();
    expect(window.prompt).not.toHaveBeenCalled();
    edit('First edit');
    expect(saveButton().disabled).toBe(false);
    await save();
    expect(saveButton().disabled).toBe(true);
    const savedHistory = product.history.getState();
    edit('Second edit');
    expect(product.history.getState()).toBe(savedHistory);
    expect(saveButton().disabled).toBe(false);
    act(() => product.history.undo());
    expect(saveButton().disabled).toBe(true);
    act(() => product.history.redo());
    expect(saveButton().disabled).toBe(false);
    edit('First edit');
    expect(saveButton().disabled).toBe(true);
  });

  it('stays enabled after canceled or failed saves and disables after a successful retry', async () => {
    edit('Edited');
    vi.mocked(window.prompt).mockReturnValueOnce(null);
    await save();
    expect(saveButton().disabled).toBe(false);
    expect(saveAs).not.toHaveBeenCalled();
    vi.mocked(saveAs).mockImplementationOnce(() => { throw new Error('Download failed'); });
    await save();
    expect(saveButton().disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await save();
    expect(saveButton().disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
