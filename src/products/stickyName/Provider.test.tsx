// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StickyNameProvider } from './Provider';
import { useStickyNameGeometry } from './geometryContext';
import { buildStickyNameGeometry, disposeStickyNameGeometry, type StickyNameGeometry } from './geometry';
import { useStickyNameStore } from './store';

vi.mock('./geometry', () => ({ buildStickyNameGeometry: vi.fn(), disposeStickyNameGeometry: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
const pending: ((result: StickyNameGeometry) => void)[] = [];
const result = (): StickyNameGeometry => ({ letters: [], warnings: [], canExport: true });

function Status() {
  const state = useStickyNameGeometry();
  return <output>{state.loading ? 'loading' : state.error ?? (state.result?.canExport ? 'ready' : 'empty')}</output>;
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  vi.clearAllMocks();
  pending.length = 0;
  useStickyNameStore.getState().reset();
  vi.mocked(buildStickyNameGeometry).mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  container = document.createElement('div');
  root = createRoot(container);
  act(() => root.render(<StickyNameProvider><Status /></StickyNameProvider>));
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('disables stale exports immediately, debounces changes, and disposes superseded results', async () => {
  await act(async () => { vi.advanceTimersByTime(161); });
  expect(pending).toHaveLength(1);
  const old = result();
  await act(async () => { pending[0](old); });
  expect(container.textContent).toBe('ready');
  act(() => useStickyNameStore.getState().setConfig({ depthMm: 15 }));
  expect(container.textContent).toBe('loading');
  expect(disposeStickyNameGeometry).toHaveBeenCalledWith(old);
  act(() => useStickyNameStore.getState().setConfig({ depthMm: 16 }));
  await act(async () => { vi.advanceTimersByTime(161); });
  expect(pending).toHaveLength(2);
  const latest = result();
  await act(async () => { pending[1](latest); });
  expect(container.textContent).toBe('ready');
  act(() => useStickyNameStore.getState().setConfig({ previewColor: '#123456' }));
  await act(async () => { vi.advanceTimersByTime(161); });
  expect(pending).toHaveLength(2);
});

it('aborts old requests and cannot publish a late result over the newest design', async () => {
  await act(async () => { vi.advanceTimersByTime(161); });
  const signal = vi.mocked(buildStickyNameGeometry).mock.calls[0][1]!;
  act(() => useStickyNameStore.getState().setConfig({ name: 'ANNA' }));
  expect(signal.aborted).toBe(true);
  await act(async () => { vi.advanceTimersByTime(161); });
  const stale = result();
  await act(async () => { pending[0](stale); });
  expect(container.textContent).toBe('loading');
  expect(disposeStickyNameGeometry).toHaveBeenCalledWith(stale);
  await act(async () => { pending[1](result()); });
  expect(container.textContent).toBe('ready');
});
