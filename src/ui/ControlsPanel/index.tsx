import type { Pick, TopperConfig } from '../../geometry/types';
import { TextField } from './TextField';
import { FontPicker } from './FontPicker';
import { AccentShapePicker } from './AccentShapePicker';
import { SizePicker } from './SizePicker';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { ExportButtons } from './ExportButtons';

interface ControlsPanelProps {
  config: TopperConfig;
  onChange: (partial: Partial<TopperConfig>) => void;
  picks: Pick[];
  loading: boolean;
  error: string | null;
}

export function ControlsPanel({ config, onChange, picks, loading, error }: ControlsPanelProps) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">Cake Topper Studio</h1>
        <p className="text-sm text-stone-500">Design a personalized topper and export it print-ready.</p>
      </div>

      <div className="flex flex-col gap-4">
        <TextField label="Name" value={config.word} onChange={(word) => onChange({ word })} maxLength={16} placeholder="Emma" />
        <FontPicker label="Name font" category="script" value={config.wordFontId} onChange={(wordFontId) => onChange({ wordFontId })} />

        <TextField label="Age" value={config.number} onChange={(number) => onChange({ number })} maxLength={4} placeholder="6" />
        <FontPicker label="Age font" category="sans" value={config.numberFontId} onChange={(numberFontId) => onChange({ numberFontId })} />

        <AccentShapePicker value={config.accentShapeId} onChange={(accentShapeId) => onChange({ accentShapeId })} />
        <SizePicker value={config.sizeMm} onChange={(sizeMm) => onChange({ sizeMm })} />
        <ColorSwatchPicker value={config.previewColor} onChange={(previewColor) => onChange({ previewColor })} />
      </div>

      <div className="mt-auto border-t border-stone-200 pt-4">
        {error && <p className="pb-2 text-sm text-red-600">{error}</p>}
        {loading && !error && <p className="pb-2 text-sm text-stone-400">Generating geometry…</p>}
        <ExportButtons picks={picks} designName={`${config.word}-${config.number}`} disabled={loading || !!error} />
      </div>
    </div>
  );
}
