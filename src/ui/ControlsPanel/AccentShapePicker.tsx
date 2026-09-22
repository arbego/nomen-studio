import { SHAPE_REGISTRY } from '../../shapes/registry';

interface AccentShapePickerProps {
  value: string | null;
  onChange: (shapeId: string | null) => void;
}

export function AccentShapePicker({ value, onChange }: AccentShapePickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Accent</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            value === null
              ? 'border-stone-800 bg-stone-800 text-white'
              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
          }`}
        >
          None
        </button>
        {SHAPE_REGISTRY.map((shape) => (
          <button
            key={shape.id}
            type="button"
            onClick={() => onChange(shape.id)}
            aria-pressed={value === shape.id}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === shape.id
                ? 'border-stone-800 bg-stone-800 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
            }`}
          >
            {shape.label}
          </button>
        ))}
      </div>
    </div>
  );
}
