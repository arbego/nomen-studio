import { getFontDefinition } from '../../fonts/registry';
import { FontPicker } from './FontPicker';

interface FontFieldProps {
  label: string;
  value: string;
  onChange: (fontId: string) => void;
  /** Shown in each search result, in that font — see FontPicker. */
  previewText: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Which face a piece is set in: one line, with the picker on demand.
 *
 * The picker is a tall search panel — getting on for five hundred pixels of
 * chips, search box and results — and two or three of them stacked down the
 * sidebar bury everything else in the panel. This is the same trade the
 * ornaments have always made with theirs, and it hides nothing: the font in use
 * is named right there, and choosing one is a thing you do once per design
 * rather than a thing you keep adjusting.
 *
 * Controlled, so a panel can keep to one picker open at a time — two tall
 * search panels at once is the thing being avoided in the first place.
 */
export function FontField({ label, value, onChange, previewText, open, onOpenChange }: FontFieldProps) {
  if (open) {
    return <FontPicker label={label} value={value} onChange={onChange} previewText={previewText} onDone={() => onOpenChange(false)} />;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">{label}</span>
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="shrink-0 rounded px-1 py-0.5 text-xs text-stone-500 dark:text-stone-400 underline decoration-dotted underline-offset-2 transition-colors hover:text-stone-900 dark:hover:text-stone-100"
        >
          Change
        </button>
      </div>
      <span className="truncate text-sm text-stone-600 dark:text-stone-400">{getFontDefinition(value).family}</span>
    </div>
  );
}
