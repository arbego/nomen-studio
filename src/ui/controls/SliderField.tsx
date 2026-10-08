import { useId, useState } from 'react';
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
  notice?: string;
  className?: string;
}

/** A slider for exploring, with an editable value for precise dimensions. */
export function SliderField({ label, value, onChange, min, max, step = 1, unit = 'mm', hint, notice, className = '' }: SliderFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [previousValue, setPreviousValue] = useState(value);
  const description = [hint && `${id}-hint`, notice && `${id}-notice`].filter(Boolean).join(' ') || undefined;
  if (value !== previousValue) {
    setPreviousValue(value);
    setDraft(String(value));
  }

  function finish(raw: string) {
    if (raw.trim() === '' || !Number.isFinite(Number(raw))) {
      setDraft(String(value));
      return;
    }
    const bounded = Math.min(max, Math.max(min, Number(raw)));
    setDraft(String(bounded));
    if (bounded !== value) onChange(bounded);
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-sm text-stone-600 dark:text-stone-400">
        <label htmlFor={`${id}-value`}>{label}</label>
        <div className="flex items-center gap-1.5">
          <DesignInput
            id={`${id}-value`}
            type="number"
            inputMode="decimal"
            aria-label={`${label} value`}
            aria-describedby={description}
            min={min}
            max={max}
            step={step}
            value={draft}
            onChange={(event) => {
              const raw = event.target.value;
              setDraft(raw);
              const next = Number(raw);
              if (raw !== '' && Number.isFinite(next) && next >= min && next <= max) onChange(next);
            }}
            onBlur={(event) => finish(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.value = String(value);
                setDraft(String(value));
                event.currentTarget.blur();
              } else if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            className="w-20 rounded-md border border-stone-200 bg-white px-2 py-1 text-right tabular-nums text-stone-700 focus:border-stone-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
          />
          <span className="text-xs text-stone-500 dark:text-stone-400">{unit}</span>
        </div>
      </div>
      <DesignInput type="range" aria-label={label} aria-describedby={description} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 accent-stone-800 dark:accent-stone-300" />
      {notice && <p id={`${id}-notice`} className="text-xs font-medium text-amber-700 dark:text-amber-400">{notice}</p>}
      {hint && <p id={`${id}-hint`} className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
    </div>
  );
}
