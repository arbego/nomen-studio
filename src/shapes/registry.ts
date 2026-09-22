import type { AccentShapeDefinition } from './types';

// Each accent is a single SVG path in a 0–100 viewBox. To add a new shape later:
// author (or export from a vector tool) one path string and add one entry here —
// no rendering code changes.
export const SHAPE_REGISTRY: AccentShapeDefinition[] = [
  {
    id: 'heart',
    label: 'Heart',
    svgPath:
      'M 50 92 C 50 92 8 58 8 30 C 8 14 21 3 37 3 C 45 3 50 10 50 19 C 50 10 55 3 63 3 C 79 3 92 14 92 30 C 92 58 50 92 50 92 Z',
    defaultWidthMm: 25,
  },
];

const BY_ID = new Map(SHAPE_REGISTRY.map((s) => [s.id, s]));

export function getShapeDefinition(id: string): AccentShapeDefinition {
  const def = BY_ID.get(id);
  if (!def) {
    throw new Error(`Unknown accent shape id: ${id}`);
  }
  return def;
}
