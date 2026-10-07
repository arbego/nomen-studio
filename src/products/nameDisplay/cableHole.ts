import * as THREE from 'three';
import * as ClipperLib from 'clipper-lib';
import type { Mat4 } from 'manifold-3d';
import { CLIPPER_SCALE, growRegion, regionIsEmpty, regionToShapes, subtractRegions, toClipperPath, type Region } from '../../geometry/clipper';
import type { CableHolePlacement } from './config';
import { withSolidGeometry } from './solidGeometry';

export interface CableHole {
  placement: CableHolePlacement;
  diameterMm: number;
  warning: string | null;
}

function contains(region: Region, point: THREE.Vector3): boolean {
  const p = { X: Math.round(point.x * CLIPPER_SCALE), Y: Math.round(point.y * CLIPPER_SCALE) };
  let winding = 0;
  for (const path of region) {
    if (ClipperLib.Clipper.PointInPolygon(p, path) !== 0) winding += ClipperLib.Clipper.Orientation(path) ? 1 : -1;
  }
  return winding > 0;
}

/** Choose a low point where the whole hole fits; never use a glyph's empty bounding-box center. */
export function defaultCableHolePlacement(cavity: Region, diameterMm: number): CableHolePlacement {
  let safe = growRegion(cavity, -diameterMm / 2 - 0.5);
  if (regionIsEmpty(safe)) safe = growRegion(cavity, -0.1);
  let chosen: THREE.Vector2 | undefined;
  for (const shape of regionToShapes(safe)) {
    const { shape: contour, holes } = shape.extractPoints(12);
    for (const path of [contour, ...holes]) {
      if (path.length > 1 && path[0].equals(path[path.length - 1])) path.pop();
    }
    const points = [...contour, ...holes.flat()];
    for (const indices of THREE.ShapeUtils.triangulateShape(contour, holes)) {
      const triangle = indices.map((index) => points[index]);
      const bottom = triangle.reduce((a, b) => a.y < b.y ? a : b);
      const center = triangle.reduce((sum, p) => sum.add(p), new THREE.Vector2()).divideScalar(3);
      const candidate = bottom.clone().lerp(center, 0.1);
      if (!chosen || candidate.y < chosen.y) chosen = candidate;
    }
  }
  if (!chosen) throw new Error('There is no cavity for a cable hole.');
  return { point: { x: chosen.x, y: chosen.y, z: 0 }, normal: { x: 0, y: 0, z: -1 } };
}

/** Raycast an uncut silhouette, so dragging still works across the existing hole. */
export function pickCableHolePlacement(surface: THREE.BufferGeometry, ray: THREE.Ray, frontFloorZ = 0): CableHolePlacement | null {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  try {
    const mesh = new THREE.Mesh(surface, material);
    const caster = new THREE.Raycaster(ray.origin, ray.direction);
    const hits = caster.intersectObject(mesh);
    let hit = hits[0];
    if (!hit?.face) return null;
    if (hit.face.normal.z > 0.5) {
      // The silhouette's front cap is only a picking proxy. In an open bowl
      // the user sees its floor, so use that plane rather than the lid plane.
      const side = hits.find((candidate) => candidate.face && Math.abs(candidate.face.normal.z) < 0.5 && candidate.point.z > frontFloorZ);
      if (side) hit = side;
      else {
        const floorPoint = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -frontFloorZ), new THREE.Vector3());
        return floorPoint ? { point: { x: floorPoint.x, y: floorPoint.y, z: 0 }, normal: { x: 0, y: 0, z: -1 } } : null;
      }
    }
    if (!hit.face) return null;
    const normal = hit.face.normal;
    if (Math.abs(normal.z) > 0.5) {
      return { point: { x: hit.point.x, y: hit.point.y, z: 0 }, normal: { x: 0, y: 0, z: -1 } };
    }
    const side = new THREE.Vector3(normal.x, normal.y, 0).normalize();
    return { point: { x: hit.point.x, y: hit.point.y, z: hit.point.z }, normal: { x: side.x, y: side.y, z: 0 } };
  } finally {
    material.dispose();
  }
}

/** Drill just the selected wall, stopping inside the cavity before any opposite wall. */
export function cutCableHole(bowl: THREE.BufferGeometry, cavity: Region, placement: CableHolePlacement, diameterMm: number, floorZ: number, seatZ: number): { geometry: THREE.BufferGeometry; hole: CableHole } {
  const point = new THREE.Vector3(placement.point.x, placement.point.y, placement.point.z);
  const normal = new THREE.Vector3(placement.normal.x, placement.normal.y, placement.normal.z).normalize();
  const inward = normal.clone().negate();
  const radius = diameterMm / 2;
  const outside = normal.z < -0.5 ? 0.02 : radius + 0.02;
  const origin = point.clone().addScaledVector(normal, outside);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  let exit: THREE.Intersection | undefined;
  let extraDepth = 0.04;
  try {
    const caster = new THREE.Raycaster(origin, inward);
    const hits = caster.intersectObject(new THREE.Mesh(bowl, material));
    const entry = hits[0];
    if (entry && Math.abs(entry.distance - outside) < 0.03) {
      exit = hits.find((hit) => hit.distance > entry.distance + 0.001);
      if (exit && normal.z > -0.5) {
        const nextWall = hits.find((hit) => hit.distance > exit!.distance + 0.001);
        extraDepth = Math.min(radius + 0.04, nextWall ? (nextWall.distance - exit.distance) / 2 : radius + 0.04);
      }
    }
  } finally {
    material.dispose();
  }
  const hole: CableHole = { placement, diameterMm, warning: null };
  const probe = exit?.point.clone().addScaledVector(inward, 0.02);
  if (!exit || !probe || !contains(cavity, probe) || probe.z < floorZ || probe.z >= seatZ) {
    hole.warning = 'This position does not open into the cavity. Move the hole onto the back or a side wall below the lid.';
    return { geometry: bowl, hole };
  }
  if (normal.z < -0.5) {
    const circle = [toClipperPath(Array.from({ length: 64 }, (_, i) => new THREE.Vector2(point.x + radius * Math.cos(i * Math.PI / 32), point.y + radius * Math.sin(i * Math.PI / 32))))];
    if (!regionIsEmpty(subtractRegions(circle, cavity))) hole.warning = 'Part of the hole meets the cavity wall. Move it farther inside the back or reduce its diameter.';
  } else if (point.z - radius < floorZ || point.z + radius >= seatZ) {
    hole.warning = 'The hole overlaps the back floor or lid seat. Move it between them or reduce its diameter.';
  }
  const depth = exit.distance + extraDepth;
  const geometry = withSolidGeometry((engine, track, fromGeometry, toGeometry) => {
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), inward);
    const transform = new THREE.Matrix4().compose(origin, rotation, new THREE.Vector3(1, 1, 1));
    const cylinder = track(engine.Manifold.cylinder(depth, radius, radius, 64));
    const cutter = track(cylinder.transform(transform.toArray() as Mat4));
    return toGeometry(track(fromGeometry(bowl).subtract(cutter)));
  });
  return { geometry, hole };
}
