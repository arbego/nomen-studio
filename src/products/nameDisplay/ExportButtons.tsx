import { useState } from 'react';
import { saveAs } from 'file-saver';
import { slugifyFilename, stlBlob } from '../../export/stlExport';
import { initialStlBinary, nameStlBinary } from './export';
import type { NameDisplayGeometry } from './geometry';
import type { NameDisplayConfig } from './config';

interface ExportButtonsProps {
  built: NameDisplayGeometry | null;
  config: NameDisplayConfig;
  disabled: boolean;
}

/** Two files, because the two pieces print separately in different filaments and slot together. */
export function ExportButtons({ built, config, disabled }: ExportButtonsProps) {
  const [busy, setBusy] = useState(false);

  function save(which: 'initial' | 'name') {
    if (!built) return;
    setBusy(true);
    try {
      const base = slugifyFilename(config.name, 'name-display');
      const data = which === 'initial' ? initialStlBinary(built, config) : nameStlBinary(built, config);
      saveAs(stlBlob(data), `${base}-${which}.stl`);
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    'flex-1 rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => save('initial')} disabled={disabled || !built || busy} className={buttonClass}>
        {busy ? 'Preparing…' : 'Letter .stl'}
      </button>
      <button type="button" onClick={() => save('name')} disabled={disabled || !built || busy} className={buttonClass}>
        {busy ? 'Preparing…' : 'Name .stl'}
      </button>
    </div>
  );
}
