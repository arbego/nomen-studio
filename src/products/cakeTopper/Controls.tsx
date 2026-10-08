import { useState } from 'react';
import { ControlPane } from '../../ui/controls/ControlPane';
import { useShallow } from 'zustand/react/shallow';
import { detectOutlineHoleCandidates } from '../../geometry/outline';
import { LinesControls } from '../../ui/controls/LinesControls';
import { FontField } from '../../ui/controls/FontField';
import { SizePicker } from '../../ui/controls/SizePicker';
import { ColorSwatchPicker } from '../../ui/controls/ColorSwatchPicker';
import { CollapsibleSection } from '../../ui/controls/CollapsibleSection';
import { FocusTarget } from '../../ui/FocusTarget';
import { StickControls } from './StickControls';
import { DecoratorControls } from './DecoratorControls';
import { OutlineControls } from '../../ui/controls/OutlineControls';
import { useCakeTopperStore, selectCakeTopperConfig } from './store';
import { useCakeTopperGeometry } from './geometryContext';
import { lineFocusKey, SECTIONS } from './focus';
import { COLOR_PRESETS } from '../../ui/presets';

const SECTION = 'border-t border-stone-100 dark:border-stone-800 pt-5';

/** What a shut section says it is set to — enough to not have to open it to find out. */
function colorName(hex: string): string {
  return COLOR_PRESETS.find((color) => color.hex === hex)?.label ?? hex;
}

export function CakeTopperControls() {
  const [fontOpen, setFontOpen] = useState(false);
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
  const onSetClosedOutlineHoles = useCakeTopperStore((s) => s.setClosedOutlineHoles);
  const onAddDecorator = useCakeTopperStore((s) => s.addDecorator);
  const onUpdateDecorator = useCakeTopperStore((s) => s.updateDecorator);
  const onRemoveDecorator = useCakeTopperStore((s) => s.removeDecorator);
  const onSetDecoratorAngle = useCakeTopperStore((s) => s.setDecoratorAngle);
  const onSetDecoratorColor = useCakeTopperStore((s) => s.setDecoratorColor);
  const { blocks, loading, error } = useCakeTopperGeometry();

  const hasCustomLetterGaps = config.letterGapsMm.some((gaps) => gaps.some((gap) => gap !== 0));
  const wordBlock = blocks.find((p) => p.id === 'word');
  const outlineHoleCandidates =
    config.outlineEnabled && wordBlock ? detectOutlineHoleCandidates(wordBlock, config.letterGapsMm, config.lineOffsets, config.outlineGrowMm) : [];
  const stickCount = config.stickOffsets.word.length;

  return (
    <ControlPane loading={loading} error={error}>
      <div className="flex flex-col gap-5">
        <CollapsibleSection id={SECTIONS.text} title="Text" defaultOpen summary={config.lines.filter(Boolean).join(' ')}>
          <LinesControls lines={config.lines} onChangeLine={onChangeLine} onAddLine={onAddLine} onRemoveLine={onRemoveLine} focusKeyForLine={lineFocusKey} />
          <FontField
            label="Font"
            value={config.wordFontId}
            onChange={(wordFontId) => onChange({ wordFontId })}
            previewText={config.lines[0] || 'Emma'}
            open={fontOpen}
            onOpenChange={setFontOpen}
          />
          <p className="-mt-2 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span>Drag a letter in the preview to close its gap, or the first letter of a line to move the whole line.</span>
            {hasCustomLetterGaps && (
              <button type="button" onClick={onResetLetterGaps} className="control-action">
                Reset spacing
              </button>
            )}
          </p>
        </CollapsibleSection>

        <CollapsibleSection id={SECTIONS.size} title="Size" summary={`${config.sizeMm} mm wide, ${config.extrudeDepthMm} mm thick`} className={SECTION}>
          <SizePicker
            label={null}
            value={config.sizeMm}
            onChange={(sizeMm) => onChange({ sizeMm })}
            depthMm={config.extrudeDepthMm}
            onChangeDepth={(extrudeDepthMm) => onChange({ extrudeDepthMm })}
          />
        </CollapsibleSection>

        <FocusTarget focusKey={SECTIONS.color} className={SECTION}>
          <ColorSwatchPicker label="Color" value={config.previewColor} onChange={(previewColor) => onChange({ previewColor })} />
        </FocusTarget>

        <CollapsibleSection id={SECTIONS.sticks} title="Sticks" summary={stickCount === 0 ? 'None' : `${stickCount}, ${config.stickLengthMm} mm`} className={SECTION}>
          <StickControls
            enabled={stickCount > 0}
            onChangeEnabled={(enabled) => onSetSticksEnabled('word', enabled)}
            widthMm={config.stickWidthMm}
            lengthMm={config.stickLengthMm}
            onChangeWidth={(stickWidthMm) => onChange({ stickWidthMm })}
            onChangeLength={(stickLengthMm) => onChange({ stickLengthMm })}
            stickCounts={{ word: stickCount }}
            onAddStick={onAddStick}
            onRemoveStick={(blockId) => onRemoveStick(blockId, config.stickOffsets[blockId].length - 1)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          id={SECTIONS.decorators}
          title="Decorators"
          summary={config.decorators.length === 0 ? 'None' : `${config.decorators.length}`}
          className={SECTION}
        >
          <DecoratorControls
            decorators={config.decorators}
            placements={config.decoratorPlacements}
            colors={config.decoratorColors}
            fallbackColor={config.previewColor}
            onAdd={onAddDecorator}
            onUpdate={onUpdateDecorator}
            onRemove={onRemoveDecorator}
            onChangeAngle={onSetDecoratorAngle}
            onChangeColor={onSetDecoratorColor}
          />
        </CollapsibleSection>

        <CollapsibleSection id={SECTIONS.outline} title="Backing card" summary={config.outlineEnabled ? `${config.outlineGrowMm} mm border, ${colorName(config.outlineColor)}` : 'Off'} className={SECTION}>
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
            onSetAllHoles={onSetClosedOutlineHoles}
          />
        </CollapsibleSection>
      </div>

    </ControlPane>
  );
}
