import * as THREE from 'three';
import * as ClipperLib from 'clipper-lib';
import type { Manifold, ManifoldToplevel, Vec2 } from 'manifold-3d';
import { CLIPPER_SCALE, fromClipperPath, growRegion, regionIsEmpty, splitRegion, subtractRegions, type Region } from '../../geometry/clipper';
import { HOLLOW_LEDGE_WIDTH_MM, HOLLOW_LEDGE_WEB_MM, minimumHollowDepthMm, type NameDisplayConfig } from './config';

/** Small bands also handle a cavity splitting or disappearing at a narrow stroke. */
const RAMP_BAND_MM = 0.2;
const wasmUrl = new URL('../../../node_modules/manifold-3d/manifold.wasm', import.meta.url).href;

let manifold: ManifoldToplevel | undefined;
let initialization: Promise<void> | undefined;

/** Load once with the fonts, leaving placement and pocket updates synchronous. */
export function initializeHollowGeometry(): Promise<void> {
  initialization ??= (async () => {
    const [{ default: Module }, response] = await Promise.all([
      import('manifold-3d'),
      fetch(wasmUrl),
    ]);
    if (!response.ok) throw new Error('Could not load the hollow geometry engine.');
    const options = { locateFile: () => wasmUrl, wasmBinary: await response.arrayBuffer() };
    manifold = await Module(options);
    manifold.setup();
  })().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

function cutPockets(bowl: THREE.BufferGeometry, lid: THREE.BufferGeometry, pocket: Region, top: number, depth: number): [THREE.BufferGeometry, THREE.BufferGeometry] {
  if (!manifold) throw new Error('The hollow geometry engine is still loading.');
  const engine = manifold;
  const solids: Manifold[] = [];
  const crossSection = new engine.CrossSection(pocket.map((path) => path.map((p): Vec2 => [p.X / CLIPPER_SCALE, p.Y / CLIPPER_SCALE])), 'NonZero');
  const track = (solid: Manifold) => { solids.push(solid); return solid; };
  const fromGeometry = (geometry: THREE.BufferGeometry) => {
    const position = geometry.getAttribute('position');
    const vertices: number[] = [];
    const indices: number[] = [];
    const unique = new Map<string, number>();
    for (let i = 0; i < position.count; i++) {
      const point = [position.getX(i), position.getY(i), position.getZ(i)];
      const key = point.join(',');
      let index = unique.get(key);
      if (index === undefined) {
        index = vertices.length / 3;
        vertices.push(...point);
        unique.set(key, index);
      }
      indices.push(index);
    }
    return track(new engine.Manifold(new engine.Mesh({ numProp: 3, vertProperties: new Float32Array(vertices), triVerts: new Uint32Array(indices) })));
  };
  const toGeometry = (solid: Manifold) => {
    const mesh = solid.getMesh();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertProperties, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.triVerts, 1));
    const result = geometry.toNonIndexed();
    geometry.dispose();
    result.computeVertexNormals();
    result.computeBoundingBox();
    return result;
  };
  try {
    // Extend beyond the top face so the subtraction has no coincident cap.
    const cutter = track(track(crossSection.extrude(depth + 0.01)).translate([0, 0, top - depth]));
    const cut = (geometry: THREE.BufferGeometry) => toGeometry(track(fromGeometry(geometry).subtract(cutter)));
    return [cut(bowl), cut(lid)];
  } finally {
    for (const solid of solids.reverse()) solid.delete();
    crossSection.delete();
  }
}

/** Recover nesting without re-running a boolean that could simplify a shared edge. */
function surfaceContours(region: Region): { contour: THREE.Vector2[]; holes: THREE.Vector2[][] }[] {
  const outers = region.filter((path) => ClipperLib.Clipper.Orientation(path));
  const groups = outers.map((path) => ({ contour: fromClipperPath(path), holes: [] as THREE.Vector2[][] }));
  for (const hole of region.filter((path) => !ClipperLib.Clipper.Orientation(path))) {
    let owner = -1;
    let area = Infinity;
    outers.forEach((outer, index) => {
      const candidateArea = Math.abs(ClipperLib.Clipper.Area(outer));
      if (candidateArea < area && ClipperLib.Clipper.PointInPolygon(hole[0], outer) !== 0) {
        owner = index;
        area = candidateArea;
      }
    });
    if (owner >= 0) groups[owner].holes.push(fromClipperPath(hole));
  }
  return groups;
}

/**
 * Booleans and triangulation can remove collinear vertices from one side of a
 * seam. Split the adjoining triangles at those vertices so both sides share
 * the same edges, including where an inlay pocket meets a perimeter wall.
 */
function stitchSeams(positions: number[]): number[] {
  const vertices: number[][] = [];
  const ids = new Map<string, number>();
  const triangles: number[][] = [];
  const edges = new Map<string, { a: number; b: number; count: number }>();
  const edgeKey = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`;
  for (let i = 0; i < positions.length; i += 9) {
    const triangle: number[] = [];
    for (let j = 0; j < 9; j += 3) {
      const point = positions.slice(i + j, i + j + 3);
      const key = point.map((value) => Math.round(value * 1e8)).join(',');
      let id = ids.get(key);
      if (id === undefined) {
        id = vertices.length;
        vertices.push(point);
        ids.set(key, id);
      }
      triangle.push(id);
    }
    if (new Set(triangle).size < 3) continue;
    triangles.push(triangle);
  }
  for (const triangle of triangles) {
    for (let j = 0; j < 3; j++) {
      const a = triangle[j];
      const b = triangle[(j + 1) % 3];
      const key = edgeKey(a, b);
      const existing = edges.get(key);
      if (existing) existing.count++;
      else edges.set(key, { a, b, count: 1 });
    }
  }
  const boundary = [...edges.entries()].filter(([, edge]) => edge.count === 1);
  const boundaryIds = [...new Set(boundary.flatMap(([, edge]) => [edge.a, edge.b]))];
  const sorted = [0, 1, 2].map((axis) => boundaryIds.slice().sort((a, b) => vertices[a][axis] - vertices[b][axis]));
  const epsilon = 1e-7;
  function bound(list: number[], axis: number, value: number): number {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (vertices[list[mid]][axis] < value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
  const cuts = new Map<string, number[]>();
  for (const [key, edge] of boundary) {
    const a = vertices[edge.a];
    const b = vertices[edge.b];
    const delta = b.map((value, axis) => value - a[axis]);
    const lengthSq = delta.reduce((sum, value) => sum + value * value, 0);
    const ranges = sorted.map((list, axis) => ({
      list,
      lo: bound(list, axis, Math.min(a[axis], b[axis]) - epsilon),
      hi: bound(list, axis, Math.max(a[axis], b[axis]) + epsilon),
    }));
    const range = ranges.reduce((best, current) => current.hi - current.lo < best.hi - best.lo ? current : best);
    const points: { id: number; t: number }[] = [];
    for (let i = range.lo; i < range.hi; i++) {
      const id = range.list[i];
      if (id === edge.a || id === edge.b) continue;
      const point = vertices[id];
      const t = point.reduce((sum, value, axis) => sum + (value - a[axis]) * delta[axis], 0) / lengthSq;
      if (t <= epsilon || t >= 1 - epsilon) continue;
      const distanceSq = point.reduce((sum, value, axis) => sum + (value - a[axis] - t * delta[axis]) ** 2, 0);
      if (distanceSq <= epsilon ** 2) points.push({ id, t });
    }
    if (points.length) cuts.set(key, points.sort((p, q) => p.t - q.t).map((point) => point.id));
  }
  const result: number[] = [];
  for (const triangle of triangles) {
    const perimeter: number[] = [];
    for (let i = 0; i < 3; i++) {
      const a = triangle[i];
      const b = triangle[(i + 1) % 3];
      const key = edgeKey(a, b);
      const extra = cuts.get(key) ?? [];
      perimeter.push(a, ...(edges.get(key)!.a === a ? extra : extra.slice().reverse()));
    }
    if (perimeter.length === 3) {
      for (const id of triangle) result.push(...vertices[id]);
    } else {
      const center = [0, 1, 2].map((axis) => triangle.reduce((sum, id) => sum + vertices[id][axis], 0) / 3);
      for (let i = 0; i < perimeter.length; i++) result.push(...center, ...vertices[perimeter[i]], ...vertices[perimeter[(i + 1) % perimeter.length]]);
    }
  }
  return result;
}

/** Builds only exterior surfaces, without internal faces between stacked slabs. */
class SurfaceBuilder {
  private positions: number[] = [];

  private triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
    if (new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).lengthSq() < 1e-16) return;
    this.positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  }

  cap(region: Region, height: number | ((point: THREE.Vector2) => number), up = true) {
    for (const { contour, holes } of surfaceContours(region)) {
      // ShapeUtils removes repeated closing points; do it before making the
      // vertex list so its triangle indices and our vertices stay in step.
      for (const path of [contour, ...holes]) {
        if (path.length > 1 && path[0].equals(path[path.length - 1])) path.pop();
      }
      const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
      const points = [...contour, ...holes.flat()];
      for (const face of faces) {
        const vertices = face.map((index) => {
          const point = points[index];
          return new THREE.Vector3(point.x, point.y, typeof height === 'number' ? height : height(point));
        });
        const [a, b, c] = vertices;
        const positive = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
        this.triangle(a, positive === up ? b : c, positive === up ? c : b);
      }
    }
  }

  walls(region: Region, bottom: number, top: number, inward = false) {
    if (top <= bottom) return;
    for (const path of region) {
      for (let i = 0; i < path.length; i++) {
        const p = path[i];
        const q = path[(i + 1) % path.length];
        const a = new THREE.Vector3(p.X / CLIPPER_SCALE, p.Y / CLIPPER_SCALE, bottom);
        const b = new THREE.Vector3(q.X / CLIPPER_SCALE, q.Y / CLIPPER_SCALE, bottom);
        const c = new THREE.Vector3(q.X / CLIPPER_SCALE, q.Y / CLIPPER_SCALE, top);
        const d = new THREE.Vector3(p.X / CLIPPER_SCALE, p.Y / CLIPPER_SCALE, top);
        this.triangle(a, inward ? c : b, inward ? b : c);
        this.triangle(a, inward ? d : c, inward ? c : d);
      }
    }
  }

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(stitchSeams(this.positions), 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
  }
}

export interface HollowInitial {
  bowlGeometry: THREE.BufferGeometry;
  lidGeometry: THREE.BufferGeometry;
  /** The closed front face, with the lid's clearance gap left out. */
  supportRegion: Region;
  cavityDepthMm: number;
}

/**
 * A bowl printed back-down and a lid printed underside-down. The lid seats
 * flush in the opening; a 45° ledge grows inward below its flat underside.
 * Counters and disconnected chambers follow the font's actual silhouette.
 */
export function buildHollowInitial(face: Region, inlays: Region, config: NameDisplayConfig, pocketDepth: number): HollowInitial {
  if (config.initialDepthMm < minimumHollowDepthMm(config)) {
    throw new Error('Increase the initial thickness to leave room for the floor, cavity, ramp and lid.');
  }
  face = splitRegion(face).flat();
  // A chamber needs an opening through the ledge, otherwise it would be sealed
  // below the removable lid. Leave such small disconnected areas solid.
  const cavity = splitRegion(growRegion(face, -config.wallThicknessMm))
    .filter((component) => !regionIsEmpty(growRegion(component, -HOLLOW_LEDGE_WIDTH_MM)))
    .flat();
  const lidFace = growRegion(cavity, -config.lidClearanceMm);
  if (regionIsEmpty(cavity) || regionIsEmpty(lidFace)) {
    throw new Error('The walls leave no room for a hollow initial. Reduce the wall thickness or choose a wider initial font.');
  }

  const seatZ = config.initialDepthMm - config.lidThicknessMm;
  const rampEndZ = seatZ - HOLLOW_LEDGE_WEB_MM;
  const rampStartZ = rampEndZ - HOLLOW_LEDGE_WIDTH_MM;
  const rim = subtractRegions(face, cavity);

  const bowl = new SurfaceBuilder();
  bowl.cap(face, 0, false);
  bowl.walls(face, 0, config.initialDepthMm);
  bowl.cap(cavity, config.wallThicknessMm);
  bowl.walls(cavity, config.wallThicknessMm, rampStartZ, true);

  // Triangulate each band between nested offsets, assigning the lower edge
  // its starting height and the upper edge its ending height. This creates
  // sloped surfaces rather than a stack of overlapping stair-step prisms.
  const bands = Math.ceil(HOLLOW_LEDGE_WIDTH_MM / RAMP_BAND_MM);
  let lower = cavity;
  for (let i = 1; i <= bands; i++) {
    const inset = HOLLOW_LEDGE_WIDTH_MM * i / bands;
    const upper = growRegion(cavity, -inset);
    const upperPoints = new Set(upper.flatMap((path) => path.map((point) => `${point.X},${point.Y}`)));
    const lowZ = rampStartZ + HOLLOW_LEDGE_WIDTH_MM * (i - 1) / bands;
    const highZ = rampStartZ + inset;
    bowl.cap(subtractRegions(lower, upper), (point) => upperPoints.has(`${Math.round(point.x * CLIPPER_SCALE)},${Math.round(point.y * CLIPPER_SCALE)}`) ? highZ : lowZ, false);
    lower = upper;
  }
  bowl.walls(lower, rampEndZ, seatZ, true);
  bowl.cap(subtractRegions(cavity, lower), seatZ);
  bowl.walls(cavity, seatZ, config.initialDepthMm, true);
  bowl.cap(rim, config.initialDepthMm);

  const lid = new SurfaceBuilder();
  lid.cap(lidFace, seatZ, false);
  lid.walls(lidFace, seatZ, config.initialDepthMm);
  lid.cap(lidFace, config.initialDepthMm);

  let bowlGeometry = bowl.geometry();
  let lidGeometry = lid.geometry();
  if (pocketDepth > 0 && !regionIsEmpty(inlays)) {
    const cut = cutPockets(bowlGeometry, lidGeometry, growRegion(inlays, config.pocketClearanceMm), config.initialDepthMm, pocketDepth);
    bowlGeometry.dispose();
    lidGeometry.dispose();
    [bowlGeometry, lidGeometry] = cut;
  }
  return {
    bowlGeometry,
    lidGeometry,
    supportRegion: [...rim, ...lidFace],
    cavityDepthMm: seatZ - config.wallThicknessMm,
  };
}
