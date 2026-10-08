import { SliderField } from '../../ui/controls/SliderField';
import type { CakeTopperBlockId } from './config';

interface StickControlsProps {
  enabled: boolean;
  onChangeEnabled: (enabled: boolean) => void;
  widthMm: number;
  lengthMm: number;
  onChangeWidth: (widthMm: number) => void;
  onChangeLength: (lengthMm: number) => void;
  stickCounts: Record<CakeTopperBlockId, number>;
  onAddStick: (blockId: CakeTopperBlockId) => void;
  onResetPositions: () => void;
  onRemoveStick: (blockId: CakeTopperBlockId) => void;
  className?: string;
}

const WIDTH_RANGE = { min: 2, max: 10, step: 0.5 };
const LENGTH_RANGE = { min: 40, max: 120, step: 1 };
const MAX_STICKS_PER_BLOCK = 5;

const PICK_LABELS: Record<CakeTopperBlockId, string> = { word: 'Name' };

export function StickControls({
  enabled,
  onChangeEnabled,
  widthMm,
  lengthMm,
  onChangeWidth,
  onChangeLength,
  stickCounts,
  onAddStick,
  onResetPositions,
  onRemoveStick,
  className = '',
}: StickControlsProps) {
  const pickIds: CakeTopperBlockId[] = ['word'];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <label className="flex items-center justify-between">
        <span className="text-sm text-stone-600 dark:text-stone-400">Add sticks under the name</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChangeEnabled(e.target.checked)}
          className="h-4 w-4 accent-stone-800 dark:accent-stone-300"
          aria-label="Add sticks under the name"
        />
      </label>

      {enabled && (
        <>
          <p className="text-xs text-stone-500 dark:text-stone-400">Drag a stick in the preview to reposition it.</p>

          <div className="flex flex-col gap-2">
            {pickIds.map((blockId) => (
              <div key={blockId} className="flex items-center justify-between text-sm text-stone-600 dark:text-stone-400">
                <span>Number of sticks</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRemoveStick(blockId)}
                    disabled={stickCounts[blockId] <= 1}
                    aria-label={`Remove a ${PICK_LABELS[blockId]} stick`}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 transition-colors hover:border-stone-400 dark:hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-4 text-center tabular-nums">{stickCounts[blockId]}</span>
                  <button
                    type="button"
                    onClick={() => onAddStick(blockId)}
                    disabled={stickCounts[blockId] >= MAX_STICKS_PER_BLOCK}
                    aria-label={`Add a ${PICK_LABELS[blockId]} stick`}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 transition-colors hover:border-stone-400 dark:hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={onResetPositions} className="control-action self-start" title="Space sticks evenly along the baseline">Reset stick positions</button>
          <SliderField label="Width" value={widthMm} onChange={onChangeWidth} min={WIDTH_RANGE.min} max={WIDTH_RANGE.max} step={WIDTH_RANGE.step} />

          <SliderField label="Length" value={lengthMm} onChange={onChangeLength} min={LENGTH_RANGE.min} max={LENGTH_RANGE.max} step={LENGTH_RANGE.step} />
        </>
      )}
    </div>
  );
}
