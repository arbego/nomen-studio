import { useMemo } from 'react';
import { DEFAULT_RESULT_LIMIT, getIcon, getIconSet, iconChar, iconCount, ICON_SETS, searchIcons, SUGGESTED_ICONS, type IconSetId } from '../../icons/catalog';

/** How the grid is currently being browsed: what has been typed, which set's tab is on, and whether the result cap has been lifted. */
export interface IconBrowse {
  query: string;
  /** undefined is the "All" tab. */
  set?: IconSetId;
  showAll: boolean;
}

/** A fresh browse — what a picker opens on. */
export const NEW_ICON_BROWSE: IconBrowse = { query: '', showAll: false };

interface IconPickerProps {
  /** The icon currently chosen, highlighted in the grid. Omitted when picking one for the first time. */
  value?: string;
  onChange: (iconName: string) => void;
  onClose: () => void;
  /**
   * Where the browsing is up to, and how to update it.
   *
   * Held by the caller rather than in here because a picker can move in the
   * middle of being used: picking the first icon for a new ornament turns the
   * grid into that ornament's own, which is a different place in the tree and so
   * a different React instance. Held in here, the search and the chosen tab
   * would be thrown away at exactly the moment someone is browsing with them.
   */
  browse: IconBrowse;
  onBrowse: (browse: IconBrowse) => void;
}

/** One icon, drawn with its own set's font rather than named — nobody picks an ornament from a list of words. */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`${getIconSet(getIcon(name).set).className} ${className}`} aria-hidden>
      {iconChar(name)}
    </span>
  );
}

const TAB_CLASS = 'rounded-md px-2.5 py-1 text-xs transition-colors';

/**
 * A searchable grid of the icon sets.
 *
 * The sets stay separate rather than merging into one list: they are three
 * drawing styles, and an ornament looks deliberate when its neighbours come from
 * the same one. "All" is still the default, because the first question is "is
 * there a cat at all" and only the second is "which cat".
 *
 * Results are capped rather than paged — typing two letters narrows them far
 * faster than scrolling would — but the cap is only a default: "Show all" lifts
 * it for anyone who would rather browse, whether they have typed something or
 * not.
 *
 * Picking does not close this. Every pick lands on the piece straight away, so
 * leaving it open turns "try that one against the letter" into one click
 * instead of four — and the search and the chosen set survive, which is what
 * makes clicking through a set bearable at all.
 */
export function IconPicker({ value, onChange, onClose, browse, onBrowse }: IconPickerProps) {
  const { query, set, showAll } = browse;
  const setQuery = (next: string) => onBrowse({ ...browse, query: next });
  const setShowAll = (next: boolean) => onBrowse({ ...browse, showAll: next });
  const setSet = (next: IconSetId | undefined) => onBrowse({ ...browse, set: next });

  const results = useMemo(() => {
    const limit = showAll ? Number.POSITIVE_INFINITY : undefined;
    if (query.trim() || set) {
      return searchIcons(query, set, limit);
    }
    // With nothing typed and no set chosen, show a few that suit this kind of
    // piece instead of whatever happens to sort first alphabetically (which is
    // "10k"), and which between them show that there is more than one style.
    return showAll ? searchIcons('', undefined, limit) : SUGGESTED_ICONS.map(getIcon);
  }, [query, set, showAll]);

  const total = iconCount(set);
  // Whether anything is being held back — the only case where offering to show
  // everything says something the grid does not already show.
  const capped = !showAll && (query.trim() || set ? results.length >= DEFAULT_RESULT_LIMIT : true);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          aria-label="Search icons"
          className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 px-2.5 py-1.5 text-sm outline-none focus:border-stone-400 dark:focus:border-stone-500"
        />
        {/* "Done", not "Cancel": a pick lands on the piece the moment it is
            made, so by the time you close this there is nothing left to undo. */}
        <button type="button" onClick={onClose} className="shrink-0 text-xs text-stone-500 dark:text-stone-400 underline decoration-dotted underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200">
          Done
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setSet(undefined)}
          aria-pressed={set === undefined}
          className={`${TAB_CLASS} ${set === undefined ? 'bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
        >
          All
        </button>
        {ICON_SETS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => setSet(candidate.id)}
            aria-pressed={set === candidate.id}
            title={candidate.blurb}
            className={`${TAB_CLASS} ${set === candidate.id ? 'bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      {set && <p className="text-xs text-stone-400 dark:text-stone-500">{getIconSet(set).blurb}</p>}

      <div className="flex items-center justify-between gap-2 text-xs text-stone-400 dark:text-stone-500">
        <span>{showAll && !query.trim() ? `All ${total} icons` : `${results.length} ${results.length === 1 ? 'icon' : 'icons'}`}</span>
        {capped ? (
          <button type="button" onClick={() => setShowAll(true)} className="shrink-0 text-stone-500 dark:text-stone-400 underline decoration-dotted underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200">
            Show all {total}
          </button>
        ) : (
          showAll && (
            <button type="button" onClick={() => setShowAll(false)} className="shrink-0 text-stone-500 dark:text-stone-400 underline decoration-dotted underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200">
              Show fewer
            </button>
          )
        )}
      </div>

      {results.length === 0 ? (
        <p className="py-4 text-center text-xs text-stone-400 dark:text-stone-500">No icon matches “{query.trim()}”.</p>
      ) : (
        <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto">
          {results.map((icon) => (
            <button
              key={icon.id}
              type="button"
              title={`${icon.name} — ${getIconSet(icon.set).label}`}
              aria-label={icon.name}
              aria-pressed={icon.id === value}
              onClick={() => onChange(icon.id)}
              className={`flex aspect-square items-center justify-center rounded-md border text-stone-700 dark:text-stone-300 transition-colors hover:border-stone-400 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800 ${
                icon.id === value ? 'border-stone-800 dark:border-stone-200 bg-stone-100 dark:bg-stone-700' : 'border-transparent'
              }`}
            >
              <Icon name={icon.id} className="text-[22px]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
