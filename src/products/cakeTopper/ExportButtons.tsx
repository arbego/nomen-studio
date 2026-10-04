import { useState } from 'react';
import { saveAs } from 'file-saver';
import type { TextBlock } from '../../geometry/types';
import type { CakeTopperConfig } from './config';
import { slugifyFilename } from '../../export/filename';
import { threeMfBlob } from '../../export/threeMfExport';
import { combined3mfBinary } from './export';

interface ExportButtonsProps {
  blocks: TextBlock[];
  config: CakeTopperConfig;
  designName: string;
  disabled: boolean;
}

/** One file for the whole topper, the lettering and its backing card as two colored parts — see export.ts. */
export function ExportButtons({ blocks, config, designName, disabled }: ExportButtonsProps) {
  const [busy, setBusy] = useState(false);

  function handleExport() {
    const block = blocks[0];
    if (!block) return;
    setBusy(true);
    try {
      const name = slugifyFilename(designName, 'topper');
      saveAs(threeMfBlob(combined3mfBinary(block, config, designName)), `${name}-topper.3mf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled || blocks.length === 0 || busy}
      className="w-full rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? 'Preparing…' : 'Export .3mf'}
    </button>
  );
}
