import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { LicenseCatalog } from './types';
import { verifyBrowserLicenses } from '../../scripts/browser-license-packages.mjs';
import { fileURLToPath } from 'node:url';

const catalog: LicenseCatalog & { bundledPackages: string[] } = JSON.parse(readFileSync(new URL('../../licenses/open-source-licenses.json', import.meta.url), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'));

describe('open-source inventory', () => {
  it('covers shipped packages at their locked versions and excludes development and native tooling', () => {
    const packages = catalog.components.filter((entry) => entry.id.startsWith('node_modules/'));
    expect(packages.map((entry) => entry.id).sort()).toEqual(catalog.bundledPackages);
    expect(packages.length).toBeGreaterThan(0);
    for (const entry of packages) {
      expect(entry.version).toBe(lock.packages[entry.id].version);
      expect(entry.license).toBeTruthy();
    }
    expect(packages.some((entry) => /(?:sharp|libvips|vite|vitest|typescript|oxlint)/.test(entry.name))).toBe(false);
    expect(catalog.components.some((entry) => entry.category === 'Development tools' || entry.category === 'Native tooling libraries')).toBe(false);
    expect(packages.find((entry) => entry.name === 'clipper-lib')?.license).toBe('BSL-1.0');
    expect(packages.some((entry) => entry.name === 'webgl-constants')).toBe(false);
  });

  it('covers all selectable fonts and resolves every notice', () => {
    const fonts = JSON.parse(readFileSync(new URL('../fonts/googleFontsCatalog.json', import.meta.url), 'utf8')) as { id: string }[];
    const ids = new Set(catalog.components.map((entry) => entry.id));
    for (const font of fonts) expect(ids.has(`font:${font.id}`) || ids.has(`google-font:${font.id}`)).toBe(true);
    expect(catalog.components.filter((entry) => entry.category === 'Bundled fonts')).toHaveLength(7);
    for (const entry of catalog.components) {
      expect(entry.sourceUrl).toMatch(/^https:\/\//);
      for (const id of entry.noticeIds) expect(catalog.notices[id]?.text.trim()).toBeTruthy();
    }
    for (const icon of ['material-icons', 'phosphor-fill', 'noto-emoji']) expect(ids.has(`icon:${icon}`)).toBe(true);
    expect(ids.has('data:cldr')).toBe(true);
    expect(ids.has('data:jsbn')).toBe(true);
  });

  it('matches the checked-in dependencies and asset catalogs', () => {
    expect(() => execFileSync(process.execPath, ['scripts/generate-license-catalog.mjs', '--check'], { cwd: new URL('../../', import.meta.url) })).not.toThrow();
  });

  it('rejects production bundles whose dependencies have changed', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
    const plugin = verifyBrowserLicenses(root);
    plugin.configResolved({ build: { write: true } });
    const modules = Object.fromEntries(catalog.bundledPackages.map((path) => [`${root}/${path}/index.js`, { renderedLength: 10 }]));
    expect(() => plugin.generateBundle({}, { 'app.js': { type: 'chunk', modules } })).not.toThrow();
    modules[`${root}/node_modules/new-browser-library/index.js`] = { renderedLength: 10 };
    expect(() => plugin.generateBundle({}, { 'app.js': { type: 'chunk', modules } })).toThrow('Browser dependencies changed');
    plugin.configResolved({ build: { write: false } });
    expect(() => plugin.generateBundle({}, { 'app.js': { type: 'chunk', modules } })).not.toThrow();
  });
});
