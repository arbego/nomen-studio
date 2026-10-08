import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { FONT_REGISTRY, getFontDefinition } from '../../fonts/registry';
import { searchCatalog, type CatalogFontEntry } from '../../fonts/catalog';
import type { FontCategory } from '../../fonts/types';

interface FontPickerProps {
  label: string;
  value: string;
  onChange: (fontId: string) => void;
  /** Rendered inside each search result, in that font — the name currently being designed, so "preview" shows the user's own text, not just the family name. */
  previewText: string;
  /** Given when the picker is opened on demand (see FontField), which puts a way of closing it again in its own heading. */
  onDone?: () => void;
}

const CATEGORY_OPTIONS: { value: FontCategory | ''; label: string }[] = [
  { value: '', label: 'All categories' },
  { value: 'sans-serif', label: 'Sans Serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'display', label: 'Display' },
  { value: 'handwriting', label: 'Handwriting' },
  { value: 'monospace', label: 'Monospace' },
];

// Browser Font Loading API cache for search-result *previews* only — kept
// entirely separate from loadFont.ts's cache of parsed opentype.js Font
// objects (used for the actually-selected font's 3D geometry). A preview only
// ever needs the browser's own native 2D text rendering, so there's no reason
// to run the heavier fetch+opentype.js-parse pipeline for every row a person
// merely scrolls past while searching.
const previewFaceCache = new Map<string, Promise<void>>();

function previewFontFamily(id: string): string {
  return `gf-preview-${id}`;
}

function loadPreviewFace(id: string, url: string): Promise<void> {
  let pending = previewFaceCache.get(id);
  if (!pending) {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined') {
      return Promise.reject(new Error('FontFace API unavailable'));
    }
    const face = new FontFace(previewFontFamily(id), `url("${url}")`);
    pending = face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
    previewFaceCache.set(id, pending);
    pending.catch(() => previewFaceCache.delete(id));
  }
  return pending;
}

function FontResultRow({ entry, previewText, selected, onSelect }: { entry: CatalogFontEntry; previewText: string; selected: boolean; onSelect: () => void }) {
  const [loaded, setLoaded] = useState(false);

  // Keyed by entry.id in the parent list, so a different font here always
  // means a freshly-mounted instance (fresh `loaded = false`) rather than
  // this effect re-running with new deps on the same instance.
  useEffect(() => {
    let cancelled = false;
    loadPreviewFace(entry.id, entry.url)
      .then(() => {
        if (!cancelled) setLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entry.id, entry.url]);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-font-id={entry.id}
      aria-pressed={selected}
      className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors ${
        selected ? 'bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900' : 'hover:bg-stone-100 dark:hover:bg-stone-800'
      }`}
    >
      <span className="w-full truncate text-lg leading-tight" style={loaded ? { fontFamily: previewFontFamily(entry.id) } : undefined}>
        {previewText}
      </span>
      <span className={`text-xs ${selected ? 'text-stone-300 dark:text-stone-600' : 'text-stone-500 dark:text-stone-400'}`}>{entry.family}</span>
    </button>
  );
}

export function FontPicker({ label, value, onChange, previewText, onDone }: FontPickerProps) {
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FontCategory | ''>('');

  const results = searchCatalog(query, category || undefined);
  const selectedDefinition = getFontDefinition(value);
  const selectedIsCurated = FONT_REGISTRY.some((f) => f.id === value);

  useEffect(() => {
    const selected = [...(resultsRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((button) => button.dataset.fontId === value);
    selected?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [value, query, category]);

  function navigateFonts(event: KeyboardEvent<HTMLElement>, fonts: { id: string }[], container: HTMLElement | null, moveFocus: boolean) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!fonts.length) return;
    const selectedIndex = fonts.findIndex((font) => font.id === value);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = selectedIndex < 0
      ? (direction === 1 ? 0 : fonts.length - 1)
      : Math.max(0, Math.min(fonts.length - 1, selectedIndex + direction));
    const next = fonts[nextIndex]!;
    if (next.id !== value) onChange(next.id);
    const button = [...(container?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((candidate) => candidate.dataset.fontId === next.id);
    if (moveFocus) button?.focus({ preventScroll: true });
    button?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">{label}</span>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="control-action shrink-0"
          >
            Done
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" onKeyDown={(event) => navigateFonts(event, FONT_REGISTRY, event.currentTarget, true)}>
        {FONT_REGISTRY.map((font) => (
          <button
            key={font.id}
            type="button"
            onClick={() => onChange(font.id)}
            data-font-id={font.id}
            aria-pressed={value === font.id}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === font.id
                ? 'border-stone-800 dark:border-stone-200 bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900'
                : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500'
            }`}
          >
            {font.label}
          </button>
        ))}
      </div>

      {!selectedIsCurated && <p className="text-xs text-stone-500 dark:text-stone-400">Selected: {selectedDefinition.family}</p>}

      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(event) => navigateFonts(event, results, resultsRef.current, false)}
          aria-label="Search Google Fonts"
          placeholder="Search Google Fonts…"
          className="min-w-0 flex-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 outline-none transition-colors focus:border-stone-500 dark:focus:border-stone-400"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as FontCategory | '')}
          className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 py-2 text-sm text-stone-700 dark:text-stone-300 outline-none transition-colors focus:border-stone-500 dark:focus:border-stone-400"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div ref={resultsRef} onKeyDown={(event) => navigateFonts(event, results, event.currentTarget, true)} className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-lg border border-stone-200 dark:border-stone-700 p-1">
        {results.length === 0 && <p className="px-2 py-3 text-center text-sm text-stone-500 dark:text-stone-400">No fonts match your search.</p>}
        {results.map((entry) => (
          <FontResultRow key={entry.id} entry={entry} previewText={previewText} selected={value === entry.id} onSelect={() => onChange(entry.id)} />
        ))}
      </div>
    </div>
  );
}
