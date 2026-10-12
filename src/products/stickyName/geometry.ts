import { Box2, Vector2, type BufferGeometry } from 'three';
import { loadFont } from '../../fonts/loadFont';
import { svgPathDataToShapes } from '../../geometry/svgPathToShapes';
import { regionFromContours, splitRegion } from '../../geometry/clipper';
import { initializeSolidGeometry } from '../../geometry/solidGeometry';
import { getLetterTheme } from './themes/registry';
import { cutMagnets, type PlacedMagnet } from './magnets';
import type { StickyNameConfig } from './config';

export interface StickyLetter {
  index: number;
  char: string;
  geometry: BufferGeometry;
  x: number;
  width: number;
  height: number;
  magnets: PlacedMagnet[];
  detachedParts: number;
  outline: string;
}
export interface StickyNameGeometry {
  letters: StickyLetter[];
  warnings: string[];
  canExport: boolean;
}

// Independent of name, spacing and magnets: a magnet edit reuses the inflated glyph.
const cache = new Map<string, { geometry: BufferGeometry; parts: number; outline: string }>();
const CACHE_LIMIT = 32;

export function disposeStickyNameGeometry(result: StickyNameGeometry) {
  for (const letter of result.letters) letter.geometry.dispose();
}

export async function buildStickyNameGeometry(config: StickyNameConfig, signal?: AbortSignal): Promise<StickyNameGeometry> {
  if (!config.name.trim()) throw new Error('Enter a name to generate letters.');
  const [font] = await Promise.all([loadFont(config.fontId), initializeSolidGeometry()]);
  signal?.throwIfAborted();
  const cap = font.charToGlyph('H').getBoundingBox();
  const scale = config.letterHeightMm / (cap.y2 - cap.y1 || font.unitsPerEm);
  const letters: StickyLetter[] = [];
  const warnings: string[] = [];
  let cursor = 0;
  try {
    for (const [index, char] of Array.from(config.name).entries()) {
      signal?.throwIfAborted();
      if (/\s/u.test(char)) { cursor += config.letterHeightMm * 0.4; continue; }
      const glyph = font.charToGlyph(char);
      if (glyph.index === 0) throw new Error(`The selected font does not contain “${char}”. Choose another font.`);
      const key = JSON.stringify([config.fontId, char, config.theme, config.letterHeightMm, config.depthMm, config.bubble]);
      let cached = cache.get(key);
      if (!cached) {
        const shapes = svgPathDataToShapes(glyph.getPath(0, 0, font.unitsPerEm).toPathData(3));
        const contours = shapes.map((s) => ({
          outer: s.getPoints(16).map((p) => new Vector2(p.x * scale, -p.y * scale)),
          holes: s.holes.map((h) => h.getPoints(16).map((p) => new Vector2(p.x * scale, -p.y * scale))),
        }));
        const bounds = new Box2().setFromPoints(contours.flatMap((c) => c.outer));
        if (bounds.isEmpty()) throw new Error(`“${char}” has no printable outline in this font.`);
        for (const c of contours) for (const path of [c.outer, ...c.holes]) for (const p of path) p.sub(bounds.min);
        const region = regionFromContours(contours);
        const outline = contours.flatMap((c) => [c.outer, ...c.holes]).map((path) => `M${path.map((p) => `${p.x},${p.y}`).join('L')}Z`).join('');
        cached = { geometry: getLetterTheme(config.theme).build(region, config), parts: splitRegion(region).length, outline };
        cache.set(key, cached);
        if (cache.size > CACHE_LIMIT) {
          const oldest = cache.keys().next().value!;
          cache.get(oldest)!.geometry.dispose();
          cache.delete(oldest);
        }
      }
      const original = cached.geometry.clone();
      let cut;
      try { cut = cutMagnets(original, config.magnets[index] ?? [], config.clearanceMm); }
      catch (error) { original.dispose(); throw error; }
      if (cut.geometry !== original) original.dispose();
      const bounds = cut.geometry.boundingBox!;
      const letter: StickyLetter = { index, char, geometry: cut.geometry, x: cursor - bounds.min.x,
        width: bounds.max.x - bounds.min.x, height: bounds.max.y - bounds.min.y, magnets: cut.magnets, detachedParts: cached.parts, outline: cached.outline };
      letters.push(letter);
      for (const [j, m] of cut.magnets.entries()) if (m.message) warnings.push(`“${char}” (${index + 1}), magnet ${j + 1}: ${m.message}`);
      if (cached.parts > 1) warnings.push(`“${char}” (${index + 1}) has ${cached.parts} separate pieces (such as dots or accents). Each prints separately.`);
      cursor += letter.width + config.spacingMm;
      // Yield between letters so loading/status controls can paint.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const center = (cursor - config.spacingMm) / 2;
    for (const letter of letters) letter.x -= center;
    return { letters, warnings, canExport: letters.length > 0 && letters.every((l) => l.magnets.every((m) => m.valid)) };
  } catch (error) { disposeStickyNameGeometry({ letters, warnings, canExport: false }); throw error; }
}
