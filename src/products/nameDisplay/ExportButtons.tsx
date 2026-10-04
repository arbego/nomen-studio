import { useState } from 'react';
import { saveAs } from 'file-saver';
import { slugifyFilename } from '../../export/stlExport';
import { threeMfBlob } from '../../export/threeMfExport';
import { combined3mfBinary } from './export';
import type { NameDisplayAssembly, NameDisplayBlocks } from './geometry';
import type { NameDisplayConfig } from './config';

interface ExportButtonsProps {
  blocks: NameDisplayBlocks | null;
  assembly: NameDisplayAssembly | null;
  config: NameDisplayConfig;
  disabled: boolean;
}

/** One file for the whole design, the two pieces in it as two colored objects — see export.ts. */
export function ExportButtons({ blocks, assembly, config, disabled }: ExportButtonsProps) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function handleExport() {
    if (!blocks || !assembly) return;
    setBusy(true);
    setFailure(null);
    try {
      const base = slugifyFilename(config.name, 'name-display');
      saveAs(threeMfBlob(combined3mfBinary(blocks, assembly, config)), `${base}-display.3mf`);
    } catch {
      // Reachable with a flat cut set high enough to remove every letter, which
      // leaves nothing solid to write — a design problem, not a crash.
      setFailure("Nothing to export. Check the standing cut isn't above the lettering.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {failure && <p className="text-sm text-red-600">{failure}</p>}
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || !blocks || !assembly || busy}
        className="rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Preparing…' : 'Export .3mf'}
      </button>
    </div>
  );
}
