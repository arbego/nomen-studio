import type { FontCategory } from '../../fonts/types';
import { fontsByCategory } from '../../fonts/registry';

interface FontPickerProps {
  label: string;
  category: FontCategory;
  value: string;
  onChange: (fontId: string) => void;
}

export function FontPicker({ label, category, value, onChange }: FontPickerProps) {
  const fonts = fontsByCategory(category);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
      <div className="flex flex-wrap gap-2">
        {fonts.map((font) => (
          <button
            key={font.id}
            type="button"
            onClick={() => onChange(font.id)}
            aria-pressed={value === font.id}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === font.id
                ? 'border-stone-800 bg-stone-800 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
            }`}
          >
            {font.label}
          </button>
        ))}
      </div>
    </div>
  );
}
