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
}
