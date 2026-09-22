interface StickControlsProps {
  widthMm: number;
  lengthMm: number;
  onChangeWidth: (widthMm: number) => void;
  onChangeLength: (lengthMm: number) => void;
}

const WIDTH_RANGE = { min: 2, max: 10, step: 0.5 };
const LENGTH_RANGE = { min: 40, max: 120, step: 1 };

export function StickControls({ widthMm, lengthMm, onChangeWidth, onChangeLength }: StickControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Stick</span>
      <p className="text-xs text-stone-400">Drag a piece in the preview to reposition its stick.</p>

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
