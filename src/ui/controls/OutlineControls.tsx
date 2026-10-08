import { SliderField } from './SliderField';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import type { OutlineHoleCandidate } from '../../geometry/outline';
import { usePanelStore } from '../panelStore';

/** Which letter a hole was attributed to, for counting how many share one. */
function letterOf(candidate: OutlineHoleCandidate): string {
  return `${candidate.lineIndex}-${candidate.letterIndex}`;
}

interface OutlineControlsProps {
  enabled: boolean;
  onChangeEnabled: (enabled: boolean) => void;
  growMm: number;
  onChangeGrow: (growMm: number) => void;
  color: string;
  onChangeColor: (hex: string) => void;
  depthMm: number;
  onChangeDepth: (depthMm: number) => void;
  /** The word's own thickness — the card's height is capped here so it can never grow tall enough to become flush with (and so hide) the letters. */
  maxDepthMm: number;
  /** Every counter hole (e.g. the "a" in a script font) currently detected at this growMm. */
  holeCandidates: OutlineHoleCandidate[];
  /** Fills every hole in at once, or opens them all again. */
  onSetAllHoles: (keys: string[], closed: boolean) => void;
  closedOutlineHoles: string[];
  onToggleHole: (key: string) => void;
  className?: string;
}

const GROW_RANGE = { min: 0.5, max: 20, step: 0.5 };
const MIN_DEPTH_MM = 0.5;

export function OutlineControls({
  enabled,
  onChangeEnabled,
  growMm,
  onChangeGrow,
  color,
  onChangeColor,
  depthMm,
  onChangeDepth,
  maxDepthMm,
  holeCandidates,
  closedOutlineHoles,
  onToggleHole,
  onSetAllHoles,
  className = '',
}: OutlineControlsProps) {
  // Straight from the store rather than through a prop: pointing at a row is
  // chrome shared with the preview, not something this product's design knows
  // about — the same channel CollapsibleSection uses.
  const setHighlighted = usePanelStore((state) => state.setHighlighted);
  const holesPerLetter = new Map<string, number>();
  for (const candidate of holeCandidates) {
    const letter = letterOf(candidate);
    holesPerLetter.set(letter, (holesPerLetter.get(letter) ?? 0) + 1);
  }
  const allClosed = holeCandidates.length > 0 && holeCandidates.every((candidate) => closedOutlineHoles.includes(candidate.key));

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <label className="flex items-center justify-between">
        <span className="text-sm text-stone-600 dark:text-stone-400">Add a solid card behind the name</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChangeEnabled(e.target.checked)}
          className="h-4 w-4 accent-stone-800 dark:accent-stone-300"
          aria-label="Add a solid backing card under the name"
        />
      </label>

      {enabled && (
        <>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            A separate solid card behind the name, shaped to its outline. Grow it until a disconnected part (like an "i" dot) merges into the card.
          </p>
          <SliderField label="Grow" value={growMm} onChange={onChangeGrow} min={GROW_RANGE.min} max={GROW_RANGE.max} step={GROW_RANGE.step} />
          <SliderField label="Height" value={depthMm} onChange={onChangeDepth} min={MIN_DEPTH_MM} max={maxDepthMm} step={0.25} />
          <ColorSwatchPicker label="Outline color" value={color} onChange={onChangeColor} variant="field" />
          {holeCandidates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-stone-600 dark:text-stone-400">Counter holes</span>
                <button
                  type="button"
                  onClick={() => onSetAllHoles(holeCandidates.map((candidate) => candidate.key), !allClosed)}
                  className="shrink-0 rounded px-1 py-0.5 text-xs text-stone-500 dark:text-stone-400 underline decoration-dotted underline-offset-2 transition-colors hover:text-stone-900 dark:hover:text-stone-100"
                >
                  {allClosed ? 'Open all' : 'Fill all in'}
                </button>
              </div>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                Fill one in if you'd rather it print solid, like the rest of the card. Or hold Ctrl in the preview and click the hole itself.
              </p>
              <div className="flex flex-col gap-1">
                {holeCandidates.map((candidate) => {
                  const closed = closedOutlineHoles.includes(candidate.key);
                  // A letter often has more than one hole — lines dragged
                  // across each other close pockets between their strokes, and
                  // each is attributed to whichever letter is nearest. Saying
                  // which one keeps two rows from reading as the same row.
                  const siblings = holesPerLetter.get(letterOf(candidate)) ?? 1;
                  const where = `line ${candidate.lineIndex + 1}, letter ${candidate.letterIndex + 1}${siblings > 1 ? `, hole ${candidate.holeIndex + 1} of ${siblings}` : ''}`;
                  return (
                    <label
                      key={candidate.key}
                      // Lights the hole up in the preview, which is the only
                      // way to tell "line 1, letter 3, hole 2 of 2" from its
                      // neighbour without counting.
                      onPointerEnter={() => setHighlighted(candidate.key)}
                      onPointerLeave={() => setHighlighted(null)}
                      className="-mx-1 flex items-center justify-between gap-2 rounded px-1 py-0.5 text-sm text-stone-600 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                    >
                      <span className="min-w-0 truncate">
                        “{candidate.char}” ({where})
                      </span>
                      <input
                        type="checkbox"
                        checked={closed}
                        onChange={() => onToggleHole(candidate.key)}
                        className="h-4 w-4 shrink-0 accent-stone-800 dark:accent-stone-300"
                        aria-label={`Fill the "${candidate.char}" hole (${where}) solid`}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
