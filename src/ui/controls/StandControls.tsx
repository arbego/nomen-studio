import { SliderField } from './SliderField';
import type { StandMode } from '../../geometry/baseGeometry';
import { MODES } from './standModes';
import { ColorSwatchPicker } from './ColorSwatchPicker';

interface StandControlsProps {
  mode: StandMode;
  onChangeMode: (mode: StandMode) => void;
  railHeightMm: number;
  onChangeRailHeight: (mm: number) => void;
  railDepthMm: number;
  onChangeRailDepth: (mm: number) => void;
  /** How deep the socket in the rail is — omit for a product whose rail has none. */
  railSocketDepthMm?: number;
  onChangeRailSocketDepth?: (mm: number) => void;
  trimOffsetMm: number;
  onChangeTrimOffset: (mm: number) => void;
  /** Which piece this affects, when a product has more than one and only some of them stand. */
  hint?: string;
  /** The rail's own color. Omit for a product that doesn't preview the stand separately; a flat cut never shows it, since it adds no material of its own. */
  color?: string;
  onChangeColor?: (hex: string) => void;
  className?: string;
}

/** How a design is made to stand up — see geometry/baseGeometry.ts. Shared, so any product with a piece that has to stand gets the same three choices. */
export function StandControls({
  mode,
  onChangeMode,
  railHeightMm,
  onChangeRailHeight,
  railDepthMm,
  onChangeRailDepth,
  railSocketDepthMm,
  onChangeRailSocketDepth,
  trimOffsetMm,
  onChangeTrimOffset,
  hint,
  color,
  onChangeColor,
  className = '',
}: StandControlsProps) {
  const active = MODES.find((m) => m.value === mode);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {hint && <p className="text-xs text-stone-400 dark:text-stone-500">{hint}</p>}

      <div className="flex gap-1 rounded-lg bg-stone-100 dark:bg-stone-800 p-1">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChangeMode(option.value)}
            aria-pressed={mode === option.value}
            className={`flex-1 rounded-md px-2 py-1.5 text-sm transition-colors ${
              mode === option.value ? 'bg-white dark:bg-stone-700 font-medium text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {active && <p className="text-xs text-stone-400 dark:text-stone-500">{active.hint}</p>}

      {mode === 'rail' && (
        <>
          <SliderField label="Rail height" value={railHeightMm} onChange={onChangeRailHeight} min={2} max={25} step={0.5} hint="Measured below the baseline. Grows on its own if descenders reach lower, so they end up inside the rail rather than poking out of it." />
          <SliderField label="Rail depth" value={railDepthMm} onChange={onChangeRailDepth} min={8} max={60} />
          {railSocketDepthMm !== undefined && onChangeRailSocketDepth && (
            <SliderField label="Socket depth" value={railSocketDepthMm} onChange={onChangeRailSocketDepth} min={0} max={20} step={0.5} hint="How far the piece sits down into the rail. They print as two parts and go together afterwards, so deeper holds better — and hides that much of the piece." />
          )}
          {color !== undefined && onChangeColor && (
            <ColorSwatchPicker value={color} onChange={onChangeColor} label="Rail color" variant="field" />
          )}
        </>
      )}

      {mode === 'trim' && (
        <SliderField label="Cut height" value={trimOffsetMm} onChange={onChangeTrimOffset} min={-10} max={15} step={0.5} hint="Relative to the text's baseline. 0 removes just the descenders." />
      )}
    </div>
  );
}
