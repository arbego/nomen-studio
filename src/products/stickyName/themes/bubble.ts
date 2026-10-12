import { Box2, Vector2 } from 'three';
import { fromClipperPath, growRegion, splitRegion, type Region } from '../../../geometry/clipper';
import { withSolidGeometry } from '../../../geometry/solidGeometry';
import type { LetterTheme } from './types';

/** Positive inside; nonzero winding preserves counters and overlapping contours. */
function distanceToOutline(paths: Vector2[][], x: number, y: number): number {
  let distanceSq = Infinity;
  let winding = 0;
  for (const path of paths) for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    distanceSq = Math.min(distanceSq, (x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2);
    const cross = dx * (y - a.y) - dy * (x - a.x);
    if (a.y <= y && b.y > y && cross > 0) winding++;
    if (a.y > y && b.y <= y && cross < 0) winding--;
  }
  return Math.sqrt(distanceSq) * (winding === 0 ? -1 : 1);
}

/** Adaptive contour rounding: do not erase counters or detached accents. */
function roundOutline(region: Region, radius: number): Region {
  const components = splitRegion(region).length;
  for (let r = radius; r > 0.05; r /= 2) {
    const rounded = growRegion(growRegion(region, -r), r);
    if (rounded.length === region.length && splitRegion(rounded).length === components) return rounded;
  }
  return region;
}

/**
 * A screened Poisson membrane over the glyph, with zero boundary conditions.
 * Its square root creates an inflated face with a vertical tangent at the edge.
 * Unlike a bevel, the entire face curves, including broad strokes and junctions.
 * Fixed sampling, iteration order and convergence bound make this reproducible.
 */
function inflationField(region: Region, inflation: number) {
  const paths = region.map(fromClipperPath);
  const bounds = new Box2().setFromPoints(paths.flat());
  const size = bounds.getSize(new Vector2());
  const step = Math.max(0.25, Math.max(size.x, size.y) / 130);
  const minX = bounds.min.x - step * 3, minY = bounds.min.y - step * 3;
  const nx = Math.ceil(size.x / step) + 7, ny = Math.ceil(size.y / step) + 7;
  const distances = new Float64Array(nx * ny);
  const field = new Float64Array(nx * ny);
  const inside: number[] = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = y * nx + x;
    distances[i] = distanceToOutline(paths, minX + x * step, minY + y * step);
    if (distances[i] > 0) inside.push(i);
  }
  if (!inside.length) throw new Error('This font has strokes too fine to inflate. Choose a bolder font or increase the letter height.');
  const length = Math.max(size.x, size.y) * (0.025 + inflation * 0.18);
  const lambda = (step / length) ** 2;
  for (let iteration = 0; iteration < 500; iteration++) {
    let change = 0;
    for (const i of inside) {
      const next = (field[i - 1] + field[i + 1] + field[i - nx] + field[i + nx] + lambda) / (4 + lambda);
      const delta = 1.65 * (next - field[i]);
      field[i] += delta;
      change = Math.max(change, Math.abs(delta));
    }
    if (change < 1e-6) break;
  }
  const peak = Math.max(...inside.map((i) => field[i]));
  for (let i = 0; i < field.length; i++) field[i] = distances[i] > 0 ? field[i] / peak : distances[i] / length;
  function sample(x: number, y: number) {
    const gx = (x - minX) / step, gy = (y - minY) / step;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    if (ix < 0 || iy < 0 || ix >= nx - 1 || iy >= ny - 1) return -1;
    const u = gx - ix, v = gy - iy, i = iy * nx + ix;
    return (1 - v) * ((1 - u) * field[i] + u * field[i + 1]) + v * ((1 - u) * field[i + nx] + u * field[i + nx + 1]);
  }
  return { sample, bounds, step };
}

export const bubbleTheme: LetterTheme = {
  id: 'bubble', label: 'Bubble',
  build(region, config) {
    const rounded = roundOutline(region, config.bubble.roundnessMm);
    return withSolidGeometry((engine, track, _fromGeometry, toGeometry) => {
      const parts = splitRegion(rounded).map((part) => {
        // Each disconnected accent/dot is inflated to its own maximum height.
        const { sample, bounds, step } = inflationField(part, config.bubble.inflation);
        const equator = Math.min(1.2, config.depthMm * 0.12);
        const roof = config.depthMm - equator;
        const solid = track(engine.Manifold.levelSet(([x, y, z]) =>
          Math.min(z, (sample(x, y) - ((z - equator) / roof) ** 2) * roof),
        { min: [bounds.min.x - step * 2, bounds.min.y - step * 2, -step * 2], max: [bounds.max.x + step * 2, bounds.max.y + step * 2, config.depthMm + step * 2] },
        Math.max(0.45, step * 1.3), 0, 0.015));
        if (solid.status() !== 'NoError' || solid.isEmpty()) throw new Error('Could not inflate this glyph. Try a bolder font or a larger letter.');
        return solid;
      });
      // Remove coplanar back-face tessellation and sub-resolution slivers while
      // retaining the curved face within 0.01 mm and preserving topology.
      return toGeometry(track(track(engine.Manifold.union(parts)).simplify(0.01)), true);
    });
  },
};
