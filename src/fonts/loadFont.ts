import { parse, type Font } from 'opentype.js';
import type { FontDefinition } from './types';
import { getFontDefinition } from './registry';

const cache = new Map<string, Promise<Font>>();

async function fetchAndParse(def: FontDefinition): Promise<Font> {
  const response = await fetch(def.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch font "${def.id}": ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  const font = parse(buffer);

  // Variable fonts: opentype.js's own "default instance" resolution isn't always
  // reliable (verified empirically — some fonts resolve to an unexpectedly light
  // weight), so pin the axis values explicitly whenever the registry specifies them.
  if (def.variationSettings && font.tables.fvar) {
    font.variation.set(def.variationSettings);
  }

  return font;
}

/** Loads and parses a font by registry id, caching the in-flight/parsed result. */
export async function loadFont(fontId: string): Promise<Font> {
  // Declared `async` (rather than returning the cached/created promise directly)
  // so an unknown-id lookup — which throws synchronously — becomes a rejected
  // promise like every other failure mode here, instead of throwing on the call
  // itself and breaking callers that use `.catch()` without `await`.
  let pending = cache.get(fontId);
  if (!pending) {
    const def = getFontDefinition(fontId);
    pending = fetchAndParse(def);
    cache.set(fontId, pending);
    // Don't cache a rejected load — allow retry on next call.
    pending.catch(() => cache.delete(fontId));
  }
  return pending;
}
