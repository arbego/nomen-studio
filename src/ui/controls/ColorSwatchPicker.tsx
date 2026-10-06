import { COLOR_FAMILIES, COLOR_PRESETS } from '../presets';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (hex: string) => void;
  /** `null` drops the heading, for use inside a section that already carries one. */
  label?: string | null;
  /** 'section' (default) renders as a top-level panel section heading; 'field' renders as a plain sub-label for use nested inside another section (e.g. outline color within Outline card). */
  variant?: 'section' | 'field';
  /** The caveat under the label. `null` drops it — for a picker repeated down a list, where saying it once at the top is enough and saying it per row is noise. */
  hint?: string | null;
  className?: string;
}

const DEFAULT_HINT = 'Visual only — the real color comes from your printer filament.';

export function ColorSwatchPicker({ value, onChange, label = 'Preview color', variant = 'section', hint = DEFAULT_HINT, className = '' }: ColorSwatchPickerProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label !== null && (
        <span className={variant === 'section' ? 'text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300' : 'text-sm text-stone-600 dark:text-stone-400'}>{label}</span>
      )}
      {hint && <p className="text-xs text-stone-400 dark:text-stone-500">{hint}</p>}
      {/* One row per family rather than one wall of swatches: a pastel and a
          bold are different kinds of design, not shades of one, and thirty
          circles in a single wrap read as a gradient to scan rather than two
          sets to choose between. */}
      <div className="flex flex-col gap-2 pt-1">
        {COLOR_FAMILIES.map((family) => (
          // Eight columns that divide up whatever width there is, rather than
          // fixed-size swatches left to wrap: the picker is rendered at several
          // widths — a panel section, and nested inside a decorator card that is
          // 26px narrower — and wrapping put seven on a row there and eight here,
          // which reads as the grid breaking rather than as the same control. A
          // row of eight also divides the pastels exactly.
          <div key={family} className="grid grid-cols-8 gap-2">
            {COLOR_PRESETS.filter((color) => color.family === family).map((color) => (
              <button
                key={color.id}
                type="button"
                title={color.label}
                aria-pressed={value === color.hex}
                onClick={() => onChange(color.hex)}
                className={`aspect-square w-full rounded-full border-2 transition-transform ${
                  value === color.hex ? 'scale-110 border-stone-800 dark:border-stone-200' : 'border-white dark:border-stone-900'
                }`}
                style={{ backgroundColor: color.hex, boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
