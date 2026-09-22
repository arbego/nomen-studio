# Cake Topper Studio

Design personalized cake toppers — a name, an age number, and an accent shape,
each on its own printable pick — preview them live in 3D, and export print-ready
STL files. All fonts are free Google Fonts, self-hosted (no CDN calls).

## Getting started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm test` — run the test suite (geometry pipeline + scene wiring)
- `npm run lint` — lint the codebase

## How it works

- **Fonts** (`src/fonts/`): Google Font `.ttf` files are self-hosted under
  `src/assets/fonts/` and parsed at runtime with `opentype.js`. Add a font by
  dropping its `.ttf` (+ `OFL.txt`) in a new folder and adding one entry to
  `registry.ts`.
- **Accent shapes** (`src/shapes/`): authored as SVG path data. Add a shape by
  adding one entry to `registry.ts` — no rendering code changes needed.
- **Geometry** (`src/geometry/`): framework-agnostic, millimeter-accurate solid
  generation — glyph/shape outlines are converted to `THREE.Shape`s (reusing
  Three.js's own `SVGLoader` for correct hole detection), extruded, and merged
  with a stick into one printable pick.
- **Scene** (`src/scene/`): the live 3D preview, built with
  `@react-three/fiber` + `@react-three/drei`.
- **Export** (`src/export/`): STL generation (Three.js `STLExporter`) and
  zip packaging (`JSZip` + `file-saver`).

## Tests

`npm test` runs the full pipeline against all 8 real font files (not mocks),
plus React Three Fiber scene-wiring tests via `@react-three/test-renderer`.
