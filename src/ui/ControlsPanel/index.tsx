import type { Pick, PickId, TopperConfig } from '../../geometry/types';
import { detectOutlineHoleCandidates } from '../../geometry/outline';
import { LinesControls } from './LinesControls';
import { FontPicker } from './FontPicker';
import { SizePicker } from './SizePicker';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { StickControls } from './StickControls';
import { OutlineControls } from './OutlineControls';
import { ExportButtons } from './ExportButtons';

interface ControlsPanelProps {
  config: TopperConfig;
  onChange: (partial: Partial<TopperConfig>) => void;
  picks: Pick[];
  loading: boolean;
  error: string | null;
  onAddStick: (pickId: PickId) => void;
  onRemoveStick: (pickId: PickId, index: number) => void;
  onSetSticksEnabled: (pickId: PickId, enabled: boolean) => void;
  onChangeLine: (index: number, text: string) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onResetLetterGaps: () => void;
  onToggleClosedOutlineHole: (key: string) => void;
}

export function ControlsPanel({
  config,
  onChange,
  picks,
  loading,
  error,
  onAddStick,
  onRemoveStick,
  onSetSticksEnabled,
  onChangeLine,
  onAddLine,
  onRemoveLine,
  onResetLetterGaps,
  onToggleClosedOutlineHole,
}: ControlsPanelProps) {
  const hasCustomLetterGaps = config.letterGapsMm.some((gaps) => gaps.some((gap) => gap !== 0));
  const wordPick = picks.find((p) => p.id === 'word');
  const outlineHoleCandidates =
    config.outlineEnabled && wordPick ? detectOutlineHoleCandidates(wordPick, config.letterGapsMm, config.lineOffsets, config.outlineGrowMm) : [];

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Cake Topper Studio</h1>
        <p className="text-sm text-stone-500">Design a personalized topper and export it print-ready.</p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <LinesControls lines={config.lines} onChangeLine={onChangeLine} onAddLine={onAddLine} onRemoveLine={onRemoveLine} />
          <FontPicker
            label="Font"
            value={config.wordFontId}
            onChange={(wordFontId) => onChange({ wordFontId })}
            previewText={config.lines[0] || 'Emma'}
          />
          <p className="-mt-2 flex items-center justify-between text-xs text-stone-400">
            <span>Drag a letter in the preview to close its gap, or the first letter of a line to move the whole line.</span>
            {hasCustomLetterGaps && (
              <button type="button" onClick={onResetLetterGaps} className="text-stone-500 underline decoration-dotted underline-offset-2 hover:text-stone-800">
                Reset spacing
              </button>
            )}
          </p>
        </div>

        <SizePicker
          value={config.sizeMm}
          onChange={(sizeMm) => onChange({ sizeMm })}
          depthMm={config.extrudeDepthMm}
          onChangeDepth={(extrudeDepthMm) => onChange({ extrudeDepthMm })}
          className="border-t border-stone-100 pt-5"
        />
        <ColorSwatchPicker value={config.previewColor} onChange={(previewColor) => onChange({ previewColor })} className="border-t border-stone-100 pt-5" />
        <StickControls
          enabled={config.stickOffsets.word.length > 0}
          onChangeEnabled={(enabled) => onSetSticksEnabled('word', enabled)}
          widthMm={config.stickWidthMm}
          lengthMm={config.stickLengthMm}
          onChangeWidth={(stickWidthMm) => onChange({ stickWidthMm })}
          onChangeLength={(stickLengthMm) => onChange({ stickLengthMm })}
          stickCounts={{ word: config.stickOffsets.word.length }}
          onAddStick={onAddStick}
          onRemoveStick={(pickId) => onRemoveStick(pickId, config.stickOffsets[pickId].length - 1)}
          className="border-t border-stone-100 pt-5"
        />
        <OutlineControls
          enabled={config.outlineEnabled}
          onChangeEnabled={(outlineEnabled) => onChange({ outlineEnabled })}
          growMm={config.outlineGrowMm}
          onChangeGrow={(outlineGrowMm) => onChange({ outlineGrowMm })}
          color={config.outlineColor}
          onChangeColor={(outlineColor) => onChange({ outlineColor })}
          depthMm={config.outlineDepthMm}
          onChangeDepth={(outlineDepthMm) => onChange({ outlineDepthMm })}
          maxDepthMm={config.extrudeDepthMm}
          holeCandidates={outlineHoleCandidates}
          closedOutlineHoles={config.closedOutlineHoles}
          onToggleHole={onToggleClosedOutlineHole}
          className="border-t border-stone-100 pt-5"
        />
      </div>

      <div className="mt-auto border-t border-stone-200 pt-4">
        {error && <p className="pb-2 text-sm text-red-600">{error}</p>}
        {loading && !error && <p className="pb-2 text-sm text-stone-400">Generating geometry…</p>}
        <ExportButtons picks={picks} config={config} designName={config.lines.join(' ')} disabled={loading || !!error} />
      </div>
    </div>
  );
}
