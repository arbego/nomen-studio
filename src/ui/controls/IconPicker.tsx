import { useMemo, useState } from 'react';
import { DEFAULT_RESULT_LIMIT, getIcon, ICON_COUNT, iconChar, searchIcons, SUGGESTED_ICONS } from '../../icons/catalog';

interface IconPickerProps {
  /** The icon currently chosen, highlighted in the grid. Omitted when picking one for the first time. */
  value?: string;
  onChange: (iconName: string) => void;
  onClose: () => void;
}

/** One icon, drawn with the icon font rather than named — nobody picks an ornament from a list of words. */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-icon ${className}`} aria-hidden>
      {iconChar(name)}
    </span>
  );
}

/**
 * A searchable grid of the icon set.
 *
 * Results are capped rather than paged — typing two letters narrows them far
 * faster than scrolling would — but the cap is only a default: "Show all" lifts
 * it for anyone who would rather browse, whether they have typed something or
 * not.
 */
export function IconPicker({ value, onChange, onClose }: IconPickerProps) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const results = useMemo(() => {
    if (query.trim()) {
      return searchIcons(query, showAll ? Number.POSITIVE_INFINITY : undefined);
    }
    // With nothing typed, show a few that suit this kind of piece instead of
    // whatever happens to sort first alphabetically (which is "10k").
    return showAll ? searchIcons('', Number.POSITIVE_INFINITY) : SUGGESTED_ICONS.map(getIcon);
  }, [query, showAll]);

  // Whether anything is being held back — the only case where offering to show
  // everything says something the grid does not already show.
  const capped = !showAll && (query.trim() ? results.length >= DEFAULT_RESULT_LIMIT : true);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          aria-label="Search icons"
          className="min-w-0 flex-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-sm outline-none focus:border-stone-400"
        />
        <button type="button" onClick={onClose} className="shrink-0 text-xs text-stone-500 underline decoration-dotted underline-offset-2 hover:text-stone-800">
          Cancel
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-stone-400">
        <span>
          {showAll && !query.trim() ? `All ${ICON_COUNT} icons` : `${results.length} ${results.length === 1 ? 'icon' : 'icons'}`}
        </span>
        {capped ? (
          <button type="button" onClick={() => setShowAll(true)} className="shrink-0 text-stone-500 underline decoration-dotted underline-offset-2 hover:text-stone-800">
            Show all {ICON_COUNT}
          </button>
        ) : (
          showAll && (
            <button type="button" onClick={() => setShowAll(false)} className="shrink-0 text-stone-500 underline decoration-dotted underline-offset-2 hover:text-stone-800">
              Show fewer
            </button>
          )
        )}
      </div>

      {results.length === 0 ? (
        <p className="py-4 text-center text-xs text-stone-400">No icon matches “{query.trim()}”.</p>
      ) : (
        <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto">
          {results.map((icon) => (
            <button
              key={icon.name}
              type="button"
              title={icon.name}
              aria-label={icon.name}
              aria-pressed={icon.name === value}
              onClick={() => onChange(icon.name)}
              className={`flex aspect-square items-center justify-center rounded-md border text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 ${
                icon.name === value ? 'border-stone-800 bg-stone-100' : 'border-transparent'
              }`}
            >
              <Icon name={icon.name} className="text-[22px]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
