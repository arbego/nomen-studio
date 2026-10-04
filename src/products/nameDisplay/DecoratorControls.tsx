import { useState } from 'react';
import { SliderField } from '../../ui/controls/SliderField';
import { Icon, IconPicker } from '../../ui/controls/IconPicker';
import type { DecoratorConfig } from './config';

interface DecoratorControlsProps {
  className?: string;
  decorators: DecoratorConfig[];
  /** Nothing inlaid may be thinner than this, or it would sit entirely inside its own recess. */
  pocketDepthMm: number;
  /** Ids of ornaments currently dragged clear of the initial, so nothing holds them. */
  detachedIds: string[];
  onAdd: (iconName: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<DecoratorConfig, 'id'>>) => void;
  onRemove: (id: string) => void;
}

/**
 * The ornaments on the piece: add one, pick its icon, set how big and how thick
 * it is. Where it sits is set by dragging it in the preview, like the name —
 * there is no control for position here, because a number pair is a worse way to
 * place something than putting it where you want it.
 */
export function DecoratorControls({ className = '', decorators, pocketDepthMm, detachedIds, onAdd, onUpdate, onRemove }: DecoratorControlsProps) {
  // Which icon grid is open: a decorator's id while changing its icon, 'new'
  // while adding one, or null.
  const [picking, setPicking] = useState<string | null>(null);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <span className="text-sm font-semibold uppercase tracking-wide text-stone-700">Decorators</span>
      <p className="text-xs text-stone-400">Icons inlaid into the initial, each in its own pocket. Drag one in the preview to move it.</p>

      {decorators.map((decorator) => (
        <div key={decorator.id} className="flex flex-col gap-3 rounded-lg border border-stone-200 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicking(picking === decorator.id ? null : decorator.id)}
              title="Change icon"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone-200 text-stone-700 transition-colors hover:border-stone-400"
            >
              <Icon name={decorator.iconName} className="text-[22px]" />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm text-stone-600">{decorator.iconName}</span>
            <button
              type="button"
              onClick={() => onRemove(decorator.id)}
              aria-label={`Remove ${decorator.iconName}`}
              className="shrink-0 text-xs text-stone-500 underline decoration-dotted underline-offset-2 hover:text-red-700"
            >
              Remove
            </button>
          </div>

          {picking === decorator.id && (
            <IconPicker
              value={decorator.iconName}
              onChange={(iconName) => {
                onUpdate(decorator.id, { iconName });
                setPicking(null);
              }}
              onClose={() => setPicking(null)}
            />
          )}

          <SliderField label="Width" value={decorator.widthMm} onChange={(widthMm) => onUpdate(decorator.id, { widthMm })} min={5} max={120} />
          <SliderField
            label="Thickness"
            value={decorator.depthMm}
            onChange={(depthMm) => onUpdate(decorator.id, { depthMm })}
            min={pocketDepthMm}
            max={15}
            step={0.5}
            hint={`Can't go below the ${pocketDepthMm.toFixed(2)} mm pocket, or the icon would disappear into it.`}
          />

          {detachedIds.includes(decorator.id) && (
            <p className="text-xs text-amber-700">This one doesn't overlap the initial, so nothing holds it — drag it back over the letter.</p>
          )}
        </div>
      ))}

      {picking === 'new' ? (
        <IconPicker
          onChange={(iconName) => {
            onAdd(iconName);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPicking('new')}
          className="rounded-lg border border-dashed border-stone-300 px-4 py-2 text-sm text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900"
        >
          Add decorator
        </button>
      )}
    </div>
  );
}
