import { FocusTarget } from '../FocusTarget';
import { TextField } from './TextField';

interface LinesControlsProps {
  lines: string[];
  onChangeLine: (index: number, text: string) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  /** What clicking this line in the preview asks for, so it can be revealed here. A product that doesn't wire the preview up simply omits it. */
  focusKeyForLine?: (index: number) => string;
}

/** One base line plus up to 2 more — matches MAX_LINES in topperStore.ts. */
const MAX_LINES = 3;

export function LinesControls({ lines, onChangeLine, onAddLine, onRemoveLine, focusKeyForLine }: LinesControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">Text</span>
      <div className="flex flex-col gap-2">
        {lines.map((line, index) => (
          // Padded so the wash has a little room around the field, and pulled back in margin so nothing moves when it isn't lit.
          <FocusTarget key={index} focusKey={focusKeyForLine?.(index)} className="-mx-2 -my-1 flex items-end gap-2 px-2 py-1">
            <div className="flex-1">
              <TextField label={`Line ${index + 1}`} value={line} onChange={(text) => onChangeLine(index, text)} maxLength={16} placeholder="Emma" />
            </div>
            <button
              type="button"
              onClick={() => onRemoveLine(index)}
              disabled={lines.length <= 1}
              aria-label={`Remove line ${index + 1}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 transition-colors hover:border-stone-400 dark:hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              −
            </button>
          </FocusTarget>
        ))}
      </div>
      <button
        type="button"
        onClick={onAddLine}
        disabled={lines.length >= MAX_LINES}
        className="self-start rounded-lg border border-dashed border-stone-300 dark:border-stone-600 px-3 py-1.5 text-sm text-stone-600 dark:text-stone-400 transition-colors hover:border-stone-500 dark:hover:border-stone-400 hover:text-stone-800 dark:hover:text-stone-200 disabled:cursor-not-allowed disabled:opacity-30"
      >
        + Add line
      </button>
    </div>
  );
}
