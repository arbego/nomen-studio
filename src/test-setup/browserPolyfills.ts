import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// SVGLoader (used to turn glyph/accent-shape path data into THREE.Shapes) calls
// the browser-native DOMParser. The real app only ever runs in a browser where
// that's native; this polyfills it for the Node test environment only.
//
// Deliberately NOT polyfilling `document` here: @react-three/test-renderer
// branches on `typeof document` to decide whether to use its own headless
// scene-graph mode or set up a real WebGLRenderer against an actual <canvas> —
// a jsdom `document` is enough to trip it into the latter, which then fails
// since jsdom's canvas has no WebGL support. PickMesh guards its own
// `document.body.style.cursor` calls instead (see PickMesh.tsx).
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = new JSDOM('<!DOCTYPE html>').window.DOMParser;
}

// Font/shape assets are loaded via `fetch(new URL(...))` in the app so the same
// code works in the browser. Under Vitest (no dev server) those URLs resolve to
// real file:// paths (see loadFont.ts) — this stubs fetch to read from disk for
// file:// URLs and falls through to the real fetch for everything else.
const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('file://')) {
    const buffer = await readFile(fileURLToPath(url));
    return new Response(buffer, { status: 200 });
  }
  return realFetch(input, init);
}) as typeof fetch;
