import { COLOR_PRESETS } from '../../store/topperStore';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

export function ColorSwatchPicker({ value, onChange, label = 'Preview color' }: ColorSwatchPickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
      <p className="text-xs text-stone-400">Visual only — the real color comes from your printer filament.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {COLOR_PRESETS.map((color) => (
          <button
            key={color.id}
            type="button"
            title={color.label}
            aria-pressed={value === color.hex}
            onClick={() => onChange(color.hex)}
            className={`h-8 w-8 rounded-full border-2 transition-transform ${
              value === color.hex ? 'scale-110 border-stone-800' : 'border-white'
            }`}
            style={{ backgroundColor: color.hex, boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }}
          />
        ))}
      </div>
    </div>
  );
}
