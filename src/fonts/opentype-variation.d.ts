// @types/opentype.js (1.3.10) predates opentype.js's variable-font API added in 2.0.0.
// `font.variation.set/get` is real at runtime (verified directly against the
// installed 2.0.0 package) — this augments the stale community types rather than
// casting `any` at every call site.
import 'opentype.js';

declare module 'opentype.js' {
  interface VariationManager {
    set(instanceIdOrCoords: number | Record<string, number>): void;
    get(): Record<string, number>;
  }

  interface Font {
    variation: VariationManager;
  }

  // The installed runtime's stringToGlyphs also accepts a RenderOptions second
  // argument (verified directly against the installed 2.0.0 package's source —
  // it forwards to GSUB feature application), but the stale community types only
  // declare the single-argument form. This adds the real overload.
  interface Font {
    stringToGlyphs(s: string, options?: RenderOptions): Glyph[];
  }
}
