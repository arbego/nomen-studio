import { useEffect, useRef, useState } from 'react';
import { SliderField } from '../../ui/controls/SliderField';
import { ColorSwatchPicker } from '../../ui/controls/ColorSwatchPicker';
import { Icon, IconPicker } from '../../ui/controls/IconPicker';
import { NEW_ICON_BROWSE, type IconBrowse } from '../../ui/controls/iconBrowse';
import { FocusTarget } from '../../ui/FocusTarget';
import { useIsOpen, usePanelStore } from '../../ui/panelStore';
import { getIcon, getIconSet } from '../../icons/catalog';
import { decoratorFocusKey } from './focus';
import type { CakeTopperDecoratorConfig, DecoratorPlacementConfig } from './config';

interface DecoratorControlsProps {
  decorators: CakeTopperDecoratorConfig[];
  /** Where each one sits and how far it is turned, keyed by id — the angle is editable here, the position by dragging. */
  placements: Record<string, DecoratorPlacementConfig>;
  colors: Record<string, string>;
  /** What an ornament with no colour of its own shows as — the lettering's, since that is the filament it would print in. */
  fallbackColor: string;
  /** Returns the new ornament's id, so the grid that added it can go on changing it instead of adding more. */
  onAdd: (iconName: string) => string;
  onUpdate: (id: string, patch: Partial<Omit<CakeTopperDecoratorConfig, 'id'>>) => void;
  onRemove: (id: string) => void;
  onChangeAngle: (id: string, angleDeg: number) => void;
  onChangeColor: (id: string, color: string) => void;
}

const ADD_BUTTON_CLASS =
  'rounded-lg border border-dashed border-stone-300 dark:border-stone-600 px-4 py-2 text-sm text-stone-600 dark:text-stone-400 transition-colors hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-stone-100';

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

/**
 * One ornament: a row naming it, and everything that shapes it folded away
 * behind that row — same as the name display's, and for the same reason. A card
 * runs to most of a screen, and a piece with four ornaments on it would be a
 * panel you scroll past rather than read.
 */
function DecoratorCard({
  decorator,
  onOpenIcon,
  onRemove,
  children,
}: {
  decorator: CakeTopperDecoratorConfig;
  onOpenIcon: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const id = decoratorFocusKey(decorator.id);
  const open = useIsOpen(id);
  const setOpen = usePanelStore((state) => state.setOpen);

  return (
    <FocusTarget focusKey={id} className="flex flex-col gap-3 rounded-lg border border-stone-200 dark:border-stone-700 p-3">
      <div className="flex items-center gap-2">
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
        <button type="button" onClick={() => setOpen(id, !open)} aria-expanded={open} className="group flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1 truncate text-sm text-stone-600 dark:text-stone-400">
            <IconName id={decorator.iconName} />
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
          aria-label={`Remove ${getIcon(decorator.iconName).name}`}
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
 * The ornaments on the topper: add a symbol, say how big, how thick, how turned
 * and what colour it is. Where it sits is set by dragging it in the preview —
 * there is no control for position here, because a number pair is a worse way to
 * place something than putting it where you want it.
 *
 * Icons only. A word belongs in the lettering, which already sets it in the
 * piece's own face and at the piece's own scale, and wraps it in the same card.
 */
export function DecoratorControls({ decorators, placements, colors, fallbackColor, onAdd, onUpdate, onRemove, onChangeAngle, onChangeColor }: DecoratorControlsProps) {
  const [editingIconOf, setEditingIconOf] = useState<string | null>(null);
  // Whether the grid for adding one is open. It belongs to no ornament yet —
  // the first pick makes one and hands the grid over to that ornament's card.
  const [adding, setAdding] = useState(false);
  // One browse across both, so the handover doesn't throw away the search.
  const [browse, setBrowse] = useState<IconBrowse>(NEW_ICON_BROWSE);
  const setOpen = usePanelStore((state) => state.setOpen);

  function openGrid(open: () => void) {
    // Every grid *opened* starts fresh — last week's search is not this
    // ornament's. Only the add-to-edit handover carries a browse across.
    setBrowse(NEW_ICON_BROWSE);
    open();
  }

  /** Adds an ornament and opens its card, since a new one arriving folded away would look like nothing happened. */
  function add(iconName: string): string {
    const id = onAdd(iconName);
    setOpen(decoratorFocusKey(id), true);
    return id;
  }

  const gridRef = useRef<HTMLDivElement>(null);
  const openGridId = adding ? 'adding' : editingIconOf;
  useEffect(() => {
    // A grid that opens below the fold, or one that moves into the card above
    // when the first pick adds an ornament, is a grid you have to go looking
    // for. `nearest` moves as little as it can to put it back on screen.
    if (openGridId) {
      gridRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [openGridId]);

  return (
    <>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Symbols printed alongside the lettering, each in its own filament. Drag one in the preview to move it — keep it over the lettering, or over the backing card, so
        the printed piece holds together.
      </p>

      {decorators.map((decorator) => (
        <DecoratorCard
          key={decorator.id}
          decorator={decorator}
          onOpenIcon={() => openGrid(() => setEditingIconOf(editingIconOf === decorator.id ? null : decorator.id))}
          onRemove={() => onRemove(decorator.id)}
        >
          {editingIconOf === decorator.id && (
            // Stays open as you click: every pick lands on the piece
            // immediately, so trying symbols against the lettering is one click
            // each rather than four. Done closes it.
            <div ref={gridRef}>
              <IconPicker
                value={decorator.iconName}
                onChange={(iconName) => onUpdate(decorator.id, { iconName })}
                onClose={() => setEditingIconOf(null)}
                browse={browse}
                onBrowse={setBrowse}
              />
            </div>
          )}

          <SliderField label="Size" value={decorator.widthMm} onChange={(widthMm) => onUpdate(decorator.id, { widthMm })} min={5} max={120} />
          <SliderField label="Thickness" value={decorator.depthMm} onChange={(depthMm) => onUpdate(decorator.id, { depthMm })} min={0.5} max={15} step={0.5} />
          <SliderField label="Angle" value={placements[decorator.id]?.angleDeg ?? 0} onChange={(angleDeg) => onChangeAngle(decorator.id, angleDeg)} min={-180} max={180} unit="°" />
          <ColorSwatchPicker label="Color" variant="field" hint={null} value={colors[decorator.id] ?? fallbackColor} onChange={(color) => onChangeColor(decorator.id, color)} />
        </DecoratorCard>
      ))}

      {adding ? (
        <div ref={gridRef}>
          <IconPicker
            onChange={(iconName) => {
              setEditingIconOf(add(iconName));
              setAdding(false);
            }}
            onClose={() => setAdding(false)}
            browse={browse}
            onBrowse={setBrowse}
          />
        </div>
      ) : (
        <button type="button" onClick={() => openGrid(() => setAdding(true))} className={`self-start ${ADD_BUTTON_CLASS}`}>
          + Add icon
        </button>
      )}
    </>
  );
}
