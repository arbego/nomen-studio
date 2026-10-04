import { threeMfBinary, type ThreeMfObject } from '../../export/threeMfExport';
import { initialPrintGeometry, placedNameGeometry, type NameDisplayAssembly, type NameDisplayBlocks } from './geometry';
import type { NameDisplayConfig } from './config';

/**
 * The design's two pieces, each in its own color, positioned as they are
 * assembled — the initial with its pocket and rail, and the name seated in the
 * recess cut for it.
 */
export function printObjects(blocks: NameDisplayBlocks, assembly: NameDisplayAssembly, config: NameDisplayConfig): ThreeMfObject[] {
  return [
    { name: `${config.initial} (initial)`, color: config.initialColor, geometry: initialPrintGeometry(blocks, assembly, config) },
    { name: `${config.name} (name)`, color: config.nameColor, geometry: placedNameGeometry(blocks, assembly, config) },
  ];
}

/**
 * The whole design as one .3mf: two named objects, two colors, already fitted
 * together.
 *
 * Not an STL, because an STL cannot say any of that. It has no objects and no
 * colors, and splitting one in a slicer splits by connected shell — which here
 * means the back slab, every island the pocket cut the front slab into, and
 * every letter of the name, a dozen-odd pieces to sort out by hand. The fit
 * between the two pieces is the one thing this app knows and the person at the
 * printer does not, so it is worth a format that can carry it.
 */
export function combined3mfBinary(blocks: NameDisplayBlocks, assembly: NameDisplayAssembly, config: NameDisplayConfig): Uint8Array {
  return threeMfBinary(printObjects(blocks, assembly, config), `${config.initial} — ${config.name}`);
}
