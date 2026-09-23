import type { Pick, PickId, TopperConfig } from '../../geometry/types';
import { TextField } from './TextField';
import { FontPicker } from './FontPicker';
import { SizePicker } from './SizePicker';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { StickControls } from './StickControls';
import { ExportButtons } from './ExportButtons';

interface ControlsPanelProps {
  config: TopperConfig;
  onChange: (partial: Partial<TopperConfig>) => void;
  picks: Pick[];
  loading: boolean;
  error: string | null;
  onAddStick: (pickId: PickId) => void;
  onRemoveStick: (pickId: PickId, index: number) => void;
  onResetLetterGaps: () => void;
}

export function ControlsPanel({ config, onChange, picks, loading, error, onAddStick, onRemoveStick, onResetLetterGaps }: ControlsPanelProps) {
  const hasCustomLetterGaps = config.letterGapsMm.some((gap) => gap !== 0);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">Cake Topper Studio</h1>
        <p className="text-sm text-stone-500">Design a personalized topper and export it print-ready.</p>
      </div>

      <div className="flex flex-col gap-4">
        <TextField label="Name" value={config.word} onChange={(word) => onChange({ word })} maxLength={16} placeholder="Emma" />
        <FontPicker label="Name font" category="script" value={config.wordFontId} onChange={(wordFontId) => onChange({ wordFontId })} />
        <p className="-mt-2 flex items-center justify-between text-xs text-stone-400">
          <span>Drag a letter in the preview to close its gap.</span>
          {hasCustomLetterGaps && (
            <button type="button" onClick={onResetLetterGaps} className="text-stone-500 underline decoration-dotted underline-offset-2 hover:text-stone-800">
              Reset spacing
            </button>
          )}
        </p>

        <SizePicker value={config.sizeMm} onChange={(sizeMm) => onChange({ sizeMm })} />
        <ColorSwatchPicker value={config.previewColor} onChange={(previewColor) => onChange({ previewColor })} />
        <StickControls
          widthMm={config.stickWidthMm}
          lengthMm={config.stickLengthMm}
          onChangeWidth={(stickWidthMm) => onChange({ stickWidthMm })}
          onChangeLength={(stickLengthMm) => onChange({ stickLengthMm })}
          stickCounts={{ word: config.stickOffsets.word.length }}
          onAddStick={onAddStick}
          onRemoveStick={(pickId) => onRemoveStick(pickId, config.stickOffsets[pickId].length - 1)}
        />
      </div>

      <div className="mt-auto border-t border-stone-200 pt-4">
        {error && <p className="pb-2 text-sm text-red-600">{error}</p>}
        {loading && !error && <p className="pb-2 text-sm text-stone-400">Generating geometry…</p>}
        <ExportButtons picks={picks} config={config} designName={config.word} disabled={loading || !!error} />
      </div>
    </div>
  );
}
