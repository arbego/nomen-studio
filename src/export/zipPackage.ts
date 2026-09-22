import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Pick } from '../geometry/types';
import { pickToStlBinary, picksToCombinedStlBinary, slugifyFilename } from './stlExport';

/** Default export: one binary STL per pick, zipped — matches how the picks are actually printed. */
export async function exportPicksAsZip(picks: Pick[], designName: string): Promise<void> {
  const zip = new JSZip();
  for (const pick of pickToStlEntries(picks)) {
    zip.file(pick.filename, pick.data);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${slugifyFilename(designName)}-topper.zip`);
}

/** Alternative export: every pick laid out on one bed, as a single STL file. */
export function exportPicksAsCombinedStl(picks: Pick[], designName: string): void {
  const dataView = picksToCombinedStlBinary(picks);
  const blob = new Blob([dataView.buffer as ArrayBuffer], { type: 'model/stl' });
  saveAs(blob, `${slugifyFilename(designName)}-topper-combined.stl`);
}

function pickToStlEntries(picks: Pick[]) {
  return picks.map((pick) => {
    const dataView = pickToStlBinary(pick);
    return {
      filename: `${slugifyFilename(pick.label || pick.id)}.stl`,
      data: dataView.buffer as ArrayBuffer,
    };
  });
}
