import * as THREE from 'three';
import type { StickOffset } from './types';

export interface StickOptions {
  /** Total visible length of the stick, in mm (handle + embedded portion). */
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  /** How far the stick extends upward past the attach point to overlap into the piece above it. */
  embedMm: number;
  /** Where the stick attaches to the piece above it, in the piece's local mm space. */
  offset?: StickOffset;
  /** Number of segments used to approximate the rounded tip's curve. */
  curveSegments?: number;
}

const DEFAULT_CURVE_SEGMENTS = 12;
const DEFAULT_OFFSET: StickOffset = { x: 0, y: 0 };

/**
 * A pick stick with a flat top (embedded in the piece above, so its shape doesn't
 * matter) and a rounded, bullet-nose bottom tip — both easier and safer to push
 * into a cake, and free of the sharp edges a plain box tip leaves.
 *
 * `offset` is the attach point, anywhere on the piece above (not just its bottom
 * center) — the stick spans from `offset.y - (lengthMm - embedMm)` up to
 * `offset.y + embedMm`, so it always has real volumetric overlap with the piece
 * it's merged with (see combine.ts) rather than a bare tangent touch, no matter
 * where on the piece it attaches.
 */
export function stickToGeometry(options: StickOptions): THREE.BufferGeometry {
  const { lengthMm, widthMm, thicknessMm, embedMm, offset = DEFAULT_OFFSET, curveSegments = DEFAULT_CURVE_SEGMENTS } = options;
  if (embedMm >= lengthMm) {
    throw new Error('embedMm must be smaller than the total stick lengthMm');
  }
  const radius = widthMm / 2;
  if (radius <= 0) {
    throw new Error('widthMm must be positive');
  }

  // Local profile: straight sides from the rounded tip (local y=0) up to the
  // flat top (local y=lengthMm), y-up, tip centered on x=0.
  const shape = new THREE.Shape();
  shape.moveTo(-radius, lengthMm);
  shape.lineTo(-radius, radius);
  shape.absarc(0, radius, radius, Math.PI, 2 * Math.PI, false);
  shape.lineTo(radius, lengthMm);
  shape.closePath();

  let geometry: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: thicknessMm,
    bevelEnabled: false,
    curveSegments,
  });
  if (geometry.index) {
    geometry = geometry.toNonIndexed();
  }

  const bottomY = offset.y - (lengthMm - embedMm);
  geometry.translate(offset.x, bottomY, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Keeps a (possibly stale, e.g. from before the word/size changed, or a drag that
 * momentarily went past the edge) stick offset within the piece it's attached to:
 * x is clamped so the stick's full width stays under the piece, and y so the
 * whole embedded portion stays within the piece's vertical extent. Falls back to
 * centering on that axis when the piece is smaller than the stick itself.
 */
export function clampStickOffsetToBounds(mainGeometry: THREE.BufferGeometry, offset: StickOffset, stickWidthMm: number, embedMm: number): StickOffset {
  mainGeometry.computeBoundingBox();
  const bb = mainGeometry.boundingBox!;

  const xMargin = stickWidthMm / 2;
  const xMin = bb.min.x + xMargin;
  const xMax = bb.max.x - xMargin;
  const x = xMin > xMax ? (bb.min.x + bb.max.x) / 2 : Math.min(Math.max(offset.x, xMin), xMax);

  const yMin = bb.min.y;
  const yMax = bb.max.y - embedMm;
  const y = yMin > yMax ? (bb.min.y + bb.max.y) / 2 : Math.min(Math.max(offset.y, yMin), yMax);

  return { x, y };
}
