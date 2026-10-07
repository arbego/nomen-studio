// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { saveAs } from 'file-saver';
import type { ProductDefinition } from '../products/types';
import { createDesignHistory } from '../store/designHistory';
import { hasUnsavedChanges, startProjectSession } from './projectSession';
import { saveProject } from './saveProject';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

function setup() {
  const store = createStore(() => ({ name: 'My cake', text: 'Hello' }));
  const history = createDesignHistory(store, (state) => state);
  const product: ProductDefinition = {
    id: 'cake', label: 'Cake', tagline: '', history,
    project: { snapshot: () => ({ name: store.getState().name, design: store.getState() }), load: () => {} },
    Thumbnail: () => null, Controls: () => null, SceneContent: () => null, Export: () => null,
  };
  startProjectSession(product);
  store.setState({ text: 'Edited' });
  return { product, store };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('showSaveFilePicker', undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('project file saving', () => {
  it('prefills the native picker and only marks the project saved after closing the file', async () => {
    const { product } = setup();
    const write = vi.fn<(data: string) => Promise<void>>(async () => {});
    const close = vi.fn(async () => { expect(hasUnsavedChanges(product)).toBe(true); });
    const picker = vi.fn(async () => ({ createWritable: async () => ({ write, close }) }));
    vi.stubGlobal('showSaveFilePicker', picker);
    expect(await saveProject(product)).toBe(true);
    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'my-cake.json',
      types: [{ description: 'Nomen Studio project', accept: { 'application/json': ['.json'] } }],
    });
    expect(JSON.parse(write.mock.calls[0]![0])).toMatchObject({ product: 'cake', design: { text: 'Edited' } });
    expect(close).toHaveBeenCalledOnce();
    expect(saveAs).not.toHaveBeenCalled();
    expect(hasUnsavedChanges(product)).toBe(false);
  });

  it('does not download or mark saved when the native picker is canceled', async () => {
    const { product } = setup();
    vi.stubGlobal('showSaveFilePicker', vi.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError')));
    expect(await saveProject(product)).toBe(false);
    expect(saveAs).not.toHaveBeenCalled();
    expect(hasUnsavedChanges(product)).toBe(true);
  });

  it('keeps write failures unsaved', async () => {
    const { product } = setup();
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => ({
      createWritable: async () => ({ write: async () => { throw new Error('Disk full'); }, close: vi.fn() }),
    })));
    await expect(saveProject(product)).rejects.toThrow('Disk full');
    expect(hasUnsavedChanges(product)).toBe(true);
  });

  it('keeps edits made while saving unsaved', async () => {
    const { product, store } = setup();
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => ({
      createWritable: async () => ({ write: async () => { store.setState({ text: 'Another edit' }); }, close: async () => {} }),
    })));
    expect(await saveProject(product)).toBe(true);
    expect(hasUnsavedChanges(product)).toBe(true);
    product.history.undo();
    expect(hasUnsavedChanges(product)).toBe(false);
  });

  it('asks for a filename on unsupported browsers and adds the JSON extension', async () => {
    const { product } = setup();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Birthday cake');
    expect(await saveProject(product)).toBe(true);
    expect(prompt).toHaveBeenCalledWith('Save project as:', 'my-cake.json');
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'Birthday cake.json');
    expect(hasUnsavedChanges(product)).toBe(false);
  });

  it.each([null, '', '   '])('does not save when the fallback filename is %j', async (filename) => {
    const { product } = setup();
    vi.spyOn(window, 'prompt').mockReturnValue(filename);
    expect(await saveProject(product)).toBe(false);
    expect(saveAs).not.toHaveBeenCalled();
    expect(hasUnsavedChanges(product)).toBe(true);
  });
});
