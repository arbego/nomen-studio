import { useMemo, useState } from 'react';
import { iconChar, searchIcons, SUGGESTED_ICONS } from '../../icons/catalog';

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
 * A searchable grid of every icon in the set.
 *
 * Results are capped by the catalogue rather than paged: two thousand tiles is
 * not a thing anyone scrolls, and typing two letters narrows it far faster than
 * scrolling ever would.
 */
export function IconPicker({ value, onChange, onClose }: IconPickerProps) {
  const [query, setQuery] = useState('');
  // With nothing typed, show a few that suit this kind of piece instead of
  // whatever happens to sort first alphabetically (which is "10k").
  const results = useMemo(() => (query.trim() ? searchIcons(query) : SUGGESTED_ICONS.map((name) => ({ name, codepoint: 0 }))), [query]);

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
