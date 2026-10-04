import { geometryToStlBinary } from '../../export/stlExport';
import { assembledPrintGeometry, type NameDisplayAssembly, type NameDisplayBlocks } from './geometry';
import type { NameDisplayConfig } from './config';

/**
 * Binary STL bytes for the whole design in one file: the pocketed initial with
 * the name seated in its recess.
 *
 * STL carries no color, so one file loses nothing a pair of them would have
 * kept — and it keeps what a pair loses, which is how the two pieces sit
 * together. See assembledPrintGeometry for how a two-filament print gets its
 * two parts back out of it.
 */
export function combinedStlBinary(blocks: NameDisplayBlocks, assembly: NameDisplayAssembly, config: NameDisplayConfig): DataView {
  return geometryToStlBinary(assembledPrintGeometry(blocks, assembly, config));
}
