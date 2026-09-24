#!/usr/bin/env node
// One-time/occasionally-rerun maintainer script — NOT part of the app build or
// runtime. Generates src/fonts/googleFontsCatalog.json: every Google Fonts
// family (minus the 5 already hand-curated in src/fonts/registry.ts) with a
// direct fonts.gstatic.com .ttf URL for its regular/400 static instance.
//
// Two public Google endpoints, neither requiring an API key:
//   - fonts.google.com/metadata/fonts: family list + category + popularity.
//   - fonts.googleapis.com/css?family=A|B|C (the *legacy* v1 API, not css2):
//     given an old-browser User-Agent, always resolves to a single static
//     .ttf per family (even for variable-font families), unlike the modern
//     css2 API which serves woff2 (opentype.js can't parse woff2) and can
//     resolve a variable font's "default instance" to an unexpected weight.
//
// Run with: npm run fonts:catalog

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const METADATA_URL = 'https://fonts.google.com/metadata/fonts';
const LEGACY_CSS_URL = 'https://fonts.googleapis.com/css';
const OLD_BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.34 (KHTML, like Gecko)';
const OUTPUT_PATH = fileURLToPath(new URL('../src/fonts/googleFontsCatalog.json', import.meta.url));

// Keep in sync with the curated entries in src/fonts/registry.ts.
const CURATED_FAMILIES = new Set(['Dancing Script', 'Allura', 'Pacifico', 'Parisienne', 'Sacramento']);

const CATEGORY_MAP = {
  'Sans Serif': 'sans-serif',
  Serif: 'serif',
  Display: 'display',
  Handwriting: 'handwriting',
  Monospace: 'monospace',
};

const CHUNK_SIZE = 50;
const CHUNK_DELAY_MS = 150;

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFamilyList() {
  const response = await fetch(METADATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch font metadata: ${response.status} ${response.statusText}`);
  }
  const text = (await response.text()).replace(/^\)\]\}'\n?/, '');
  const data = JSON.parse(text);
  return data.familyMetadataList
    .filter((f) => !CURATED_FAMILIES.has(f.family))
    .map((f) => ({ family: f.family, category: CATEGORY_MAP[f.category], popularity: f.popularity }));
}

/** One legacy-CSS batch request -> Map<family, ttfUrl>. */
async function fetchTtfUrls(families) {
  const query = families.map(encodeURIComponent).join('|');
  const response = await fetch(`${LEGACY_CSS_URL}?family=${query}`, { headers: { 'User-Agent': OLD_BROWSER_USER_AGENT } });
  if (!response.ok) {
    console.warn(`  batch request failed (${response.status}) for: ${families.join(', ')}`);
    return new Map();
  }
  const css = await response.text();
  const urls = new Map();
  for (const block of css.split('@font-face').slice(1)) {
    const familyMatch = block.match(/font-family:\s*'([^']+)'/);
    const urlMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.ttf)\)/);
    if (familyMatch && urlMatch && !urls.has(familyMatch[1])) {
      urls.set(familyMatch[1], urlMatch[1]);
    }
  }
  return urls;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  console.log('Fetching Google Fonts family metadata...');
  const families = await fetchFamilyList();
  console.log(`${families.length} families to resolve (curated ones excluded).`);

  const catalog = [];
  const chunks = chunk(families, CHUNK_SIZE);
  for (let i = 0; i < chunks.length; i++) {
    const batch = chunks[i];
    process.stdout.write(`\rResolving TTF URLs: batch ${i + 1}/${chunks.length}`);
    const urls = await fetchTtfUrls(batch.map((f) => f.family));
    for (const f of batch) {
      const url = urls.get(f.family);
      if (!url) {
        console.warn(`\n  no TTF resolved for "${f.family}", skipping`);
        continue;
      }
      catalog.push({ id: slugify(f.family), family: f.family, category: f.category, popularity: f.popularity, url });
    }
    if (i < chunks.length - 1) await sleep(CHUNK_DELAY_MS);
  }
  console.log(`\nResolved ${catalog.length}/${families.length} families.`);

  catalog.sort((a, b) => a.popularity - b.popularity);
  await writeFile(OUTPUT_PATH, JSON.stringify(catalog), 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
