// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LicensePage } from './LicensePage';
import { LicenseLoader } from './LicenseLoader';
import type { LicenseCatalog } from './types';

const catalog: LicenseCatalog = {
  schemaVersion: 1,
  components: [
    { id: 'react', name: 'React', version: '19.2.8', category: 'App dependencies', license: 'MIT', sourceUrl: 'https://github.com/facebook/react', noticeIds: ['mit'] },
    { id: 'icon:test', name: 'Test Icons', category: 'Icons', license: 'OFL-1.1', sourceUrl: 'https://github.com/googlefonts/noto-emoji', noticeIds: ['ofl'] },
  ],
  notices: { mit: { text: 'Copyright React contributors\nMIT license terms <script>example</script>', source: 'React/LICENSE' }, ofl: { text: 'Open Font License terms', source: 'OFL.txt' } },
};
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('license page', () => {
  it('groups all text fonts under Fonts while retaining every distinct license notice', async () => {
    const fontCatalog: LicenseCatalog = {
      ...catalog,
      components: [
        ...catalog.components,
        ...['Remote Font A', 'Remote Font B', 'Remote Font C', 'Remote Font D'].map((name, index) => ({
          id: `google-font:${index}`, name, category: 'Fonts',
          license: index < 2 ? 'OFL-1.1' : index === 2 ? 'Apache-2.0' : 'Ubuntu-font-1.0',
          sourceUrl: 'https://fonts.google.com/', noticeIds: [index < 2 ? 'ofl' : index === 2 ? 'apache' : 'ubuntu'],
        })),
      ],
      notices: { ...catalog.notices, apache: { text: 'Apache license terms', source: 'Apache-2.0' }, ubuntu: { text: 'Ubuntu font license terms', source: 'Ubuntu-font-1.0' } },
    };
    act(() => root.render(<LicensePage catalog={fontCatalog} downloadUrl="/inventory.json" />));
    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(container.textContent).toContain('Test Icons');
    expect(container.textContent).not.toContain('Remote Font A');
    expect(container.querySelector('[role="status"]')!.textContent).toContain('3 matching entries · 3 total');
    const select = container.querySelector('select')!;
    expect([...select.options].map((option) => option.value)).toEqual(['All components', 'App dependencies', 'Fonts', 'Icons']);
    act(() => { select.value = 'Fonts'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.querySelectorAll('li')).toHaveLength(1);
    const group = container.querySelector('li')!;
    expect(group.querySelector('h2')!.textContent).toBe('Google Fonts ');
    expect(group.textContent).toContain('4 font families');
    for (const license of ['OFL-1.1', 'Apache-2.0', 'Ubuntu-font-1.0']) expect(group.textContent).toContain(license);
    expect(group.querySelector('a[download]')!.getAttribute('href')).toBe('/inventory.json');
    const details = group.querySelector('details')!;
    await act(async () => { details.open = true; details.dispatchEvent(new Event('toggle')); });
    expect(group.querySelectorAll('pre')).toHaveLength(3);
    expect(fontCatalog.components).toHaveLength(6);
  });

  it('filters by category and displays notices as plain text', async () => {
    act(() => root.render(<LicensePage catalog={catalog} downloadUrl="/inventory.json" />));
    const select = container.querySelector('select')!;
    act(() => { select.value = 'Icons'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('li')!.textContent).toContain('Test Icons');
    act(() => { select.value = 'All components'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    const details = container.querySelector('details')!;
    await act(async () => { details.open = true; details.dispatchEvent(new Event('toggle')); });
    expect(container.querySelector('pre')!.textContent).toContain('<script>example</script>');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('a[download]')!.getAttribute('href')).toBe('/inventory.json');
  });

  it('searches names and licenses, and explains empty results', () => {
    act(() => root.render(<LicensePage catalog={catalog} downloadUrl="/inventory.json" />));
    const input = container.querySelector('input')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    const search = (value: string) => act(() => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
    search('ofl-1.1');
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('li')!.textContent).toContain('Test Icons');
    search('REACT MIT');
    expect(container.querySelector('li')!.textContent).toContain('React');
    search('missing');
    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(container.textContent).toContain('No matching components');
  });

  it('recovers from a failed inventory request', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: async () => catalog });
    vi.stubGlobal('fetch', fetch);
    await act(async () => root.render(<LicenseLoader />));
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('could not be loaded');
    await act(async () => container.querySelector('button')!.click());
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
