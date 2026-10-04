#!/usr/bin/env node
// One-time/occasionally-rerun maintainer script — NOT part of the app build or
// runtime. Generates one catalogue per icon set under src/icons/: every icon in
// the self-hosted font, as a name the picker can search and the codepoint its
// glyph lives at.
//
// None of the three fonts carries its own names: a font addresses glyphs by
// codepoint (and sometimes by ligature, which is far more work to read back out
// of GSUB than reading a published list). So each set names its glyphs from the
// list its publisher ships, and every entry is then checked against the actual
// font file in the repo — a name whose glyph is missing, or whose glyph has no
// outline, is dropped, so the picker can never offer an icon that would come out
// blank or extrude to nothing.
//
// Run with: npm run icons:catalog

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const asset = (path) => fileURLToPath(new URL(`../src/assets/icons/${path}`, import.meta.url));
const output = (name) => fileURLToPath(new URL(`../src/icons/${name}`, import.meta.url));

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/** Google publishes the Material names as a two-column "<name> <hex>" file. */
async function materialNames() {
  const text = await fetchText('https://raw.githubusercontent.com/google/material-design-icons/master/font/MaterialIcons-Regular.codepoints');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, hex] = line.split(' ');
      return { name, codepoint: Number.parseInt(hex, 16) };
    });
}

/**
 * Phosphor's names come from the stylesheet shipped beside the font, which is
 * the mapping its own web package uses: `.ph-fill.ph-cat:before { content: "\e18c" }`.
 */
async function phosphorNames() {
  const css = await fetchText('https://raw.githubusercontent.com/phosphor-icons/web/master/src/fill/style.css');
  return [...css.matchAll(/\.ph-fill\.ph-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"/g)].map((match) => ({
    // Hyphens to underscores so every set's names read and search alike.
    name: match[1].replace(/-/g, '_'),
    codepoint: Number.parseInt(match[2], 16),
  }));
}

/**
 * Emoji are named by Unicode itself, in the file that defines the set.
 *
 * Only single-codepoint, fully-qualified emoji are taken: the monochrome font
 * has no ZWJ sequences (a "family" or a flag is several codepoints joined), and
 * a sequence would render as its pieces side by side rather than as the thing
 * it names.
 */
async function emojiNames() {
  const text = await fetchText('https://unicode.org/Public/emoji/latest/emoji-test.txt');
  const entries = [];
  for (const line of text.split('\n')) {
    const match = /^([0-9A-F ]+?)\s*;\s*fully-qualified\s*#\s*\S+\s+E[\d.]+\s+(.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const codepoints = match[1].trim().split(/\s+/);
    if (codepoints.length !== 1) {
      continue;
    }
    entries.push({
      name: match[2].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      codepoint: Number.parseInt(codepoints[0], 16),
    });
  }
  return entries;
}

const SETS = [
  { id: 'material', font: asset('material-icons/MaterialIcons-Regular.ttf'), out: output('materialIconsCatalog.json'), names: materialNames },
  { id: 'phosphor', font: asset('phosphor-fill/Phosphor-Fill.ttf'), out: output('phosphorCatalog.json'), names: phosphorNames },
  { id: 'emoji', font: asset('noto-emoji/NotoEmoji-Regular.ttf'), out: output('notoEmojiCatalog.json'), names: emojiNames },
];

for (const set of SETS) {
  const font = opentype.parse((await readFile(set.font)).buffer);
  const declared = await set.names();

  const seen = new Set();
  const drawable = [];
  for (const entry of declared) {
    if (!entry.name || !Number.isFinite(entry.codepoint) || seen.has(entry.name)) {
      continue;
    }
    const glyph = font.charToGlyph(String.fromCodePoint(entry.codepoint));
    // .notdef is index 0; an outline-less glyph would extrude to nothing.
    if (glyph.index > 0 && glyph.getPath(0, 0, 100).commands.length > 0) {
      seen.add(entry.name);
      drawable.push(entry);
    }
  }

  drawable.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(set.out, `${JSON.stringify(drawable)}\n`);
  console.log(`${set.id}: ${drawable.length} icons written to ${set.out} (${declared.length - drawable.length} dropped as blank, missing or duplicate)`);
}
