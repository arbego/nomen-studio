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
import { NameDisplayWarnings } from './Warnings';
import { LidPreviewButton } from './LidPreviewButton';
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
      <div data-testid="controls"><NameDisplayControls /></div>
      <div data-testid="preview-warnings"><NameDisplayWarnings /></div>
      <LidPreviewButton />
      <NameDisplayExport />
    </NameDisplayProvider>,
  ));
  await waitForExport();
}

function checkbox(text: string): HTMLInputElement {
  return [...container.querySelectorAll('label')].find((label) => label.textContent?.includes(text))!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
}

function lidButton(label: string): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
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
  it('enables a cable hole without a movement toggle, adjusts its diameter, and resets placement', async () => {
    await mountEditor();
    act(() => checkbox('Hollow initial with lid').click());
    act(() => checkbox('Cable hole').click());
    await waitForExport();
    expect(useNameDisplayStore.getState().lidTransparent).toBe(true);
    expect(container.textContent).not.toContain('Move cable hole in preview');
    expect(container.textContent).toContain('Click the hole to highlight it, then drag it');
    expect(container.textContent).toContain('Hole diameter');
    const diameter = [...container.querySelectorAll('label')].find((label) => label.textContent?.includes('Hole diameter'))!.querySelector('input')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(diameter, '8');
      diameter.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(useNameDisplayStore.getState().cableHoleDiameterMm).toBe(8);
    const snapshot = selectNameDisplayConfig(useNameDisplayStore.getState());
    act(() => lidButton('Make lid opaque').click());
    expect(selectNameDisplayConfig(useNameDisplayStore.getState())).toEqual(snapshot);
    expect(snapshot).not.toHaveProperty('lidTransparent');
    act(() => useNameDisplayStore.getState().setConfig({ cableHolePlacement: { point: { x: 999, y: 999, z: 0 }, normal: { x: 0, y: 0, z: -1 } } }));
    const warnings = container.querySelector('[data-testid="preview-warnings"]')!;
    expect(warnings.querySelector('[role="status"]')?.textContent).toContain('does not open into the cavity');
    expect(container.querySelector('[data-testid="controls"]')!.textContent).not.toContain('does not open into the cavity');
    const reset = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Reset hole position')!;
    act(() => reset.click());
    expect(useNameDisplayStore.getState().cableHolePlacement).toBeNull();
    expect(warnings.textContent).not.toContain('does not open into the cavity');
  });

  it('toggles lid transparency outside the sidebar and exports all parts with their normal colors', async () => {
    await mountEditor();
    expect(lidButton('Make lid 90% transparent')).toBeNull();
    act(() => checkbox('Hollow initial with lid').click());
    await waitForExport();
    expect(useNameDisplayStore.getState().hollowEnabled).toBe(true);
    expect(container.textContent).toContain('Wall thickness');
    expect(container.textContent).toContain('Bowl color');
    expect(container.textContent).toContain('Lid color');
    const controls = container.querySelector('[data-testid="controls"]')!;
    expect(controls.textContent).not.toContain('Show lid in preview');
    expect(controls.querySelector('button[aria-label="Make lid 90% transparent"]')).toBeNull();
    const before = selectNameDisplayConfig(useNameDisplayStore.getState());
    act(() => lidButton('Make lid 90% transparent').click());
    expect(lidButton('Make lid opaque').getAttribute('aria-pressed')).toBe('true');
    expect(useNameDisplayStore.getState().lidTransparent).toBe(true);
    expect(selectNameDisplayConfig(useNameDisplayStore.getState())).toEqual(before);
    act(() => exportButton().click());
    const text = await blobText(vi.mocked(saveAs).mock.calls.at(-1)![0] as Blob);
    expect(text).toContain('value="L (bowl)"');
    expect(text).toContain('value="L (lid)"');
    expect(text).toContain('value="Liam (name)"');
    act(() => lidButton('Make lid opaque').click());
    expect(useNameDisplayStore.getState().lidTransparent).toBe(false);
    expect(lidButton('Make lid 90% transparent').getAttribute('aria-pressed')).toBe('false');
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
