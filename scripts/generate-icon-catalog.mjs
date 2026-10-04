#!/usr/bin/env node
// One-time/occasionally-rerun maintainer script — NOT part of the app build or
// runtime. Generates src/icons/materialIconsCatalog.json: every icon in the
// self-hosted Material Icons font, as a name the picker can search and the
// codepoint its glyph lives at.
//
// The names come from Google's published codepoints file, which is the only
// place the mapping exists — the font itself addresses icons by codepoint and
// by ligature, and reading ligatures back out of GSUB is far more work than
// reading a two-column text file.
//
// Every entry is then checked against the actual font, so the picker can never
// offer an icon that would come out blank: a name whose glyph is missing, or
// whose glyph has no outline, is dropped.
//
// Run with: npm run icons:catalog

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const CODEPOINTS_URL = 'https://raw.githubusercontent.com/google/material-design-icons/master/font/MaterialIcons-Regular.codepoints';
const FONT_PATH = fileURLToPath(new URL('../src/assets/icons/material-icons/MaterialIcons-Regular.ttf', import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL('../src/icons/materialIconsCatalog.json', import.meta.url));

async function fetchCodepoints() {
  const response = await fetch(CODEPOINTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch codepoints: ${response.status} ${response.statusText}`);
  }
  return (await response.text())
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, hex] = line.split(' ');
      return { name, codepoint: Number.parseInt(hex, 16) };
    })
    .filter((entry) => entry.name && Number.isFinite(entry.codepoint));
}

const font = opentype.parse((await readFile(FONT_PATH)).buffer);
const declared = await fetchCodepoints();

const drawable = declared.filter(({ codepoint }) => {
  const glyph = font.charToGlyph(String.fromCodePoint(codepoint));
  // .notdef is index 0; an outline-less glyph would extrude to nothing.
  return glyph.index > 0 && glyph.getPath(0, 0, 100).commands.length > 0;
});

drawable.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(OUTPUT_PATH, `${JSON.stringify(drawable)}\n`);

console.log(`${drawable.length} icons written to ${OUTPUT_PATH} (${declared.length - drawable.length} dropped as blank or missing)`);
