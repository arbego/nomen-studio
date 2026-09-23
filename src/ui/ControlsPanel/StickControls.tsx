import type { PickId } from '../../geometry/types';

interface StickControlsProps {
  widthMm: number;
  lengthMm: number;
  onChangeWidth: (widthMm: number) => void;
  onChangeLength: (lengthMm: number) => void;
  stickCounts: Record<PickId, number>;
  onAddStick: (pickId: PickId) => void;
  onRemoveStick: (pickId: PickId) => void;
}

const WIDTH_RANGE = { min: 2, max: 10, step: 0.5 };
const LENGTH_RANGE = { min: 40, max: 120, step: 1 };
const MAX_STICKS_PER_PICK = 5;

const PICK_LABELS: Record<PickId, string> = { word: 'Name' };

export function StickControls({ widthMm, lengthMm, onChangeWidth, onChangeLength, stickCounts, onAddStick, onRemoveStick }: StickControlsProps) {
  const pickIds: PickId[] = ['word'];

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Stick</span>
      <p className="text-xs text-stone-400">Drag a stick in the preview to reposition it.</p>

      <div className="flex flex-col gap-2">
        {pickIds.map((pickId) => (
          <div key={pickId} className="flex items-center justify-between text-sm text-stone-600">
            <span>{PICK_LABELS[pickId]} sticks</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRemoveStick(pickId)}
                disabled={stickCounts[pickId] <= 1}
                aria-label={`Remove a ${PICK_LABELS[pickId]} stick`}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-stone-200 text-stone-600 transition-colors hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-30"
              >
                −
              </button>
              <span className="w-4 text-center tabular-nums">{stickCounts[pickId]}</span>
              <button
                type="button"
                onClick={() => onAddStick(pickId)}
                disabled={stickCounts[pickId] >= MAX_STICKS_PER_PICK}
                aria-label={`Add a ${PICK_LABELS[pickId]} stick`}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-stone-200 text-stone-600 transition-colors hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm text-stone-600">
          <span>Width</span>
          <span className="tabular-nums text-stone-400">{widthMm} mm</span>
        </div>
        <input
          type="range"
          min={WIDTH_RANGE.min}
          max={WIDTH_RANGE.max}
          step={WIDTH_RANGE.step}
          value={widthMm}
          onChange={(e) => onChangeWidth(Number(e.target.value))}
          className="h-1.5 accent-stone-800"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm text-stone-600">
          <span>Length</span>
          <span className="tabular-nums text-stone-400">{lengthMm} mm</span>
        </div>
        <input
          type="range"
          min={LENGTH_RANGE.min}
          max={LENGTH_RANGE.max}
          step={LENGTH_RANGE.step}
          value={lengthMm}
          onChange={(e) => onChangeLength(Number(e.target.value))}
          className="h-1.5 accent-stone-800"
        />
      </label>
    </div>
  );
}
