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

// Memoized because the emoji set reads the same file twice — once for names,
// once for the groups those names are filed under.
const fetched = new Map();
async function fetchText(url) {
  if (!fetched.has(url)) {
    fetched.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        }
        return response.text();
      }),
    );
  }
  return fetched.get(url);
}

/** Lower case, words joined by underscores — the shape every icon name and keyword is stored in, so a search can compare them directly. */
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
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

/**
 * What else each icon is called, so a search can find a thing by what it is
 * rather than by the word its publisher happened to file it under.
 *
 * Each returns a function from one catalogue entry to its words. All three
 * publish this; none of them publishes it in the same shape, and none of it is
 * in the font.
 */

/** Google ships both with the names: one category and a handful of synonyms per icon. */
async function materialKeywords() {
  // The metadata is JSONP-flavoured — a `)]}'` guard line before the JSON.
  const raw = await fetchText('https://fonts.google.com/metadata/icons');
  const metadata = JSON.parse(raw.replace(/^\)]\}'\n?/, ''));
  const byName = new Map(metadata.icons.map((icon) => [icon.name, [...(icon.categories ?? []), ...(icon.tags ?? [])]]));
  return (entry) => byName.get(entry.name) ?? [];
}

/** Phosphor keeps its categories and tags in the source of its core package, as a TypeScript literal. */
async function phosphorKeywords() {
  const source = await fetchText('https://raw.githubusercontent.com/phosphor-icons/core/main/src/icons.ts');
  const byName = new Map(
    [...source.matchAll(/name:\s*"([^"]+)",[\s\S]*?categories:\s*\[([^\]]*)\][\s\S]*?tags:\s*\[([^\]]*)\]/g)].map((match) => [
      match[1].replace(/-/g, '_'),
      [
        ...[...match[2].matchAll(/IconCategory\.([A-Z_]+)/g)].map((category) => category[1].toLowerCase()),
        // "*new*" marks a recent addition rather than describing the icon.
        ...[...match[3].matchAll(/"([^"]+)"/g)].map((tag) => tag[1]).filter((tag) => tag !== '*new*'),
      ],
    ]),
  );
  return (entry) => byName.get(entry.name) ?? [];
}

/**
 * Emoji get both halves of what Unicode knows: the group and subgroup each is
 * filed under (which is where "zodiac" comes from), and CLDR's own search
 * keywords, which are what people actually call the thing — "horoscope" and
 * "ram" for Aries.
 */
async function emojiKeywords() {
  const groups = new Map();
  let group = '';
  let subgroup = '';
  for (const line of (await fetchText('https://unicode.org/Public/emoji/latest/emoji-test.txt')).split('\n')) {
    const groupLine = /^# group: (.+)$/.exec(line);
    const subgroupLine = /^# subgroup: (.+)$/.exec(line);
    const entryLine = /^([0-9A-F ]+?)\s*;\s*fully-qualified\s*#\s*\S+\s+E[\d.]+\s+(.+)$/.exec(line.trim());
    if (groupLine) {
      group = groupLine[1];
    } else if (subgroupLine) {
      subgroup = subgroupLine[1];
    } else if (entryLine) {
      groups.set(slug(entryLine[2]), [...subgroup.split('-'), ...group.toLowerCase().split(/[^a-z]+/)].filter(Boolean));
    }
  }

  const annotations = new Map();
  const cldr = await fetchText('https://raw.githubusercontent.com/unicode-org/cldr/main/common/annotations/en.xml');
  // The `type="tts"` annotations are the spoken name, which is the name already.
  for (const match of cldr.matchAll(/<annotation cp="([^"]+)"(?! type)[^>]*>([^<]+)<\/annotation>/g)) {
    annotations.set(match[1].codePointAt(0), match[2].split('|').map((word) => word.trim()));
  }

  return (entry) => [...(groups.get(entry.name) ?? []), ...(annotations.get(entry.codepoint) ?? [])];
}

const SETS = [
  { id: 'material', font: asset('material-icons/MaterialIcons-Regular.ttf'), out: output('materialIconsCatalog.json'), names: materialNames, keywords: materialKeywords },
  { id: 'phosphor', font: asset('phosphor-fill/Phosphor-Fill.ttf'), out: output('phosphorCatalog.json'), names: phosphorNames, keywords: phosphorKeywords },
  { id: 'emoji', font: asset('noto-emoji/NotoEmoji-Regular.ttf'), out: output('notoEmojiCatalog.json'), names: emojiNames, keywords: emojiKeywords },
];

/** Keywords for every set, written as one file the app loads only when someone opens the picker — see icons/catalog.ts. */
const keywordsOut = {};

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

  const keywordsFor = await set.keywords();
  const words = {};
  let described = 0;
  for (const entry of drawable) {
    // A keyword the name already contains costs bytes and finds nothing new:
    // the name is searched first and more cheaply. Stored space-joined rather
    // than as an array, which is a third of the punctuation for the same words.
    const parts = new Set(entry.name.split('_'));
    const extra = [...new Set(keywordsFor(entry).map(slug).filter((word) => word && !parts.has(word) && !entry.name.includes(word)))];
    if (extra.length > 0) {
      words[entry.name] = extra.join(' ');
      described += 1;
    }
  }
  keywordsOut[set.id] = words;

  console.log(
    `${set.id}: ${drawable.length} icons written to ${set.out} (${declared.length - drawable.length} dropped as blank, missing or duplicate), ${described} with keywords`,
  );
}

const keywordsPath = output('iconKeywords.json');
await writeFile(keywordsPath, `${JSON.stringify(keywordsOut)}\n`);
console.log(`keywords written to ${keywordsPath}`);
