import { threeMfBinary } from '../../export/threeMfExport';
import type { StickyNameConfig } from './config';
import type { StickyNameGeometry } from './geometry';
import { BufferAttribute } from 'three';

export function stickyName3mf(result: StickyNameGeometry, config: StickyNameConfig): Uint8Array {
  if (!result.canExport) throw new Error('Resolve the magnet placement warnings before exporting.');
  const objects = result.letters.map((letter) => {
    const geometry = letter.geometry.clone();
    // Keep translation in double precision: rounding back to float32 at a large
    // layout offset can merge nearby level-set vertices before serialization.
    geometry.setAttribute('position', new BufferAttribute(new Float64Array(geometry.getAttribute('position').array), 3));
    geometry.translate(letter.x, 0, 0);
    return {
    name: `${letter.index + 1} — ${letter.char}${letter.magnets.length ? ` (pause before covering ${[...new Set(letter.magnets.map((m) => m.pauseHeightMm.toFixed(2)))].join(', ')} mm)` : ''}`,
    color: config.previewColor,
    geometry,
  }; });
  try { return threeMfBinary(objects, `${config.name} — Sticky Name`, { separateModels: true, singleFilament: true, preserveVertexPrecision: true }); }
  finally { for (const object of objects) object.geometry.dispose(); }
}
