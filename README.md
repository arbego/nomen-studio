# Name Studio

Design personalized 3D-printable lettering — preview it live in 3D and export
print-ready files. Pick a product on the landing screen, then design in that
product's studio. All fonts are free Google Fonts; the curated defaults are
self-hosted, and the full catalogue loads on demand.

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

Two maintainer scripts regenerate the generated catalogues, and are not part of
the build: `npm run fonts:catalog` (every Google Fonts family) and
`npm run icons:catalog` (every icon in the self-hosted Material Icons font).

## Products

- **Cake Topper** — a name on picks, to stand in a cake. One to three lines of
  script lettering, individually draggable letters, optional sticks and an
  optional solid backing card. Exports one 3MF, the lettering and its backing
  card as two colored parts.
- **Name Display** — a big background initial with a script name stamped into
  its front face. The name is a real inlay: the initial gets a pocket milled
  where the name overlaps it, so the two pieces lock together. Drag the name to
  move it or tilt it to an angle, and the pocket follows. Decorators — icons
  from the full Material Icons set — can be added alongside it and inlaid the
  same way, each with its own width, thickness and place on the letter. Exports
  one 3MF holding every piece as a separate, named, colored object, already
  fitted together — see below for why not an STL.

## Architecture

Everything outside `src/products/` is shared, product-agnostic core. A product
owns only its own config, store, geometry, controls panel and scene content.

```
src/
  fonts/      font registry + the generated Google Fonts catalogue
  icons/      the Material Icons catalogue, and an icon as a buildable solid
  geometry/   framework-agnostic, millimeter-accurate solid generation
  scene/      the shared 3D preview, its draggable meshes and its ground
  export/     3MF bytes (and the minimal zip writer a 3MF needs)
  ui/         the shell, the product picker, and the generic controls
  products/
    registry.ts     every product, in picker order
    cakeTopper/
    nameDisplay/
```

### Adding a product

Create `src/products/<id>/` with its own `config.ts`, `store.ts`, `geometry.ts`,
`Controls.tsx` and `SceneContent.tsx` — the two existing products are the
template — and add one entry to `products/registry.ts`. Nothing else in the app
changes. A `ProductDefinition` exposes only what the shell has to mount, so the
shell never knows a product's shape. (Same pattern as `fonts/registry.ts`: add a
font by dropping its `.ttf` + `OFL.txt` under `src/assets/fonts/<id>/` and adding
one registry entry.)

Because a product's controls and its scene are mounted in separate subtrees
(sidebar and canvas), anything they share — above all the one async geometry
build that feeds both — goes in the definition's optional `Provider`.

### The preview

Every product is designed in the same canvas (`scene/StudioCanvas.tsx`). The
design is centered and stood on the ground by `GroundCenter` — not drei's
`Center`, which measures once and so loses the race against the asynchronous font
build. Under it, `GroundGrid` rules the floor in real millimeters (10mm cells,
50mm sections), and the coin button in the corner lays a true-to-size 2 € coin
beside the design (`ScaleReference`), because millimeters on a slider don't tell
you how big the print will be. Both are scenery, rendered so that the grid never
drags the camera's auto-fit away from the design.

### How the geometry works

- **Text** (`geometry/textGeometry.ts`): glyphs are parsed with `opentype.js` and
  laid out one letter at a time, so each letter's position stays individually
  adjustable without re-running font extrusion. A block is sized by either its
  width or its height (`ExtrudeFit`) — a word by width, a single large initial by
  height.
- **Extrusion** (`geometry/extrudeToMm.ts`): outlines become `THREE.Shape`s
  (reusing Three.js's own `SVGLoader` for correct hole detection), extruded to
  real millimeters and anchored at bottom-center.
- **2D booleans** (`geometry/clipper.ts`): intersect, subtract and grow, over
  Clipper. Every piece here is a planar prism, so booleans in 2D followed by
  re-extrusion are both simpler and more exact than 3D CSG. Regions use the
  non-zero fill rule with normalized orientation, because script fonts routinely
  overlap adjacent letters and even-odd would cancel the shared area away.
- **Icons as solids** (`icons/`): an icon is a glyph, so the icon face is
  registered as a font and `buildIconBlock` runs an icon through the same text
  pipeline a letter goes through — outlines, holes, millimeter scaling,
  extrusion, and the contours a pocket boolean needs. The set is the static
  Material Icons face (Apache 2.0), self-hosted: it is filled rather than
  outlined, which is what survives a printer, and static rather than variable,
  which is what opentype.js reads reliably. Icons are addressed by codepoint
  from a generated catalogue, since reading ligatures back out of GSUB is far
  more work for the same answer.
- **Standing** (`geometry/baseGeometry.ts`): three ways to make a piece stand —
  nothing, a base rail, or a flat cut at the typographic baseline. A product
  applies it only to the pieces that actually stand: on a name display that is
  the initial alone, since the name is held by the pocket it drops into.
- **Outline card** (`geometry/outline.ts`): polygon offsetting that grows a solid
  backing under the lettering, merging nearby disconnected pieces as it grows.
- **File format** (`export/`): every product exports 3MF, never STL. These
  designs are printed in more than one filament, and STL has no notion of a part
  or a color; splitting one in a slicer splits by connected shell, which on a
  pocketed name display means the back slab, every island the pocket cut the
  front slab into, and every letter — a dozen-odd pieces rather than the two
  anyone meant. A 3MF names its parts, colors them, and keeps them fitted
  together. A product supplies its pieces as `ThreeMfObject`s and the rest is
  shared: `threeMfExport.ts` writes the package, with the pieces as components
  of one object (separate top-level objects make a slicer ask whether they
  belong together) plus `Metadata/model_settings.config`, where
  PrusaSlicer-derived slicers read part names and filament assignments. A 3MF is
  an OPC package, so `export/zip.ts` writes one with stored (undeflated)
  entries; that is the whole dependency.
- **Merging** (`geometry/combine.ts`): a plain buffer merge, not a CSG union —
  every part is already watertight with real volumetric overlap where parts meet,
  which slicers handle correctly.

## Tests

`npm test` runs the full pipeline against the real font files (not mocks), plus
React Three Fiber scene-wiring tests via `@react-three/test-renderer`.
