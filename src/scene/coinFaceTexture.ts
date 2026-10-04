import * as THREE from 'three';

const SIZE = 512;

/** The gold the face is stamped out of, and the shadow/highlight that make the stamp read as relief. */
const GOLD = '#e3bb58';
const RAISED = '#dcb249';
const SHADOW = 'rgba(96, 64, 12, 0.55)';
const HIGHLIGHT = 'rgba(255, 243, 212, 0.8)';

let cached: THREE.CanvasTexture | null | undefined;

/**
 * The face of the 2 euro coin, drawn rather than photographed.
 *
 * The designs on real euro coins are copyrighted by the ECB and the issuing
 * states, and the images of them floating around are licensed accordingly — not
 * something to bundle into an app. A stamped "2 €" of our own carries the only
 * information the coin is here to carry (this is a two euro piece, so that is
 * how big the print will be) and is ours to ship.
 *
 * Returns null where there is no canvas to draw on — the geometry tests render
 * this component in plain Node — and the coin then simply shows unstamped gold.
 */
export function coinFaceTexture(): THREE.CanvasTexture | null {
  if (cached !== undefined) return cached;

  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) {
    cached = null;
    return cached;
  }

  canvas.width = canvas.height = SIZE;
  const center = SIZE / 2;

  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // The cylinder's cap UVs inscribe the face in this square, so everything
  // drawn has to stay within the circle through the edge midpoints.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 250px Georgia, "Times New Roman", serif`;

  // Struck, not printed: a dark edge below and a bright one above turn flat
  // paint into something that catches the light like relief.
  const relief = 5;
  ctx.fillStyle = SHADOW;
  ctx.fillText('2 €', center, center + relief);
  ctx.fillStyle = HIGHLIGHT;
  ctx.fillText('2 €', center, center - relief);
  ctx.fillStyle = RAISED;
  ctx.fillText('2 €', center, center);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cached = texture;
  return cached;
}
