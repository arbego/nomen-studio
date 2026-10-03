import { useState } from 'react';
import { saveAs } from 'file-saver';
import { slugifyFilename, stlBlob } from '../../export/stlExport';
import { initialStlBinary, nameStlBinary } from './export';
import type { NameDisplayAssembly, NameDisplayBlocks } from './geometry';
import type { NameDisplayConfig } from './config';

interface ExportButtonsProps {
  blocks: NameDisplayBlocks | null;
  assembly: NameDisplayAssembly | null;
  config: NameDisplayConfig;
  disabled: boolean;
}

/** Two files, because the two pieces print separately in different filaments and slot together. */
export function ExportButtons({ blocks, assembly, config, disabled }: ExportButtonsProps) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function save(which: 'initial' | 'name') {
    if (!blocks || !assembly) return;
    setBusy(true);
    setFailure(null);
    try {
      const base = slugifyFilename(config.name, 'name-display');
      const data = which === 'initial' ? initialStlBinary(blocks, assembly, config) : nameStlBinary(blocks, config);
      saveAs(stlBlob(data), `${base}-${which}.stl`);
    } catch {
      // Reachable with a flat cut set high enough to remove every letter, which
      // leaves nothing solid to write — a design problem, not a crash.
      setFailure(`Nothing to export for the ${which}. Check the standing cut isn't above the lettering.`);
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    'flex-1 rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40';
  const ready = !disabled && !!blocks && !!assembly && !busy;

  return (
    <div className="flex flex-col gap-2">
      {failure && <p className="text-sm text-red-600">{failure}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => save('initial')} disabled={!ready} className={buttonClass}>
          {busy ? 'Preparing…' : 'Letter .stl'}
        </button>
        <button type="button" onClick={() => save('name')} disabled={!ready} className={buttonClass}>
          {busy ? 'Preparing…' : 'Name .stl'}
        </button>
      </div>
    </div>
  );
}
