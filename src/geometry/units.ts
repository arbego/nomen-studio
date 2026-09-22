/**
 * Every geometry function in this module works in millimeters. Font glyphs and
 * SVG accent shapes are authored in their own local unit spaces (font units at
 * a 1000-unit em square, or an arbitrary SVG viewBox) — `mm per local unit` is
 * always derived from a target real-world width, never assumed.
 */
export const DEFAULT_EXTRUDE_DEPTH_MM = 3;
export const DEFAULT_CURVE_SEGMENTS = 12;

export function scaleForTargetWidth(rawWidth: number, targetWidthMm: number): number {
  if (rawWidth <= 0) {
    throw new Error('Cannot compute scale for a non-positive raw width');
  }
  return targetWidthMm / rawWidth;
}
