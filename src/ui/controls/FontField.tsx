import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getFontDefinition } from '../../fonts/registry';
import { FontPicker } from './FontPicker';
import { DEFAULT_FONT_BROWSE, useFontBrowseStore } from './fontBrowse';

interface FontFieldProps {
  label: string;
  value: string;
  onChange: (fontId: string) => void;
  /** Shown in each search result, in that font — see FontPicker. */
  previewText: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  browseKey?: string;
}

function placement(anchor: HTMLElement | null) {
  const rect = anchor?.getBoundingClientRect();
  const width = Math.min(400, window.innerWidth - 32);
  const height = Math.min(580, window.innerHeight - 32);
  const edge = anchor?.closest('aside')?.getBoundingClientRect().right ?? rect?.right ?? 16;
  return {
    width, height,
    left: Math.max(16, Math.min(edge + 12, window.innerWidth - width - 16)),
    top: Math.max(16, Math.min(rect?.top ?? 16, window.innerHeight - height - 16)),
  };
}

function FontChooser({ anchor, id, browseKey, onOpenChange, ...props }: Omit<FontFieldProps, 'open'> & { anchor: HTMLButtonElement | null; id: string; browseKey: string }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => placement(anchor));
  const browse = useFontBrowseStore((state) => state.fields[browseKey] ?? DEFAULT_FONT_BROWSE);
  const setBrowse = useFontBrowseStore((state) => state.setBrowse);
  function done() {
    onOpenChange(false);
    anchor?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const reposition = () => setPosition(placement(anchor));
    const outside = (event: Event) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target) && !anchor?.contains(event.target)) onOpenChange(false);
    };
    window.addEventListener('resize', reposition);
    document.addEventListener('click', outside);
    document.addEventListener('focusin', outside);
    return () => {
      window.removeEventListener('resize', reposition);
      document.removeEventListener('click', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [anchor, onOpenChange]);

  return createPortal(
    <div
      id={id}
      ref={panelRef}
      role="dialog"
      aria-label={`Choose ${props.label.toLowerCase()}`}
      className="fixed z-40 rounded-xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-700 dark:bg-stone-900"
      style={position}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          done();
        }
      }}
    >
      <FontPicker {...props} onDone={done} browse={browse} onBrowse={(next) => setBrowse(browseKey, next)} />
    </div>,
    document.body,
  );
}

/** The chooser floats beside the pane so opening it never displaces controls. */
export function FontField({ label, value, onChange, previewText, open, onOpenChange, browseKey = label }: FontFieldProps) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">{label}</span>
        <button
          ref={setAnchor}
          type="button"
          aria-label={`Change ${label.toLowerCase()}`}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => onOpenChange(!open)}
          className="control-action shrink-0"
        >
          Change
        </button>
      </div>
      <span className="truncate text-sm text-stone-600 dark:text-stone-400">{getFontDefinition(value).family}</span>
      {open && <FontChooser anchor={anchor} id={id} label={label} value={value} onChange={onChange} previewText={previewText} onOpenChange={onOpenChange} browseKey={browseKey} />}
    </div>
  );
}
