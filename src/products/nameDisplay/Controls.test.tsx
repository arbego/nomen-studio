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
import { useNameDisplayStore } from './store';

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

describe('optional name in the editor', () => {
  it.each(['', '   '])('can clear the name, export, and type a new name (%j)', async (name) => {
    await act(async () => root.render(
      <NameDisplayProvider>
        <NameDisplayControls />
        <NameDisplayExport />
      </NameDisplayProvider>,
    ));
    await waitForExport();
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
