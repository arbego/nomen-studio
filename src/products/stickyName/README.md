# Sticky Name geometry

The pipeline is **font outlines → theme solid → validated magnet cuts → preview
and 3MF**. Theme code is in `themes/`; `LetterTheme.build` receives a hole-aware
millimeter region and returns a closed, outward-facing `BufferGeometry`. It has
no knowledge of magnets, layout, colors or export. Register future themes in
`themes/registry.ts` and extend the config, parser and controls together. Cheese
and moon themes are deliberately not implemented.

Bubble uses adaptive morphological opening to round sharp contour corners,
reducing the radius if rounding would remove components or counters. A screened
Poisson membrane is solved over each connected component on a fixed grid. Its
square root gives a curved inflation profile; bubbliness controls the screening
length. A level set creates the rounded face and lower edge, clipped at Z = 0
for a flat back. This curves the whole face, including junctions; there is no
flat extrusion cap. Disconnected accents receive their own inflation field.
No randomness or manual glyph-specific edits are involved.

Meshing uses [Manifold's level-set implementation](https://manifoldcad.org/docs/jsuser/classes/Manifold.html#levelSet)
at roughly 0.45–1.2 mm spacing for supported letter sizes, with a 0.015 mm
isosurface tolerance. Thin ornamental strokes may not survive sampling; bold
fonts are the intended input. Maximum thickness is nominal (meshed peaks can
fall slightly below it). Font size is referenced to its capital H; lowercase,
accents and overshoots keep their proportions. Glyphs use independent cmap
lookups, not contextual shaping or ligatures. The default Coiny and the Lilita
One alternative have fixed-weight outlines and offline test fixtures.

Solid simplification removes redundant triangles within 0.01 mm. Export retains
indexed topology and full vertex precision, and applies layout translations in
double precision. Welding coincident tangencies or rounding small
marching-tetrahedra edges can otherwise damage an intact solid.
The regression suite checks the edge pairing of the serialized 3MF itself.

Magnet height is the cavity floor's Z coordinate, measured from the back.
Clearance adds to the diameter and to the thickness. The full cylindrical
clearance envelope plus a 0.8 mm shell is subtracted from the uncut letter to
test containment against the curved surface. Candidate positions are ranked
deterministically, and intersecting cavity envelopes are rejected. Valid cutters
are boolean-subtracted as enclosed voids. Invalid magnets remain visible as
red overlays and disable export. Overlay meshes never enter the 3MF.

Themed glyphs are cached independently of magnet/layout edits with a bounded
cache. Provider builds are debounced, superseded builds abort between letters,
and discarded preview geometry is disposed. The shared WASM engine lives in
`../../geometry/solidGeometry.ts` and releases solids after each operation.
