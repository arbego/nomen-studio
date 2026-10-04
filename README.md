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
`npm run icons:catalog` (every icon in each of the three self-hosted icon fonts).

## Products

- **Cake Topper** — a name on picks, to stand in a cake. One to three lines of
  script lettering, individually draggable letters, optional sticks and an
  optional solid backing card. Exports one 3MF, the lettering and its backing
  card as two colored parts.
- **Name Display** — a big background initial with a script name stamped into
  its front face. The name is a real inlay: the initial gets a pocket milled
  where the name overlaps it, so the two pieces lock together. Drag the name to
  move it or tilt it to an angle, and the pocket follows. Decorators — icons
  from three libraries (plain Material symbols, solid Phosphor shapes, drawn
  Noto Emoji line art, star signs and baby things among them), or further words
  in a face of their own — can be added alongside it and inlaid the same way,
  each with its own width, thickness, angle, color and place on the letter. An
  icon is a glyph, so both kinds go down the one text pipeline. Exports one 3MF
  holding every piece as a separate, named, colored object, already fitted
  together — see below for why not an STL.

## Dark mode

The sun/moon in the corner switches it, and the choice is remembered. Until one
is made the studio follows the operating system and keeps following it live, so
the system flipping at sunset flips the studio too — but the moment you pick a
side, that is the side it stays on. `ui/theme.ts` puts a class on `<html>` when
the module is first imported, before anything renders, so the page is never
painted in the wrong theme first.

The 3D preview changes its backdrop and the ruling on its floor, but not its
lights: those exist to show what a filament will actually look like, and a design
whose colour shifted with the UI theme would be lying about the thing being
printed.

## Saving your work

Every studio has **Save project** and **Open project** in its header. A project
file is plain JSON — an envelope naming the format, its version and the product,
wrapping that product's config exactly as its store holds it — so it is readable,
diffable, and editable by hand if you want to.

Opening a file for a product you are not currently in switches you to its studio.
Every field is read back through a coercion against the defaults
(`project/coerce.ts`), which is what makes a file written by an older release
keep working: a field added since it was saved simply loads as its default, and
one that has been damaged falls back instead of reaching the geometry as a NaN.

## Architecture

Everything outside `src/products/` is shared, product-agnostic core. A product
owns only its own config, store, geometry, controls panel and scene content.

```
src/
  fonts/      font registry + the generated Google Fonts catalogue
  icons/      the three icon-set catalogues, and an icon as a buildable solid
  project/    saving and opening designs as .json project files
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
`Controls.tsx`, `SceneContent.tsx`, `ExportAction.tsx` (which pieces go in the
3MF) and `project.ts` (how its design is read back out of a file) — the two
existing products are the template — and add one entry
to `products/registry.ts`. Nothing else in the app
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

Clicking a piece of the design — rather than dragging it — scrolls the panel to
the control that shapes it and blinks that control (`ui/focusStore.ts`,
`ui/FocusTarget.tsx`). A letter points at its line's text field, a stick at the
sticks section, an ornament at its own card. The panel is long enough to scroll,
and pointing at a thing is a more direct way of asking "what changes this?" than
hunting for the section that owns it. Click and drag are told apart by how far
the pointer travelled in screen pixels (`scene/tapGesture.ts`) — not in the
model's millimeters, since the same wobble is a huge drag zoomed in and nothing
at all zoomed out — and the blink waits for the scroll to settle, so a long one
can't swallow it. Each product names its own targets in its `focus.ts`, which is
the one module its panel and its scene both import.

Pinned over the preview's top-right corner is the one Export button
(`ui/ExportButton.tsx`), the same control in every product. It lives here rather
than in the sidebar because it is the thing you came to do and it applies to the
whole design, not to any one section of the panel — and it is one button, not a
format menu, because every product exports 3MF and nothing else. A product
supplies only a thunk that builds the file (`ProductDefinition.Export`), since
writing out every triangle for a file nobody has asked for would cost more than
the preview itself.

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
- **Icons as solids** (`icons/`): an icon is a glyph, so each icon face is
  registered as a font and `buildIconBlock` runs an icon through the same text
  pipeline a letter goes through — outlines, holes, millimeter scaling,
  extrusion, and the contours a pocket boolean needs. Three sets are
  self-hosted, all of them static rather than variable faces, which is what
  opentype.js reads reliably:

  | Set | Face | License | What it is for |
  | --- | --- | --- | --- |
  | Material | Material Icons | Apache 2.0 | Plain symbols, and by far the widest vocabulary |
  | Phosphor | Phosphor Fill | MIT | Solid rounded shapes — the safest to print small |
  | Emoji | Noto Emoji (monochrome) | OFL 1.1 | Drawn line art: animals, flowers, star signs, baby things |

  An icon id is qualified by set (`emoji:aries`), since the same name is a
  different drawing in each; a bare name is read as a Material one, which is
  what every icon id was before there were sets. Icons are addressed by
  codepoint from generated catalogues, since reading ligatures back out of GSUB
  is far more work for the same answer — and no face carries its own names, so
  each catalogue names its glyphs from the list its publisher ships and then
  drops every entry whose glyph is missing or blank in the font actually in the
  repo. An emoji ornament starts out wider than the others (`IconSet.defaultWidthMm`):
  it is drawn rather than filled, and a stroke has to be wide enough to print.

  All three publishers also say what their icons are *about*, in three different
  shapes: Google ships categories and synonyms with the Material metadata,
  Phosphor keeps them in the source of its core package, and for emoji they come
  from the groups Unicode files each one under plus CLDR's own search keywords.
  The generator folds all of that into one `iconKeywords.json`, which is why
  searching "zodiac" finds the star signs and "kitten" finds the cat. It is
  bigger than all three catalogues together, so the picker imports it
  dynamically when it first opens and re-runs the search when it lands —
  nothing is in the startup bundle, exactly like the icon fonts. Keywords rank
  below every kind of name match, and match whole words only: hundreds of icons
  are tagged "communication", and matching those on "cat" would bury the cats.
- **Standing** (`geometry/baseGeometry.ts`): three ways to make a piece stand —
  nothing, a base rail, or a flat cut at the typographic baseline. A product
  applies it only to the pieces that actually stand: on a name display that is
  the initial alone, since the name is held by the pocket it drops into. A rail
  has a socket cut into it shaped like the piece that stands in it, so the two
  print separately and go together afterwards — same joint as the name's inlay,
  cut the same way and to the same fit clearance. It is three planar prisms
  stacked front to back rather than a 3D boolean: the socket is only as deep as
  the piece is thick, so the rail keeps unbroken front and back walls that
  locate the piece and leave its faces whole. Each piece is its own part in the
  exported 3MF, with its own color.
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
