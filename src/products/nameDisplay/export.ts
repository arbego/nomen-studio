import { geometryToStlBinary } from '../../export/stlExport';
import { initialPrintGeometry, namePrintGeometry, type NameDisplayGeometry } from './geometry';
import type { NameDisplayConfig } from './config';

/**
 * The two pieces export as two files, not one: they print in different
 * filaments and, because the name drops into the initial's pocket, they are
 * genuinely separate solids rather than one model that happens to be two
 * colors.
 */
export function initialStlBinary(built: NameDisplayGeometry, config: NameDisplayConfig): DataView {
  return geometryToStlBinary(initialPrintGeometry(built, config));
}

export function nameStlBinary(built: NameDisplayGeometry, config: NameDisplayConfig): DataView {
  return geometryToStlBinary(namePrintGeometry(built, config));
}
