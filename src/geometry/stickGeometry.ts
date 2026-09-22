import * as THREE from 'three';

export interface StickOptions {
  /** Total visible length of the stick, in mm (handle + embedded portion). */
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  /** How far the stick extends upward past y=0 to overlap into the piece above it. */
  embedMm: number;
  /** Horizontal offset of the stick's center from x=0. */
  offsetXMm?: number;
  /** Number of segments used to approximate the rounded tip's curve. */
  curveSegments?: number;
}

const DEFAULT_CURVE_SEGMENTS = 12;

/**
 * A pick stick with a flat top (embedded in the piece above, so its shape doesn't
 * matter) and a rounded, bullet-nose bottom tip — both easier and safer to push
 * into a cake, and free of the sharp edges a plain box tip leaves.
 *
 * Anchored at the same origin convention as extrudeShapesToMm: y=0 is where the
 * piece above it starts. The stick spans from y = -(lengthMm - embedMm) up to
 * y = +embedMm, so it has real volumetric overlap with the piece it's merged
 * with (see combine.ts) rather than a bare tangent touch.
 */
export function stickToGeometry(options: StickOptions): THREE.BufferGeometry {
  const { lengthMm, widthMm, thicknessMm, embedMm, offsetXMm = 0, curveSegments = DEFAULT_CURVE_SEGMENTS } = options;
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

  const bottomY = -(lengthMm - embedMm);
  geometry.translate(offsetXMm, bottomY, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Keeps a (possibly stale, e.g. from before the word/size changed) stick offset
 * within the piece it's attached to, so the stick can never end up hanging off
 * the side into empty space. Falls back to centering when the piece is narrower
 * than the stick itself.
 */
export function clampStickOffsetToBounds(mainGeometry: THREE.BufferGeometry, offsetXMm: number, stickWidthMm: number): number {
  mainGeometry.computeBoundingBox();
  const bb = mainGeometry.boundingBox!;
  const margin = stickWidthMm / 2;
  const min = bb.min.x + margin;
  const max = bb.max.x - margin;
  if (min > max) {
    return (bb.min.x + bb.max.x) / 2;
  }
  return Math.min(Math.max(offsetXMm, min), max);
}
