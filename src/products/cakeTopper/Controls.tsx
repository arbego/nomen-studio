import { useShallow } from 'zustand/react/shallow';
import { detectOutlineHoleCandidates } from '../../geometry/outline';
import { LinesControls } from '../../ui/controls/LinesControls';
import { FontPicker } from '../../ui/controls/FontPicker';
import { SizePicker } from '../../ui/controls/SizePicker';
import { ColorSwatchPicker } from '../../ui/controls/ColorSwatchPicker';
import { StickControls } from './StickControls';
import { OutlineControls } from '../../ui/controls/OutlineControls';
import { ExportButtons } from './ExportButtons';
import { useCakeTopperStore, selectCakeTopperConfig } from './store';
import { useCakeTopperGeometry } from './geometryContext';

export function CakeTopperControls() {
  const config = useCakeTopperStore(useShallow(selectCakeTopperConfig));
  const onChange = useCakeTopperStore((s) => s.setConfig);
  const onAddStick = useCakeTopperStore((s) => s.addStick);
  const onRemoveStick = useCakeTopperStore((s) => s.removeStick);
  const onSetSticksEnabled = useCakeTopperStore((s) => s.setSticksEnabled);
  const onChangeLine = useCakeTopperStore((s) => s.setLineText);
  const onAddLine = useCakeTopperStore((s) => s.addLine);
  const onRemoveLine = useCakeTopperStore((s) => s.removeLine);
  const onResetLetterGaps = useCakeTopperStore((s) => s.resetLetterGaps);
  const onToggleClosedOutlineHole = useCakeTopperStore((s) => s.toggleClosedOutlineHole);
  const { blocks, loading, error } = useCakeTopperGeometry();

  const hasCustomLetterGaps = config.letterGapsMm.some((gaps) => gaps.some((gap) => gap !== 0));
  const wordBlock = blocks.find((p) => p.id === 'word');
  const outlineHoleCandidates =
    config.outlineEnabled && wordBlock ? detectOutlineHoleCandidates(wordBlock, config.letterGapsMm, config.lineOffsets, config.outlineGrowMm) : [];

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <LinesControls lines={config.lines} onChangeLine={onChangeLine} onAddLine={onAddLine} onRemoveLine={onRemoveLine} />
          <FontPicker
            label="Font"
            value={config.wordFontId}
            onChange={(wordFontId) => onChange({ wordFontId })}
            previewText={config.lines[0] || 'Emma'}
          />
          <p className="-mt-2 flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
            <span>Drag a letter in the preview to close its gap, or the first letter of a line to move the whole line.</span>
            {hasCustomLetterGaps && (
              <button type="button" onClick={onResetLetterGaps} className="text-stone-500 dark:text-stone-400 underline decoration-dotted underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200">
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
          className="border-t border-stone-100 dark:border-stone-800 pt-5"
        />
        <ColorSwatchPicker value={config.previewColor} onChange={(previewColor) => onChange({ previewColor })} className="border-t border-stone-100 dark:border-stone-800 pt-5" />
        <StickControls
          enabled={config.stickOffsets.word.length > 0}
          onChangeEnabled={(enabled) => onSetSticksEnabled('word', enabled)}
          widthMm={config.stickWidthMm}
          lengthMm={config.stickLengthMm}
          onChangeWidth={(stickWidthMm) => onChange({ stickWidthMm })}
          onChangeLength={(stickLengthMm) => onChange({ stickLengthMm })}
          stickCounts={{ word: config.stickOffsets.word.length }}
          onAddStick={onAddStick}
          onRemoveStick={(blockId) => onRemoveStick(blockId, config.stickOffsets[blockId].length - 1)}
          className="border-t border-stone-100 dark:border-stone-800 pt-5"
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
          className="border-t border-stone-100 dark:border-stone-800 pt-5"
        />
      </div>

      <div className="mt-auto border-t border-stone-200 dark:border-stone-700 pt-4">
        {error && <p className="pb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {loading && !error && <p className="pb-2 text-sm text-stone-400 dark:text-stone-500">Generating geometry…</p>}
        <ExportButtons blocks={blocks} config={config} designName={config.lines.join(' ')} disabled={loading || !!error} />
      </div>
    </div>
  );
}
