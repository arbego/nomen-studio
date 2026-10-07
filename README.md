# Nomen Studio

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
  optional solid backing card. Icons can be dropped on alongside the lettering,
  each dragged where you want it in its own size, angle and filament — icons
  only, since a word belongs in the lettering, which already sets it in the
  piece's own face and at the piece's own scale. The backing card grows around
  them as it does around the letters, so one placed off the end of the word is
  still held; a gap inside a symbol is part of the drawing and always prints
  solid. Exports one 3MF: the lettering, the backing card, and an ornament per
  icon, each a named part in its own color. The sticks go in with whichever piece
  they are sunk into — the card when there is one, the lettering when there is
  not — rather than being a part of their own in a filament the card would have
  to be printed around.
- **Name Display** — a big background initial with a script name stamped into
  its front face. Leave the name field empty for an initial with optional
  decorators only. The name is a real inlay: the initial gets a pocket milled
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

## Editor tips

Short “Did you know?” messages occasionally appear above the preview controls.
They cover shortcuts, saving and exporting, and tips specific to the current
product. The first appears after 3 seconds, stays for 12 seconds, and is followed
by at least two minutes without a tip. Hints wait during typing, dragging,
scrolling, dialogs, and background tabs. Tips continue cycling throughout editing,
and the first tip appears again whenever an editor opens. The lightbulb button to
the left of Undo shows a fresh tip immediately and glows orange while a tip is visible.
Hovering pauses the dismissal timer; it resumes when the pointer leaves. The
close button dismisses the current message. There is no disable setting yet,
and tips do not write to browser storage.

The app uses no cookies. It remembers the chosen theme and last selected product
in `localStorage`; designs and undo history stay in memory until saved to a file.

## Saving your work

Every studio has **Undo** and **Redo** in its header. Use **Ctrl/Cmd+Z** to undo,
**Ctrl/Cmd+Shift+Z** to redo, or **Ctrl+Y** on Windows/Linux. Design text fields
use the same history as the preview; font and icon searches keep native text undo.
Each drag or slider gesture is one step, and typing is grouped until a short pause
or you leave the field. Adding/removing pieces and opening a project are undoable
too. A new edit after undo starts a new branch and clears redo.

The last 100 steps are kept separately for each product while the app is open,
including when you switch studios. History resets on page reload and is not
included in project files. Camera movement, theme and panel state are not design
edits.

Every studio has **Save project** and **Open project** in its header. A project
file is plain JSON — an envelope naming the format, its version and the product,
wrapping that product's config exactly as its store holds it — so it is readable,
diffable, and editable by hand if you want to.

Opening a file for a product you are not currently in switches you to its studio.
Every field is read back through a coercion against the defaults
(`project/coerce.ts`), which is what makes a file written by an older release
keep working: a field added since it was saved simply loads as its default, and
one that has been damaged falls back instead of reaching the geometry as a NaN.

**Share**, immediately to the right of **Save project**, creates a link to the
current design. Copy it from the dialog or use **Copy link**. The link contains
compact project JSON compressed with raw DEFLATE and encoded as URL-safe base64 in a
`#share=` fragment; no upload or server storage is involved. Opening it restores
the design and selects its product's studio, using the same validation and
defaults as opening a project file. A link captures a snapshot: later edits do
not change it. Sharing does not mark the project as saved. This uses the browser's
native Compression Streams API with the `deflate-raw` format.

After a shared design opens successfully, its `share` fragment parameter is
removed from the address bar with `history.replaceState`, without reloading or
adding a history entry. The design stays in memory; reloading the cleaned URL
requires reopening the original share link or a saved project file to restore it.

Links include the complete design explicitly, including values that match today's
defaults, empty arrays and removed ornaments. A compact envelope omits the save
timestamp and redundant file metadata. Changing defaults therefore does not change
the values stored in a link. The pipeline is `JSON.stringify([version, productId,
design])` → UTF-8 → raw DEFLATE → URL-safe base64 → `#share=`. Downloaded project
files keep their readable JSON format.

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
3MF), `project.ts` (how its design is read back out of a file) and, optionally,
`Warnings.tsx` (what is wrong with the design as a whole) — the two
existing products are the template — and add one entry
to `products/registry.ts`. Nothing else in the app
changes. A `ProductDefinition` exposes only what the shell has to mount, so the
shell never knows a product's shape. (Same pattern as `fonts/registry.ts`: add a
font by dropping its `.ttf` + `OFL.txt` under `src/assets/fonts/<id>/` and adding
one registry entry.)

Because a product's controls and its scene are mounted in separate subtrees
(sidebar and canvas), anything they share — above all the one async geometry
build that feeds both — goes in the definition's optional `Provider`.

Each product also exposes a required `history` controller. Create it once beside
the store with `createDesignHistory(store, selectFullConfig)` from
`store/designHistory.ts`, and pass it through the product definition. The selector
must include the complete JSON-safe design and exclude actions and transient UI
state. All store changes are then recorded automatically, including file loads;
restoring snapshots preserves related fields without re-running edit corrections.
Use the shared controls (or `DesignInput` for custom text/range inputs) to group
continuous input. Commit preview drags once on release. The shared shell supplies
the buttons, shortcuts and active history context for every product.

### The preview

Every product is designed in the same canvas (`scene/StudioCanvas.tsx`). The
design is centered and stood on the ground by `GroundCenter` — not drei's
`Center`, which measures once and so loses the race against the asynchronous font
build. Under it, `GroundGrid` rules the floor in real millimeters (10mm cells,
50mm sections), and the coin button in the corner lays a true-to-size 2 € coin
beside the design (`ScaleReference`), because millimeters on a slider don't tell
you how big the print will be. Both are scenery, rendered so that the grid never
drags the camera's auto-fit away from the design.

### The controls panel

The panel is built from collapsible sections (`ui/controls/CollapsibleSection.tsx`),
because with everything open both products ran to several screens — most of a
design you cannot see at once. Shut, a section is one line that still names what
it holds and what it is set to ("Liam", "1.00 mm deep", "2, 40 mm"), so folding
it away costs no information. The two tall things inside them fold too: a font
picker sits behind a `Change` link (`ui/controls/FontField.tsx`), since choosing
a face is something you do once per design rather than keep adjusting, and each
ornament's card folds to the row naming it. Together that takes the name display
from 3004px to 784px and the cake topper from 2104px to 743px, both about one
screen.

Clicking a piece of the design — rather than dragging it — opens the section
that shapes it, closes the others, scrolls to the control and blinks it
(`ui/panelStore.ts`, `ui/FocusTarget.tsx`). A letter points at its line's text
field, a stick at the sticks section, an ornament at its own card. Pointing at a
thing is a more direct way of asking "what changes this?" than hunting for the
section that owns it. Clicking a section header, by contrast, toggles only that
section, so two can be held open side by side — the initial's thickness and the
name's thickness are genuinely read together, and a panel that closed one to
show the other would make that a chore.

Click and drag are told apart by how far the pointer travelled in screen pixels
(`scene/tapGesture.ts`) — not in the model's millimeters, since the same wobble
is a huge drag zoomed in and nothing at all zoomed out — and the blink waits for
the scroll to settle, so a long one can't swallow it. Each product names its own
sections and targets in its `focus.ts`, which is the one module its panel and
its scene both import.

Pinned over the preview's top-right corner is the one Export button
(`ui/ExportButton.tsx`), the same control in every product. It lives here rather
than in the sidebar because it is the thing you came to do and it applies to the
whole design, not to any one section of the panel — and it is one button, not a
format menu, because every product exports 3MF and nothing else. A product
supplies only a thunk that builds the file (`ProductDefinition.Export`), since
writing out every triangle for a file nobody has asked for would cost more than
the preview itself.

The bottom-right corner carries the view buttons and, above them, whatever is
wrong with the design as a whole (`ProductDefinition.Warnings`, rendered through
`ui/FloatWarning.tsx`) — today, that a part of it is touching nothing and would
arrive as loose bits. It belongs over the preview rather than under a control
because it is about the thing on screen and it is usually a drag that caused it,
and the control it would otherwise sit under may be scrolled away or collapsed.
The export is deliberately left working: printing the parts separately and gluing
them is a real way to make one of these.

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
  The lettering and the ornaments stand *on* it — the card's front face is their
  back face — rather than all three being extruded from the same z=0. Sharing a
  back face buried the card's whole thickness inside the letters: two parts in
  two filaments occupying one volume, for the slicer to resolve by part order.
  Seated, every layer belongs to exactly one part, and they still fuse, meeting
  across a whole face.
  A counter that survives the grow stays a hole, and each one can be filled in
  solid instead — from the checklist in the panel, or by holding Ctrl in the
  preview and clicking the hole itself (`scene/OutlineHoleTargets.tsx`). Holding
  the modifier is what puts a patch over each hole; without it the same click
  drags a letter. Pointing at one rebuilds the card with that hole toggled, so
  the preview is the actual result rather than a drawing of it, and a hole
  already filled in is opened again the same way. Pointing at a row of the
  checklist lights that one hole up on the card, which is the only way to tell
  "line 1, letter 3, hole 2 of 2" from its neighbour without counting — the
  panel says what it is pointing at through `panelStore.highlighted`, the same
  channel `focus` uses in the other direction. A hole is keyed by the letter
  it was attributed to *and* which of that letter's holes it is: lines dragged
  across each other close pockets between their strokes, so one letter commonly
  owns several, and keyed by letter alone they would fill in together.
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
- **Holding together** (`geometry/connectivity.ts`): whether a design is one
  piece. Every piece here is a planar prism, so two of them touch exactly when
  their footprints meet and their depth bands do — two cheap tests, where a
  mesh-level answer would be a solid intersection per pair. What counts as held
  is a property of how the design is printed, not of its shapes, so the product
  says which: a cake topper prints as one fused object, so touching anything that
  is itself held is enough (`chain`), while a name display's name and ornaments
  print separately and drop into their own recesses, so each has to meet the
  initial itself (`anchor`). Granularity is the product's to choose, and is the
  whole question: the cake topper passes a piece per letter, per card island and
  per stick, because those are the parts that can come away from each other.
- **Merging** (`geometry/combine.ts`): a plain buffer merge, not a CSG union —
  every part is already watertight with real volumetric overlap where parts meet,
  which slicers handle correctly.

## Tests

`npm test` runs the full pipeline against the real font files (not mocks), plus
React Three Fiber scene-wiring tests via `@react-three/test-renderer`.
