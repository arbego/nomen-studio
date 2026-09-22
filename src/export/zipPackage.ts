import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Pick, TopperConfig } from '../geometry/types';
import { pickToStlBinary, picksToCombinedStlBinary, slugifyFilename } from './stlExport';

/** Default export: one binary STL per pick, zipped — matches how the picks are actually printed. */
export async function exportPicksAsZip(picks: Pick[], config: TopperConfig, designName: string): Promise<void> {
  const zip = new JSZip();
  for (const pick of pickToStlEntries(picks, config)) {
    zip.file(pick.filename, pick.data);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${slugifyFilename(designName)}-topper.zip`);
}

/** Alternative export: every pick laid out on one bed, as a single STL file. */
export function exportPicksAsCombinedStl(picks: Pick[], config: TopperConfig, designName: string): void {
  const dataView = picksToCombinedStlBinary(picks, config);
  const blob = new Blob([dataView.buffer as ArrayBuffer], { type: 'model/stl' });
  saveAs(blob, `${slugifyFilename(designName)}-topper-combined.stl`);
}

function pickToStlEntries(picks: Pick[], config: TopperConfig) {
  return picks.map((pick) => {
    const dataView = pickToStlBinary(pick, config);
    return {
      filename: `${slugifyFilename(pick.label || pick.id)}.stl`,
      data: dataView.buffer as ArrayBuffer,
    };
  });
}
