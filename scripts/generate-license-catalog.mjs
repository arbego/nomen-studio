#!/usr/bin/env node
// Offline inventory: Vite identifies shipped packages, package-lock supplies
// versions, and installed packages supply license notices.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserPackagePaths } from './browser-license-packages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const output = 'licenses/open-source-licenses.json';
const inputFiles = [
  'package-lock.json', 'licenses/extra-components.json',
  'licenses/google-fonts-licenses.json', 'licenses/upstream-notices.json',
  'src/fonts/googleFontsCatalog.json', 'src/fonts/registry.ts',
  ...['materialIconsCatalog', 'phosphorCatalog', 'notoEmojiCatalog', 'iconKeywords'].map((name) => `src/icons/${name}.json`),
  ...readdirSync(resolve(root, 'src/assets/icons')).flatMap((name) =>
    readdirSync(resolve(root, `src/assets/icons/${name}`)).map((file) => `src/assets/icons/${name}/${file}`)),
  'scripts/generate-license-catalog.mjs',
  'scripts/browser-license-packages.mjs', 'vite.config.ts',
];
const inputs = Object.fromEntries(inputFiles.sort().map((path) => [path, hash(readFileSync(resolve(root, path)))]));
const previous = existsSync(resolve(root, output)) ? json(output) : null;
if (process.argv.includes('--check')) {
  if (!previous || JSON.stringify(previous.inputs) !== JSON.stringify(inputs)) {
    console.error('License inventory is stale. Run npm run licenses:catalog and review the updated JSON.');
    process.exit(1);
  }
  console.log('License inventory matches dependencies, catalogs, and notices.');
  process.exit(0);
}

const notices = {};
const components = [];
function notice(text, source) {
  const id = hash(text);
  notices[id] ??= { text, source };
  return id;
}
const upstream = json('licenses/upstream-notices.json');
function add(component, texts = []) {
  const noticeIds = texts.map(({ text, source }) => notice(text, source));
  for (const part of component.license.split(/\s+(?:AND|OR)\s+/)) {
    const standard = upstream[part.replace(/[()]/g, '')];
    if (standard) noticeIds.push(notice(standard.text, standard.sourceUrl));
  }
  components.push({ ...component, noticeIds: [...new Set(noticeIds)] });
}
function sourceUrl(metadata, fallback) {
  const repository = typeof metadata.repository === 'string' ? metadata.repository : metadata.repository?.url;
  let value = (repository || metadata.homepage || fallback)
    .replace(/^git\+/, '')
    .replace(/^github:/, 'https://github.com/')
    .replace(/^(?:ssh:\/\/)?git@([^/:]+)[:/]/, 'https://$1/')
    .replace(/^(?:git|http):\/\//, 'https://')
    .replace(/\.git$/, '');
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) value = `https://github.com/${value}`;
  return /^https:\/\//.test(value) ? value : fallback;
}
const lock = json('package-lock.json');
const { build } = await import('vite');
// Inspect production output in memory; leave dist untouched.
const buildResults = await build({ root, logLevel: 'silent', build: { write: false } });
const bundledPackages = [...new Set((Array.isArray(buildResults) ? buildResults : [buildResults])
  .flatMap((result) => browserPackagePaths(root, result.output)))].sort();
if (bundledPackages.length === 0) throw new Error('No browser packages found in the production bundle.');
const included = new Set(bundledPackages);
const direct = new Set(Object.keys(lock.packages[''].dependencies ?? {}));
for (const [path, info] of Object.entries(lock.packages)) {
  if (!included.has(path)) continue;
  const name = path.split('node_modules/').at(-1);
  const cached = previous?.components.find((entry) => entry.id === path && entry.version === info.version && entry.integrity === info.integrity);
  const installed = existsSync(resolve(root, path, 'package.json')) ? json(`${path}/package.json`) : {};
  const matches = installed.version === info.version;
  const texts = (cached?.noticeIds ?? []).map((id) => previous.notices[id]);
  if (matches) {
    for (const file of readdirSync(resolve(root, path))) {
      if (/^(licen[cs]e|notice|copying|copyright)([.\-_]|$)/i.test(file)) {
        try { texts.push({ text: read(`${path}/${file}`), source: `${name}@${info.version}/${file}` }); }
        catch { /* Some packages use a directory named LICENSE. */ }
      }
    }
  }
  // The Clipper header spells out Boost; webgl-constants' LICENSE is MIT.
  const license = name === 'clipper-lib' ? 'BSL-1.0' : name === 'webgl-constants' ? 'MIT' : info.license || installed.license;
  if (!license || typeof license !== 'string') throw new Error(`Review missing license for ${name}@${info.version}`);
  if (name === 'clipper-lib' && matches) {
    const header = read(`${path}/clipper.js`).split('var ClipperLib')[0];
    texts.push({ text: header, source: 'clipper-lib/clipper.js header' });
  }
  add({ id: path, name, version: info.version, license,
    category: 'App dependencies',
    direct: direct.has(name) && path === `node_modules/${name}`, optional: !!info.optional, integrity: info.integrity,
    sourceUrl: matches ? sourceUrl(installed, `https://www.npmjs.com/package/${name}/v/${info.version}`) : cached?.sourceUrl ?? `https://www.npmjs.com/package/${name}/v/${info.version}`,
  }, texts);
}

const extras = json('licenses/extra-components.json');
for (const { noticeFiles = [], noticeKeys = [], ...component } of extras) {
  add(component, [
    ...noticeFiles.map((path) => ({ text: read(path), source: path })),
    ...noticeKeys.map((key) => ({ text: upstream[key].text, source: upstream[key].sourceUrl })),
  ]);
}
const fontLicenses = json('licenses/google-fonts-licenses.json').families;
for (const font of json('src/fonts/googleFontsCatalog.json')) {
  const info = fontLicenses[font.id];
  if (!info) throw new Error(`Review and add license metadata for Google Font: ${font.family}`);
  add({ id: `google-font:${font.id}`, name: font.family, category: 'Fonts',
    license: info.license, sourceUrl: info.sourceUrl, assetUrl: font.url,
    description: 'Downloaded only when selected in the studio. See upstream for family-specific copyright notices.',
  }, info.notice ? [{ text: [info.copyright, info.notice].filter(Boolean).join('\n\n'), source: info.sourceUrl }] : []);
}
components.sort((a, b) => a.name.localeCompare(b.name, 'en') || (a.version ?? '').localeCompare(b.version ?? '', 'en'));
writeFileSync(resolve(root, output), `${JSON.stringify({ schemaVersion: 1, inputs, bundledPackages, components, notices }, null, 2)}\n`);
console.log(`Wrote ${components.length} components and ${Object.keys(notices).length} notices to ${output}`);
