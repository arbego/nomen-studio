import { useState } from 'react';
import type { Pick, TopperConfig } from '../../geometry/types';
import { exportPicksAsZip, exportPicksAsCombinedStl } from '../../export/zipPackage';

interface ExportButtonsProps {
  picks: Pick[];
  config: TopperConfig;
  designName: string;
  disabled: boolean;
}

export function ExportButtons({ picks, config, designName, disabled }: ExportButtonsProps) {
  const [busy, setBusy] = useState<'zip' | 'combined' | null>(null);

  async function handleZip() {
    setBusy('zip');
    try {
      await exportPicksAsZip(picks, config, designName);
    } finally {
      setBusy(null);
    }
  }

  function handleCombined() {
    setBusy('combined');
    try {
      exportPicksAsCombinedStl(picks, config, designName);
    } finally {
      setBusy(null);
    }
  }

  const isDisabled = disabled || picks.length === 0 || busy !== null;

  return (
    <div className="flex flex-col gap-2 pt-2">
      <button
        type="button"
        onClick={handleZip}
        disabled={isDisabled}
        className="rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy === 'zip' ? 'Preparing…' : `Export STLs (.zip, ${picks.length} picks)`}
      </button>
      <button
        type="button"
        onClick={handleCombined}
        disabled={isDisabled}
        className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy === 'combined' ? 'Preparing…' : 'Export combined .stl'}
      </button>
    </div>
  );
}
