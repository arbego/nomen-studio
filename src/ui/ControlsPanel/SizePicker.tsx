import { SIZE_PRESETS_MM } from '../../store/topperStore';

interface SizePickerProps {
  value: number;
  onChange: (sizeMm: number) => void;
}

const MIN_MM = 60;
const MAX_MM = 250;

export function SizePicker({ value, onChange }: SizePickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Size (word width)</span>
      <div className="flex flex-wrap gap-2">
        {SIZE_PRESETS_MM.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            aria-pressed={value === preset}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === preset
                ? 'border-stone-800 bg-stone-800 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
            }`}
          >
            {preset / 10} cm
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <input
          type="range"
          min={MIN_MM}
          max={MAX_MM}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 accent-stone-800"
        />
        <span className="w-16 shrink-0 text-right text-sm tabular-nums text-stone-600">{value} mm</span>
      </div>
    </div>
  );
}
