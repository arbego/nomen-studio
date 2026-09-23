import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Pick, TopperConfig } from '../../geometry/types';
import { pickToStlBinary, outlineToStlBinary, slugifyFilename } from '../../export/stlExport';

interface ExportButtonsProps {
  picks: Pick[];
  config: TopperConfig;
  designName: string;
  disabled: boolean;
}

export function ExportButtons({ picks, config, designName, disabled }: ExportButtonsProps) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    const pick = picks[0];
    if (!pick) return;
    setBusy(true);
    try {
      const name = slugifyFilename(designName);
      const wordDv = pickToStlBinary(pick, config);
      const outlineDv = outlineToStlBinary(pick, config);

      if (!outlineDv) {
        // Just the word — the common case, and no reason to make it a zip.
        saveAs(new Blob([wordDv.buffer as ArrayBuffer], { type: 'model/stl' }), `${name}-topper.stl`);
        return;
      }

      // Two separate printable pieces (e.g. for two different filament
      // colors) — bundle them together instead of triggering two downloads.
      const zip = new JSZip();
      zip.file(`${name}.stl`, wordDv.buffer as ArrayBuffer);
      zip.file(`${name}-outline.stl`, outlineDv.buffer as ArrayBuffer);
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${name}-topper.zip`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled || picks.length === 0 || busy}
      className="rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? 'Preparing…' : config.outlineEnabled ? 'Export .zip' : 'Export .stl'}
    </button>
  );
}
