import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SliderField } from '../../ui/controls/SliderField';
import { ColorSwatchPicker } from '../../ui/controls/ColorSwatchPicker';
import { TextField } from '../../ui/controls/TextField';
import { FontField } from '../../ui/controls/FontField';
import { Icon, IconPicker } from '../../ui/controls/IconPicker';
import { NEW_ICON_BROWSE, type IconBrowse } from '../../ui/controls/iconBrowse';
import { FocusTarget } from '../../ui/FocusTarget';
import { useIsOpen, usePanelStore } from '../../ui/panelStore';
import { decoratorFocusKey } from './focus';
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
      {icon.name} <span className="text-xs text-stone-500 dark:text-stone-400">{getIconSet(icon.set).label}</span>
    </>
  );
}

/** Which editor is open on which ornament. Only one at a time: these are full-width grids and lists, and two open at once would bury the piece being edited. */
type OpenEditor = { id: string; what: 'icon' | 'font' } | null;

/**
 * One ornament: a row naming it, and everything that shapes it folded away
 * behind that row.
 *
 * Folded because a card runs to most of a screen — a width, a thickness, an
 * angle and a colour, plus a picker for what it is — and a piece with four
 * ornaments on it would otherwise be a panel you scroll past rather than read.
 * The row still says which ornament it is, which is the thing you are looking
 * for when you have several.
 *
 * Clicking the ornament in the preview opens its card and shuts the others —
 * same rule as the sections, and the reason the card's id is also its focus
 * key.
 */
function DecoratorCard({
  decorator,
  onOpenIcon,
  onRemove,
  children,
}: {
  decorator: DecoratorConfig;
  onOpenIcon: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const id = decoratorFocusKey(decorator.id);
  const open = useIsOpen(id);
  const setOpen = usePanelStore((state) => state.setOpen);
  const name = decorator.kind === 'icon' ? getIcon(decorator.iconName).name : decorator.text;

  return (
    <FocusTarget focusKey={id} className="flex flex-col gap-3 rounded-lg border border-stone-200 dark:border-stone-700 p-3">
      <div className="flex items-center gap-2">
        {decorator.kind === 'icon' ? (
          <button
            type="button"
            // Opens the card too: picking a different symbol is an edit like any
            // other, and it would otherwise land in a card you cannot see.
            onClick={() => {
              setOpen(id, true);
              onOpenIcon();
            }}
            title="Change icon"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 transition-colors hover:border-stone-400 dark:hover:border-stone-500"
          >
            <Icon name={decorator.iconName} className="text-[22px]" />
          </button>
        ) : (
          <Icon name="text_fields" className="h-10 shrink-0 text-[22px] leading-10 text-stone-500 dark:text-stone-400" />
        )}
        <button type="button" onClick={() => setOpen(id, !open)} aria-expanded={open} className="group flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1 truncate text-sm text-stone-600 dark:text-stone-400">
            {decorator.kind === 'icon' ? <IconName id={decorator.iconName} /> : decorator.text || 'Empty'}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 shrink-0 text-stone-500 dark:text-stone-400 transition-transform group-hover:text-stone-700 dark:group-hover:text-stone-300 ${open ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="control-action shrink-0 hover:text-red-700 dark:hover:text-red-400"
        >
          Remove
        </button>
      </div>
      {open && children}
    </FocusTarget>
  );
}

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
  // Whether the grid for adding an icon is open. It belongs to no ornament —
  // the first pick makes one and hands the grid over to that ornament's own
  // card, below. A word needs no such step: it is added and then typed into.
  const [adding, setAdding] = useState(false);
  // One browse across both, so the handover doesn't throw away the search.
  const [browse, setBrowse] = useState<IconBrowse>(NEW_ICON_BROWSE);
  const setOpen = usePanelStore((state) => state.setOpen);

  /** Adds an ornament and opens its card, since a new one arriving folded away would look like nothing happened. */
  function add(source: NewDecorator): string {
    const id = onAdd(source);
    setOpen(decoratorFocusKey(id), true);
    return id;
  }

  function openGrid(open: () => void) {
    // Every grid *opened* starts fresh — last week's search is not this
    // ornament's. Only the add-to-edit handover carries a browse across, and it
    // goes through neither of these.
    setBrowse(NEW_ICON_BROWSE);
    open();
  }

  function toggle(id: string, what: 'icon' | 'font') {
    const closing = editor?.id === id && editor.what === what;
    openGrid(() => setEditor(closing ? null : { id, what }));
    setAdding(false);
  }

  const gridRef = useRef<HTMLDivElement>(null);
  // Whichever grid is open, named so the effect below can tell one opening from
  // the next — including the handover, where the add grid becomes a card's.
  const openGridId = adding ? 'adding' : editor?.what === 'icon' ? editor.id : null;
  useEffect(() => {
    // A grid that opens below the fold, or one that moves into the card above
    // when the first pick adds an ornament, is a grid you have to go looking
    // for. `nearest` moves as little as it can to put it back on screen.
    if (openGridId) {
      gridRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [openGridId]);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Icons and words inlaid into the initial, each in its own pocket and its own filament. Drag one in the preview to move it.
      </p>

      {decorators.map((decorator) => (
        <DecoratorCard
          key={decorator.id}
          decorator={decorator}
          onOpenIcon={() => toggle(decorator.id, 'icon')}
          onRemove={() => onRemove(decorator.id)}
        >
          {decorator.kind === 'icon' && editor?.id === decorator.id && editor.what === 'icon' && (
            // Stays open as you click: every pick lands on the piece
            // immediately, so trying symbols against the letter is one click
            // each rather than four. Done closes it.
            <div ref={gridRef}>
              <IconPicker
                value={decorator.iconName}
                onChange={(iconName) => onUpdate(decorator.id, { iconName })}
                onClose={() => setEditor(null)}
                browse={browse}
                onBrowse={setBrowse}
              />
            </div>
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
              <FontField
                label="Decorator font"
                browseKey={`decorator-font-${decorator.id}`}
                value={decorator.fontId}
                onChange={(fontId) => onUpdate(decorator.id, { fontId })}
                previewText={decorator.text || 'Text'}
                open={editor?.id === decorator.id && editor.what === 'font'}
                onOpenChange={(open) => setEditor(open ? { id: decorator.id, what: 'font' } : null)}
              />
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
        </DecoratorCard>
      ))}

      {adding ? (
        // Open only until there is an ornament to own it: the first pick adds
        // one and hands the grid over to that ornament's own card, where every
        // later pick changes it. The browse goes with it, so the handover is
        // invisible apart from the grid moving to where it belongs.
        <div ref={gridRef}>
          <IconPicker
            onChange={(iconName) => {
              setEditor({ id: add({ kind: 'icon', iconName }), what: 'icon' });
              setAdding(false);
            }}
            onClose={() => setAdding(false)}
            browse={browse}
            onBrowse={setBrowse}
          />
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => openGrid(() => setAdding(true))} className={ADD_BUTTON_CLASS}>
            Add icon
          </button>
          <button type="button" onClick={() => add({ kind: 'text' })} className={ADD_BUTTON_CLASS}>
            Add text
          </button>
        </div>
      )}
    </div>
  );
}
