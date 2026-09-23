import { useState } from 'react';
import { saveAs } from 'file-saver';
import type { Pick, TopperConfig } from '../../geometry/types';
import { pickToStlBinary, slugifyFilename } from '../../export/stlExport';

interface ExportButtonsProps {
  picks: Pick[];
  config: TopperConfig;
  designName: string;
  disabled: boolean;
}

export function ExportButtons({ picks, config, designName, disabled }: ExportButtonsProps) {
  const [busy, setBusy] = useState(false);

  function handleExport() {
    const pick = picks[0];
    if (!pick) return;
    setBusy(true);
    try {
      const dataView = pickToStlBinary(pick, config);
      const blob = new Blob([dataView.buffer as ArrayBuffer], { type: 'model/stl' });
      saveAs(blob, `${slugifyFilename(designName)}-topper.stl`);
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
      {busy ? 'Preparing…' : 'Export .stl'}
    </button>
  );
}
