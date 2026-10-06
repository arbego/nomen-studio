// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAs } from 'file-saver';
import App from './App';
import { useAppStore } from './store/appStore';
import { serializeProject } from './project/projectFile';

const history = vi.hoisted(() => ({ clear: vi.fn() }));
const project = vi.hoisted(() => ({
  snapshot: vi.fn(() => ({ name: 'My cake', design: { text: 'Hello' } })),
  load: vi.fn(),
}));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('./products/registry', () => {
  const product = {
    id: 'cake', label: 'Cake', tagline: 'Make a cake topper', project, history,
    Thumbnail: () => null, Controls: () => null, SceneContent: () => null,
    Export: () => <button>Export</button>,
  };
  return { PRODUCT_REGISTRY: [product], getProduct: (id: string) => id === 'cake' ? product : undefined };
});
vi.mock('./scene/StudioCanvas', () => ({ StudioCanvas: ({ actions }: { actions: React.ReactNode }) => <div data-testid="view-actions">{actions}</div> }));
vi.mock('./ui/DesignHistory', () => ({
  DesignHistoryProvider: ({ children }: { children: React.ReactNode }) => children,
  HistoryButtons: () => null,
}));

let container: HTMLDivElement;
let root: Root;
function button(label: string) {
  return [...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === label)!;
}
function enterEditor() {
  act(() => useAppStore.getState().selectProduct('cake'));
}
function editProject() {
  project.snapshot.mockReturnValue({ name: 'My cake', design: { text: 'Edited' } });
}
function click(label: string) {
  act(() => button(label).click());
}
function leaveDialog() {
  return container.querySelector('dialog')!;
}

beforeEach(() => {
  vi.clearAllMocks();
  project.snapshot.mockReturnValue({ name: 'My cake', design: { text: 'Hello' } });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
  useAppStore.getState().clearProduct();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<App />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('project navigation', () => {
  it('opens a project from the start page directly into its editor', async () => {
    expect(button('Open project')).toBeDefined();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([], 'cake.json');
    Object.defineProperty(file, 'text', { value: async () => serializeProject('cake', { text: 'Loaded' }) });
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    expect(project.load).toHaveBeenCalledWith({ text: 'Loaded' });
    expect(useAppStore.getState().selectedProductId).toBe('cake');
    expect(button('Open project')).toBeUndefined();
    expect(history.clear).toHaveBeenCalledOnce();
    const actions = container.querySelector('[data-testid="view-actions"]')!;
    expect([...actions.querySelectorAll('button')].map((element) => element.textContent?.trim())).toEqual(['Save project', 'Export']);
    click('Save project');
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'my-cake.json');
  });

  it('shows invalid-file errors without entering the editor', async () => {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [{ text: async () => 'invalid' }] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("isn't valid JSON");
    expect(project.load).not.toHaveBeenCalled();
    expect(useAppStore.getState().selectedProductId).toBeNull();
  });

  it('lets users cancel leaving or leave without downloading', () => {
    enterEditor();
    editProject();
    click('All products');
    expect(leaveDialog().open).toBe(true);
    click('Cancel');
    expect(leaveDialog().open).toBe(false);
    expect(useAppStore.getState().selectedProductId).toBe('cake');
    click('All products');
    click('Leave without saving');
    expect(useAppStore.getState().selectedProductId).toBeNull();
    expect(saveAs).not.toHaveBeenCalled();
  });

  it('downloads the project before leaving and keeps the editor open if saving fails', () => {
    enterEditor();
    editProject();
    click('All products');
    vi.mocked(saveAs).mockImplementationOnce(() => { throw new Error('Download failed'); });
    click('Save and leave');
    expect(useAppStore.getState().selectedProductId).toBe('cake');
    expect(leaveDialog().open).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("couldn't be saved");
    click('Save and leave');
    expect(saveAs).toHaveBeenLastCalledWith(expect.any(Blob), 'my-cake.json');
    expect(useAppStore.getState().selectedProductId).toBeNull();
  });

  it('leaves a newly started or saved design without prompting', () => {
    enterEditor();
    expect(history.clear).toHaveBeenCalledOnce();
    click('All products');
    expect(useAppStore.getState().selectedProductId).toBeNull();
    enterEditor();
    editProject();
    click('Save project');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    click('All products');
    expect(useAppStore.getState().selectedProductId).toBeNull();
  });

  it('prompts again after editing a saved design', () => {
    enterEditor();
    click('Save project');
    editProject();
    click('All products');
    expect(leaveDialog().open).toBe(true);
  });

  it('guards tab navigation only while the editor is mounted', () => {
    enterEditor();
    editProject();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    click('All products');
    click('Leave without saving');
    const nextEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(nextEvent);
    expect(nextEvent.defaultPrevented).toBe(false);
  });
});
