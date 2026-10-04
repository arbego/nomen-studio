import { useEffect, useRef, useState } from 'react';
import { SliderField } from '../../ui/controls/SliderField';
import { ColorSwatchPicker } from '../../ui/controls/ColorSwatchPicker';
import { TextField } from '../../ui/controls/TextField';
import { FontPicker } from '../../ui/controls/FontPicker';
import { Icon, IconPicker } from '../../ui/controls/IconPicker';
import { getFontDefinition } from '../../fonts/registry';
import { getIcon, getIconSet } from '../../icons/catalog';
import { DECORATOR_TEXT_MAX_LENGTH, type DecoratorConfig, type DecoratorPlacementConfig } from './config';
import type { DecoratorPatch, NewDecorator } from './store';

interface DecoratorControlsProps {
  className?: string;
  decorators: DecoratorConfig[];
  /** Where each one sits and how far it is turned, keyed by id — the angle is editable here, the position by dragging. */
  placements: Record<string, DecoratorPlacementConfig>;
  /** Each one's own color, keyed by id. */
  colors: Record<string, string>;
  /** What an ornament with no color of its own shows as — the name's, since that is the filament it would print in. */
  fallbackColor: string;
  /** Nothing inlaid may be thinner than this, or it would sit entirely inside its own recess. */
  pocketDepthMm: number;
  /** Ids of ornaments currently dragged clear of the initial, so nothing holds them. */
  detachedIds: string[];
  /** Returns the new ornament's id, so the grid that added it can go on changing it instead of adding more. */
  onAdd: (source: NewDecorator) => string;
  onUpdate: (id: string, patch: DecoratorPatch) => void;
  onRemove: (id: string) => void;
  onChangeAngle: (id: string, angleDeg: number) => void;
  onChangeColor: (id: string, color: string) => void;
}

/** A word ornament has to be wider than an icon to read at all, so it gets more room on the slider. */
const MAX_WIDTH_MM = { icon: 120, text: 250 };

const ADD_BUTTON_CLASS =
  'flex-1 rounded-lg border border-dashed border-stone-300 dark:border-stone-600 px-4 py-2 text-sm text-stone-600 dark:text-stone-400 transition-colors hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-stone-100';

/**
 * An icon's own name, with the set it came from beside it — ids are qualified
 * (`emoji:aries`), and showing the raw id would make a name the user never typed
 * look like part of their design.
 */
function IconName({ id }: { id: string }) {
  const icon = getIcon(id);
  return (
    <>
      {icon.name} <span className="text-xs text-stone-400 dark:text-stone-500">{getIconSet(icon.set).label}</span>
    </>
  );
}

/** Which editor is open on which ornament. Only one at a time: these are full-width grids and lists, and two open at once would bury the piece being edited. */
type OpenEditor = { id: string; what: 'icon' | 'font' } | null;

/**
 * The ornaments on the piece: add an icon or a word, say how big, how thick, how
 * turned and what color it is. Where it sits is set by dragging it in the
 * preview — there is no control for position here, because a number pair is a
 * worse way to place something than putting it where you want it. The angle is a
 * control rather than a gesture for the opposite reason: there is no obvious
 * drag that means "turn", and a slider is exact.
 */
export function DecoratorControls({
  className = '',
  decorators,
  placements,
  colors,
  fallbackColor,
  pocketDepthMm,
  detachedIds,
  onAdd,
  onUpdate,
  onRemove,
  onChangeAngle,
  onChangeColor,
}: DecoratorControlsProps) {
  const [editor, setEditor] = useState<OpenEditor>(null);
  // The grid for adding an icon, which starts out belonging to no ornament:
  // `null` means it is closed, `{ added: null }` that it is open and nothing has
  // been picked yet, and `{ added: id }` that it made that one and is now
  // changing it. A word needs no such step — it is added and then typed into.
  const [adding, setAdding] = useState<{ added: string | null } | null>(null);

  function toggle(id: string, what: 'icon' | 'font') {
    setEditor(editor?.id === id && editor.what === what ? null : { id, what });
  }

  /** What the add grid should highlight: the ornament it has already made, once it has made one. */
  function addedIconName(): string | undefined {
    const added = decorators.find((decorator) => decorator.id === adding?.added);
    return added?.kind === 'icon' ? added.iconName : undefined;
  }

  const addGridRef = useRef<HTMLDivElement>(null);
  const addedId = adding?.added ?? null;
  useEffect(() => {
    // The first pick puts a card for the new ornament above this grid, which
    // pushes the grid itself down the panel — off screen, if you had scrolled
    // to it. Nudged back to where it was, since browsing on is the whole point
    // of it staying open.
    if (addedId) {
      addGridRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [addedId]);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <span className="text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">Decorators</span>
      <p className="text-xs text-stone-400 dark:text-stone-500">
        Icons and words inlaid into the initial, each in its own pocket and its own filament. Drag one in the preview to move it.
      </p>

      {decorators.map((decorator) => (
        <div key={decorator.id} className="flex flex-col gap-3 rounded-lg border border-stone-200 dark:border-stone-700 p-3">
          <div className="flex items-center gap-2">
            {decorator.kind === 'icon' ? (
              <button
                type="button"
                onClick={() => toggle(decorator.id, 'icon')}
                title="Change icon"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 transition-colors hover:border-stone-400 dark:hover:border-stone-500"
              >
                <Icon name={decorator.iconName} className="text-[22px]" />
              </button>
            ) : (
              <Icon name="text_fields" className="h-10 shrink-0 text-[22px] leading-10 text-stone-400 dark:text-stone-500" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-stone-600 dark:text-stone-400">
              {decorator.kind === 'icon' ? <IconName id={decorator.iconName} /> : decorator.text || 'Empty'}
            </span>
            <button
              type="button"
              onClick={() => onRemove(decorator.id)}
              aria-label={`Remove ${decorator.kind === 'icon' ? getIcon(decorator.iconName).name : decorator.text}`}
              className="shrink-0 text-xs text-stone-500 dark:text-stone-400 underline decoration-dotted underline-offset-2 hover:text-red-700 dark:hover:text-red-400"
            >
              Remove
            </button>
          </div>

          {decorator.kind === 'icon' && editor?.id === decorator.id && editor.what === 'icon' && (
            // Stays open as you click: every pick lands on the piece
            // immediately, so trying symbols against the letter is one click
            // each rather than four. Done closes it.
            <IconPicker value={decorator.iconName} onChange={(iconName) => onUpdate(decorator.id, { iconName })} onClose={() => setEditor(null)} />
          )}

          {decorator.kind === 'text' && (
            <>
              <TextField
                label="Text"
                value={decorator.text}
                onChange={(text) => onUpdate(decorator.id, { text })}
                maxLength={DECORATOR_TEXT_MAX_LENGTH}
                placeholder="est. 2019"
              />
              {/* Behind a link rather than always open: the font list is a tall
                  search panel, and several of them stacked down the sidebar
                  would bury the ornaments themselves. */}
              <div className="flex items-center justify-between gap-2 text-sm text-stone-600 dark:text-stone-400">
                <span className="min-w-0 truncate">Font: {getFontDefinition(decorator.fontId).family}</span>
                <button
                  type="button"
                  onClick={() => toggle(decorator.id, 'font')}
                  className="shrink-0 text-xs text-stone-500 dark:text-stone-400 underline decoration-dotted underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200"
                >
                  {editor?.id === decorator.id && editor.what === 'font' ? 'Done' : 'Change'}
                </button>
              </div>
              {editor?.id === decorator.id && editor.what === 'font' && (
                <FontPicker
                  label="Decorator font"
                  value={decorator.fontId}
                  onChange={(fontId) => onUpdate(decorator.id, { fontId })}
                  previewText={decorator.text || 'Text'}
                />
              )}
              {!decorator.text.trim() && <p className="text-xs text-amber-700 dark:text-amber-400">Nothing to print yet — type something and it appears on the initial.</p>}
            </>
          )}

          <SliderField label="Width" value={decorator.widthMm} onChange={(widthMm) => onUpdate(decorator.id, { widthMm })} min={5} max={MAX_WIDTH_MM[decorator.kind]} />
          <SliderField
            label="Thickness"
            value={decorator.depthMm}
            onChange={(depthMm) => onUpdate(decorator.id, { depthMm })}
            min={pocketDepthMm}
            max={15}
            step={0.5}
            hint={`Can't go below the ${pocketDepthMm.toFixed(2)} mm pocket, or it would disappear into it.`}
          />
          <SliderField label="Angle" value={placements[decorator.id]?.angleDeg ?? 0} onChange={(angleDeg) => onChangeAngle(decorator.id, angleDeg)} min={-180} max={180} unit="°" />
          <ColorSwatchPicker
            label="Color"
            variant="field"
            hint={null}
            value={colors[decorator.id] ?? fallbackColor}
            onChange={(color) => onChangeColor(decorator.id, color)}
          />

          {detachedIds.includes(decorator.id) && (
            <p className="text-xs text-amber-700 dark:text-amber-400">This one doesn't overlap the initial, so nothing holds it — drag it back over the letter.</p>
          )}
        </div>
      ))}

      {adding ? (
        // One grid, mounted in one place for both halves of the job: the first
        // pick adds the ornament, every later one changes that same ornament
        // rather than adding more. Were this to hand over to the card's own
        // grid above, it would unmount and take the search and the chosen set
        // with it — exactly when you are in the middle of browsing.
        <div ref={addGridRef}>
          <IconPicker
            value={addedIconName()}
            onChange={(iconName) => {
              if (adding.added) {
                onUpdate(adding.added, { iconName });
              } else {
                setAdding({ added: onAdd({ kind: 'icon', iconName }) });
              }
            }}
            onClose={() => setAdding(null)}
          />
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => setAdding({ added: null })} className={ADD_BUTTON_CLASS}>
            Add icon
          </button>
          <button type="button" onClick={() => onAdd({ kind: 'text' })} className={ADD_BUTTON_CLASS}>
            Add text
          </button>
        </div>
      )}
    </div>
  );
}
