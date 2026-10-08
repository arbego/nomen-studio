import { useEffect, useId, useRef, useState } from 'react';
import { COLOR_PRESETS } from '../presets';

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
  const [open, setOpen] = useState(false);
  const paletteId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentColor = COLOR_PRESETS.find((color) => color.hex === value)?.label ?? value;
  const pickerLabel = label ?? 'Preview color';

  useEffect(() => {
    if (!open) return;
    // Wait for the click to land before collapsing the palette, since closing
    // it on blur can move the next control out from under the pointer.
    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('click', closeOutside);
    return () => document.removeEventListener('click', closeOutside);
  }, [open]);

  return (
    <div
      ref={pickerRef}
      className={`flex flex-col gap-1.5 ${className}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {label !== null && (
          <span className={variant === 'section' ? 'text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300' : 'text-sm text-stone-600 dark:text-stone-400'}>{label}</span>
        )}
        <button
          ref={triggerRef}
          type="button"
          title={`Change ${pickerLabel.toLowerCase()}: ${currentColor}`}
          aria-label={`Change ${pickerLabel.toLowerCase()}: ${currentColor}`}
          aria-expanded={open}
          aria-controls={open ? paletteId : undefined}
          onClick={() => setOpen(!open)}
          className="h-8 w-8 shrink-0 rounded-full border-2 border-stone-800 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:border-stone-200"
          style={{ backgroundColor: value, boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }}
        />
      </div>
      {open && (
        <div id={paletteId} className="flex flex-col gap-1.5" role="group" aria-label={`${pickerLabel} options`}>
          {hint && <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
          <div className="grid w-full grid-cols-[repeat(auto-fill,32px)] gap-2 p-1">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color.id}
                type="button"
                title={color.label}
                aria-label={color.label}
                aria-pressed={value === color.hex}
                onClick={() => onChange(color.hex)}
                className={`h-8 w-8 rounded-full border-2 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
                  value === color.hex ? 'scale-110 border-stone-800 dark:border-stone-200' : 'border-white dark:border-stone-900'
                }`}
                style={{ backgroundColor: color.hex, boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
