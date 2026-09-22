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
}

/**
 * A simple rectangular pick stick, anchored at the same origin convention as
 * extrudeShapesToMm: y=0 is where the piece above it starts. The stick spans from
 * y = -(lengthMm - embedMm) up to y = +embedMm, so it has real volumetric overlap
 * with the piece it's merged with (see combine.ts) rather than a bare tangent touch.
 */
export function stickToGeometry(options: StickOptions): THREE.BufferGeometry {
  const { lengthMm, widthMm, thicknessMm, embedMm, offsetXMm = 0 } = options;
  if (embedMm >= lengthMm) {
    throw new Error('embedMm must be smaller than the total stick lengthMm');
  }

  const geometry = new THREE.BoxGeometry(widthMm, lengthMm, thicknessMm);
  const bottomY = -(lengthMm - embedMm);
  const centerY = bottomY + lengthMm / 2;
  geometry.translate(offsetXMm, centerY, thicknessMm / 2);
  return geometry.index ? geometry.toNonIndexed() : geometry;
}
