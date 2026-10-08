import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Use the exact downloaded catalog files for deterministic geometry tests.
// These fixtures are never imported by the browser application.
// Filesystem paths avoid Vite rewriting asset URLs to localhost in jsdom.
const fixtureRoot = resolve(process.cwd(), 'src/test-setup/fonts');
const catalog = JSON.parse(readFileSync(resolve(process.cwd(), 'src/fonts/googleFontsCatalog.json'), 'utf8')) as { id: string; url: string }[];
const paths = new Map<string, string>();
for (const id of readdirSync(fixtureRoot)) {
  const font = catalog.find((entry) => entry.id === id);
  const file = readdirSync(resolve(fixtureRoot, id)).find((name) => name.endsWith('.ttf'));
  if (!font || !file) throw new Error(`Missing font fixture metadata: ${id}`);
  paths.set(font.url, resolve(fixtureRoot, id, file));
}

export function fontFixturePath(url: string): string | undefined {
  return paths.get(url);
}
