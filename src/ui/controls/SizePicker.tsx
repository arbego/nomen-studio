import { SIZE_PRESETS_MM } from '../presets';

interface SizePickerProps {
  /** What this dimension is called in this product — "word width" for a cake topper, something else elsewhere. `null` drops the heading, for use inside a section that already carries one. */
  label?: string | null;
  value: number;
  onChange: (sizeMm: number) => void;
  depthMm: number;
  onChangeDepth: (depthMm: number) => void;
  className?: string;
}

const MIN_MM = 60;
const MAX_MM = 250;

const MIN_DEPTH_MM = 0.5;
const MAX_DEPTH_MM = 10;
const DEPTH_STEP_MM = 0.25;

export function SizePicker({ label = 'Size (word width)', value, onChange, depthMm, onChangeDepth, className = '' }: SizePickerProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label !== null && <span className="text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {SIZE_PRESETS_MM.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            aria-pressed={value === preset}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === preset
                ? 'border-stone-800 dark:border-stone-200 bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900'
                : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500'
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
          className="h-1.5 flex-1 accent-stone-800 dark:accent-stone-300"
        />
        <span className="w-16 shrink-0 text-right text-sm tabular-nums text-stone-600 dark:text-stone-400">{value} mm</span>
      </div>

      <label className="flex flex-col gap-1.5 pt-2">
        <div className="flex items-center justify-between text-sm text-stone-600 dark:text-stone-400">
          <span>Height</span>
          <span className="tabular-nums text-stone-400 dark:text-stone-500">{depthMm} mm</span>
        </div>
        <input
          type="range"
          min={MIN_DEPTH_MM}
          max={MAX_DEPTH_MM}
          step={DEPTH_STEP_MM}
          value={depthMm}
          onChange={(e) => onChangeDepth(Number(e.target.value))}
          className="h-1.5 accent-stone-800 dark:accent-stone-300"
        />
      </label>
    </div>
  );
}
