import { DesignInput } from '../DesignHistory';

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  className?: string;
}

/** A labelled slider with its current value read out alongside — the shape every numeric control in the panels uses. */
export function SliderField({ label, value, onChange, min, max, step = 1, unit = 'mm', hint, className = '' }: SliderFieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-sm text-stone-600 dark:text-stone-400">
        <span>{label}</span>
        <span className="tabular-nums text-stone-400 dark:text-stone-500">
          {value} {unit}
        </span>
      </div>
      <DesignInput type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 accent-stone-800 dark:accent-stone-300" />
      {hint && <span className="text-xs text-stone-400 dark:text-stone-500">{hint}</span>}
    </label>
  );
}
