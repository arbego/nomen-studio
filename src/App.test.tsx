// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAs } from 'file-saver';
import App from './App';
import { useAppStore } from './store/appStore';
import { serializeProject } from './project/projectFile';

const history = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    clear: vi.fn(), listeners,
    subscribeDesign: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
});
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
vi.mock('./scene/StudioCanvas', () => ({
  StudioCanvas: ({ actions, historyActions, tips }: { actions: React.ReactNode; historyActions: React.ReactNode; tips: React.ReactNode }) => (
    <div><div data-testid="view-actions">{actions}</div><div data-testid="history-actions">{historyActions}</div>{tips}</div>
  ),
}));
vi.mock('./ui/DesignHistory', () => ({
  DesignHistoryProvider: ({ children }: { children: React.ReactNode }) => children,
  HistoryButtons: () => <><button aria-label="Undo">Undo</button><button aria-label="Redo">Redo</button></>,
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
  act(() => {
    project.snapshot.mockReturnValue({ name: 'My cake', design: { text: 'Edited' } });
    history.listeners.forEach((listener) => listener());
  });
}
async function click(label: string) {
  await act(async () => button(label).click());
}
function leaveDialog() {
  return container.querySelector('dialog')!;
}

beforeEach(() => {
  vi.clearAllMocks();
  project.snapshot.mockReturnValue({ name: 'My cake', design: { text: 'Hello' } });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(window, 'prompt').mockImplementation((_message, suggestedName) => suggestedName ?? null);
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
    expect(button('Save project').disabled).toBe(true);
    editProject();
    expect(button('Save project').disabled).toBe(false);
    await click('Save project');
    expect(button('Save project').disabled).toBe(true);
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'my-cake.json');
  });

  it('places the manual tip button before undo and shows a tip immediately', async () => {
    enterEditor();
    expect([...container.querySelectorAll('[data-testid="history-actions"] button')].map((element) => element.getAttribute('aria-label'))).toEqual(['Show a tip', 'Undo', 'Redo']);
    const tipButton = container.querySelector<HTMLButtonElement>('[aria-label="Show a tip"]')!;
    await act(async () => tipButton.click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Did you know?');
    expect(container.querySelector('[aria-label="Dismiss tip"]')).not.toBeNull();
    expect(tipButton.getAttribute('aria-expanded')).toBe('true');
    expect(tipButton.className).toContain('text-orange-300');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Dismiss tip"]')!.click());
    expect(tipButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows invalid-file errors without entering the editor', async () => {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [{ text: async () => 'invalid' }] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("isn't valid JSON");
    expect(project.load).not.toHaveBeenCalled();
    expect(useAppStore.getState().selectedProductId).toBeNull();
  });

  it('lets users cancel leaving or leave without downloading', async () => {
    enterEditor();
    editProject();
    await click('All products');
    expect(leaveDialog().open).toBe(true);
    await click('Cancel');
    expect(leaveDialog().open).toBe(false);
    expect(useAppStore.getState().selectedProductId).toBe('cake');
    await click('All products');
    await click('Leave without saving');
    expect(useAppStore.getState().selectedProductId).toBeNull();
    expect(saveAs).not.toHaveBeenCalled();
  });

  it('downloads the project before leaving and keeps the editor open if saving fails', async () => {
    enterEditor();
    editProject();
    await click('All products');
    vi.mocked(saveAs).mockImplementationOnce(() => { throw new Error('Download failed'); });
    await click('Save and leave');
    expect(useAppStore.getState().selectedProductId).toBe('cake');
    expect(leaveDialog().open).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("couldn't be saved");
    await click('Save and leave');
    expect(saveAs).toHaveBeenLastCalledWith(expect.any(Blob), 'my-cake.json');
    expect(useAppStore.getState().selectedProductId).toBeNull();
  });

  it('leaves a newly started or saved design without prompting', async () => {
    enterEditor();
    expect(history.clear).toHaveBeenCalledOnce();
    await click('All products');
    expect(useAppStore.getState().selectedProductId).toBeNull();
    enterEditor();
    editProject();
    await click('Save project');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await click('All products');
    expect(useAppStore.getState().selectedProductId).toBeNull();
  });

  it('prompts again after editing a saved design', async () => {
    enterEditor();
    editProject();
    await click('Save project');
    act(() => {
      project.snapshot.mockReturnValue({ name: 'My cake', design: { text: 'Another edit' } });
      history.listeners.forEach((listener) => listener());
    });
    await click('All products');
    expect(leaveDialog().open).toBe(true);
  });

  it('keeps the editor open when the save filename prompt is canceled', async () => {
    enterEditor();
    editProject();
    await click('All products');
    vi.mocked(window.prompt).mockReturnValueOnce(null);
    await click('Save and leave');
    expect(useAppStore.getState().selectedProductId).toBe('cake');
    expect(leaveDialog().open).toBe(true);
    expect(saveAs).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('guards tab navigation only while the editor is mounted', async () => {
    enterEditor();
    editProject();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await click('All products');
    await click('Leave without saving');
    const nextEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(nextEvent);
    expect(nextEvent.defaultPrevented).toBe(false);
  });
});
