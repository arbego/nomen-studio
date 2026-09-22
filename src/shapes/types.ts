export interface AccentShapeDefinition {
  id: string;
  label: string;
  /** SVG path `d` data, authored in a 0–100 x 0–100 viewBox, y-down (SVG convention). */
  svgPath: string;
  /** Sensible default width in millimeters when this shape is added to a topper. */
  defaultWidthMm: number;
}
