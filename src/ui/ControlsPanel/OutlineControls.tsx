import { ColorSwatchPicker } from './ColorSwatchPicker';

interface OutlineControlsProps {
  enabled: boolean;
  onChangeEnabled: (enabled: boolean) => void;
  growMm: number;
  onChangeGrow: (growMm: number) => void;
  color: string;
  onChangeColor: (hex: string) => void;
  depthMm: number;
  onChangeDepth: (depthMm: number) => void;
  /** The word's own thickness — the card's height is capped here so it can never grow tall enough to become flush with (and so hide) the letters. */
  maxDepthMm: number;
}

const GROW_RANGE = { min: 0.5, max: 20, step: 0.5 };
const MIN_DEPTH_MM = 0.5;

export function OutlineControls({
  enabled,
  onChangeEnabled,
  growMm,
  onChangeGrow,
  color,
  onChangeColor,
  depthMm,
  onChangeDepth,
  maxDepthMm,
}: OutlineControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Outline card</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChangeEnabled(e.target.checked)}
          className="h-4 w-4 accent-stone-800"
          aria-label="Add a solid backing card under the name"
        />
      </label>

      {enabled && (
        <>
          <p className="text-xs text-stone-400">
            A separate solid card behind the name, shaped to its outline. Grow it until a disconnected part (like an "i" dot) merges into the card.
          </p>
          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>Grow</span>
              <span className="tabular-nums text-stone-400">{growMm} mm</span>
            </div>
            <input
              type="range"
              min={GROW_RANGE.min}
              max={GROW_RANGE.max}
              step={GROW_RANGE.step}
              value={growMm}
              onChange={(e) => onChangeGrow(Number(e.target.value))}
              className="h-1.5 accent-stone-800"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>Height</span>
              <span className="tabular-nums text-stone-400">{depthMm} mm</span>
            </div>
            <input
              type="range"
              min={MIN_DEPTH_MM}
              max={maxDepthMm}
              step={0.25}
              value={depthMm}
              onChange={(e) => onChangeDepth(Number(e.target.value))}
              className="h-1.5 accent-stone-800"
            />
          </label>
          <ColorSwatchPicker label="Outline color" value={color} onChange={onChangeColor} />
        </>
      )}
    </div>
  );
}
