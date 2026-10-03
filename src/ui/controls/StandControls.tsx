import type { StandMode } from '../../geometry/baseGeometry';
import { ColorSwatchPicker } from './ColorSwatchPicker';

interface StandControlsProps {
  mode: StandMode;
  onChangeMode: (mode: StandMode) => void;
  railHeightMm: number;
  onChangeRailHeight: (mm: number) => void;
  railDepthMm: number;
  onChangeRailDepth: (mm: number) => void;
  trimOffsetMm: number;
  onChangeTrimOffset: (mm: number) => void;
  /** Which piece this affects, when a product has more than one and only some of them stand. */
  hint?: string;
  /** The rail's own color. Omit for a product that doesn't preview the stand separately; a flat cut never shows it, since it adds no material of its own. */
  color?: string;
  onChangeColor?: (hex: string) => void;
  className?: string;
}

const MODES: { value: StandMode; label: string; hint: string }[] = [
  { value: 'none', label: 'None', hint: 'Relies on the font having a flat bottom of its own, like a slab serif does.' },
  { value: 'rail', label: 'Base rail', hint: 'A slab under the piece. Works with any font, including scripts.' },
  { value: 'trim', label: 'Flat cut', hint: 'Slices the piece off flat at the baseline. Adds no material, but leaves a narrow footprint.' },
];

/** How a design is made to stand up — see geometry/baseGeometry.ts. Shared, so any product with a piece that has to stand gets the same three choices. */
export function StandControls({
  mode,
  onChangeMode,
  railHeightMm,
  onChangeRailHeight,
  railDepthMm,
  onChangeRailDepth,
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
      <span className="text-sm font-semibold uppercase tracking-wide text-stone-700">Standing</span>
      {hint && <p className="text-xs text-stone-400">{hint}</p>}

      <div className="flex gap-1 rounded-lg bg-stone-100 p-1">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChangeMode(option.value)}
            aria-pressed={mode === option.value}
            className={`flex-1 rounded-md px-2 py-1.5 text-sm transition-colors ${
              mode === option.value ? 'bg-white font-medium text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {active && <p className="text-xs text-stone-400">{active.hint}</p>}

      {mode === 'rail' && (
        <>
          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>Rail height</span>
              <span className="tabular-nums text-stone-400">{railHeightMm} mm</span>
            </div>
            <input type="range" min={2} max={25} step={0.5} value={railHeightMm} onChange={(e) => onChangeRailHeight(Number(e.target.value))} className="h-1.5 accent-stone-800" />
            <span className="text-xs text-stone-400">Measured below the baseline. Grows on its own if descenders reach lower, so they end up inside the rail rather than poking out of it.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>Rail depth</span>
              <span className="tabular-nums text-stone-400">{railDepthMm} mm</span>
            </div>
            <input type="range" min={8} max={60} step={1} value={railDepthMm} onChange={(e) => onChangeRailDepth(Number(e.target.value))} className="h-1.5 accent-stone-800" />
          </label>
          {color !== undefined && onChangeColor && (
            <ColorSwatchPicker value={color} onChange={onChangeColor} label="Rail color" variant="field" />
          )}
        </>
      )}

      {mode === 'trim' && (
        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm text-stone-600">
            <span>Cut height</span>
            <span className="tabular-nums text-stone-400">
              {trimOffsetMm > 0 ? '+' : ''}
              {trimOffsetMm} mm
            </span>
          </div>
          <input type="range" min={-10} max={15} step={0.5} value={trimOffsetMm} onChange={(e) => onChangeTrimOffset(Number(e.target.value))} className="h-1.5 accent-stone-800" />
          <span className="text-xs text-stone-400">Relative to the text's baseline. 0 removes just the descenders.</span>
        </label>
      )}
    </div>
  );
}
