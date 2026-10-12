import type { BufferGeometry } from 'three';
import { withSolidGeometry } from '../../geometry/solidGeometry';
import { MIN_WALL_MM, type MagnetConfig } from './config';

export interface PlacedMagnet extends MagnetConfig {
  position: { x: number; y: number };
  valid: boolean;
  message: string | null;
  /** Cavity roof; add the slicer pause before the layer that covers it. */
  pauseHeightMm: number;
}

/** Validate the complete cylindrical clearance envelope against the actual curved solid. */
export function cutMagnets(geometry: BufferGeometry, magnets: MagnetConfig[], clearance: number): { geometry: BufferGeometry; magnets: PlacedMagnet[] } {
  if (!magnets.length) return { geometry, magnets: [] };
  return withSolidGeometry((engine, track, fromGeometry, toGeometry) => {
    const body = fromGeometry(geometry);
    const bounds = body.boundingBox();
    const placed: PlacedMagnet[] = [];
    const cutters = [];
    const radius = (m: MagnetConfig) => (m.diameterMm + clearance) / 2;
    function cylinder(m: MagnetConfig, p: { x: number; y: number }, wall: number) {
      return track(track(engine.Manifold.cylinder(m.thicknessMm + clearance + 2 * wall, radius(m) + wall, radius(m) + wall, 64)).translate([p.x, p.y, m.heightMm - wall]));
    }
    function fits(m: MagnetConfig, p: { x: number; y: number }) {
      const raw = engine.Manifold.cylinder(m.thicknessMm + clearance + 2 * MIN_WALL_MM, radius(m) + MIN_WALL_MM, radius(m) + MIN_WALL_MM, 64);
      const envelope = raw.translate([p.x, p.y, m.heightMm - MIN_WALL_MM]);
      const outside = envelope.subtract(body);
      try { return outside.volume() < 0.00001; }
      finally { outside.delete(); envelope.delete(); raw.delete(); }
    }
    function overlaps(m: MagnetConfig, p: { x: number; y: number }) {
      return placed.some((other) => other.valid &&
        m.heightMm < other.pauseHeightMm + MIN_WALL_MM && m.heightMm + m.thicknessMm + clearance + MIN_WALL_MM > other.heightMm &&
        Math.hypot(p.x - other.position.x, p.y - other.position.y) < radius(m) + radius(other) + MIN_WALL_MM);
    }
    for (const m of magnets) {
      let position = m.position;
      if (!position) {
        const candidates: { x: number; y: number; score: number }[] = [];
        const cx = (bounds.min[0] + bounds.max[0]) / 2, cy = (bounds.min[1] + bounds.max[1]) / 2;
        const step = Math.max(1.2, Math.max(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1]) / 24);
        for (let y = bounds.min[1] + radius(m); y <= bounds.max[1] - radius(m); y += step) {
          for (let x = bounds.min[0] + radius(m); x <= bounds.max[0] - radius(m); x += step) {
            const separation = placed.length ? Math.min(...placed.map((p) => Math.hypot(p.position.x - x, p.position.y - y))) : 0;
            candidates.push({ x, y, score: separation - Math.hypot(x - cx, y - cy) * 0.2 });
          }
        }
        candidates.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
        position = candidates.find((p) => !overlaps(m, p) && fits(m, p)) ?? { x: cx, y: cy };
        position = { x: Math.round(position.x * 100) / 100, y: Math.round(position.y * 100) / 100 };
      }
      const message = !fits(m, position) ? `Magnet needs ${MIN_WALL_MM} mm of material around it. Move it, reduce its size/height, or thicken the letter.`
        : overlaps(m, position) ? 'Magnet cavities overlap or leave too little material between them. Move one magnet.' : null;
      placed.push({ ...m, position, valid: !message, message, pauseHeightMm: m.heightMm + m.thicknessMm + clearance });
      if (!message) cutters.push(cylinder(m, position, 0));
    }
    if (!cutters.length) return { geometry, magnets: placed };
    const result = track(body.subtract(track(engine.Manifold.union(cutters))));
    if (result.status() !== 'NoError') throw new Error('Could not cut magnet cavities. Adjust the magnet positions.');
    return { geometry: toGeometry(result, true), magnets: placed };
  });
}
