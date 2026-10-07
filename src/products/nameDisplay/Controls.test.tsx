// @vitest-environment jsdom
import { act } from 'react';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveAs } from 'file-saver';
import { usePanelStore } from '../../ui/panelStore';
import { NameDisplayControls } from './Controls';
import { NameDisplayExport } from './ExportAction';
import { NameDisplayProvider } from './Provider';
import { selectNameDisplayConfig, useNameDisplayStore } from './store';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // jsdom gives bundled assets localhost URLs, without a Vite server to serve them.
  vi.stubGlobal('fetch', async (input: string) => {
    const url = new URL(input);
    const path = url.protocol === 'file:' ? fileURLToPath(url) : `${process.cwd()}${url.pathname}`;
    return new Response(await readFile(path), { status: 200 });
  });
  vi.mocked(saveAs).mockClear();
  useNameDisplayStore.getState().reset();
  usePanelStore.getState().reset();
  usePanelStore.getState().setOpen('name', true);
  usePanelStore.getState().setOpen('hollow', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useNameDisplayStore.getState().reset();
  usePanelStore.getState().reset();
  vi.unstubAllGlobals();
});

function changeName(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[placeholder="Liam"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function exportButton() {
  return container.querySelector<HTMLButtonElement>('button[title="Export the design as a 3MF for your slicer"]')!;
}

async function waitForExport() {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(exportButton().disabled, container.textContent ?? '').toBe(false);
  });
}

async function mountEditor() {
  await act(async () => root.render(
    <NameDisplayProvider>
      <NameDisplayControls />
      <NameDisplayExport />
    </NameDisplayProvider>,
  ));
  await waitForExport();
}

function checkbox(text: string): HTMLInputElement {
  return [...container.querySelectorAll('label')].find((label) => label.textContent?.includes(text))!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
}

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('hollow initial in the editor', () => {
  it('enables a cable hole, adjusts its diameter, resets placement, and keeps editing out of the saved design', async () => {
    await mountEditor();
    act(() => checkbox('Hollow initial with lid').click());
    act(() => checkbox('Cable hole').click());
    await waitForExport();
    expect(useNameDisplayStore.getState().editingCableHole).toBe(true);
    expect(useNameDisplayStore.getState().showLid).toBe(false);
    expect(container.textContent).toContain('Hole diameter');
    const diameter = [...container.querySelectorAll('label')].find((label) => label.textContent?.includes('Hole diameter'))!.querySelector('input')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(diameter, '8');
      diameter.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(useNameDisplayStore.getState().cableHoleDiameterMm).toBe(8);
    const snapshot = selectNameDisplayConfig(useNameDisplayStore.getState());
    act(() => checkbox('Move cable hole in preview').click());
    expect(selectNameDisplayConfig(useNameDisplayStore.getState())).toEqual(snapshot);
    expect(snapshot).not.toHaveProperty('editingCableHole');
    act(() => useNameDisplayStore.getState().setConfig({ cableHolePlacement: { point: { x: 999, y: 999, z: 0 }, normal: { x: 0, y: 0, z: -1 } } }));
    expect(container.textContent).toContain('does not open into the cavity');
    const reset = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reset hole position')!;
    act(() => reset.click());
    expect(useNameDisplayStore.getState().cableHolePlacement).toBeNull();
    expect(container.textContent).not.toContain('does not open into the cavity');
  });

  it('enables the bowl and lid, exposes their controls, and exports the lid even when hidden', async () => {
    await mountEditor();
    act(() => checkbox('Hollow initial with lid').click());
    await waitForExport();
    expect(useNameDisplayStore.getState().hollowEnabled).toBe(true);
    expect(container.textContent).toContain('Wall thickness');
    expect(container.textContent).toContain('Bowl color');
    expect(container.textContent).toContain('Lid color');
    const before = selectNameDisplayConfig(useNameDisplayStore.getState());
    act(() => checkbox('Show lid in preview').click());
    expect(useNameDisplayStore.getState().showLid).toBe(false);
    expect(selectNameDisplayConfig(useNameDisplayStore.getState())).toEqual(before);
    act(() => exportButton().click());
    const text = await blobText(vi.mocked(saveAs).mock.calls.at(-1)![0] as Blob);
    expect(text).toContain('value="L (bowl)"');
    expect(text).toContain('value="L (lid)"');
    expect(text).toContain('value="Liam (name)"');
  });

  it('reports an unusably narrow cavity and recovers when hollowing is disabled', async () => {
    await mountEditor();
    act(() => useNameDisplayStore.getState().setConfig({ hollowEnabled: true, initial: 'I', initialFontId: 'dancing-script', initialHeightMm: 10, wallThicknessMm: 10 }));
    await vi.waitFor(async () => {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
      expect(container.textContent).toContain('no room for a hollow initial');
    });
    expect(exportButton().disabled).toBe(true);
    act(() => checkbox('Hollow initial with lid').click());
    await waitForExport();
    expect(container.textContent).not.toContain('no room for a hollow initial');
  });
});

describe('optional name in the editor', () => {
  it.each(['', '   '])('can clear the name, export, and type a new name (%j)', async (name) => {
    await mountEditor();
    expect(container.textContent).toContain('Name font');

    changeName(name);
    await waitForExport();
    expect(useNameDisplayStore.getState().name).toBe(name);
    expect(container.textContent).toContain('Leave empty');
    expect(container.textContent).not.toContain('Name font');
    act(() => exportButton().click());
    expect(saveAs).toHaveBeenLastCalledWith(expect.any(Blob), 'l-display.3mf');

    changeName('Mia');
    await waitForExport();
    expect(container.textContent).toContain('Name font');
    act(() => exportButton().click());
    expect(saveAs).toHaveBeenLastCalledWith(expect.any(Blob), 'mia-display.3mf');
  });
});
