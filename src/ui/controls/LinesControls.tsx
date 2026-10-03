import { TextField } from './TextField';

interface LinesControlsProps {
  lines: string[];
  onChangeLine: (index: number, text: string) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
}

/** One base line plus up to 2 more — matches MAX_LINES in topperStore.ts. */
const MAX_LINES = 3;

export function LinesControls({ lines, onChangeLine, onAddLine, onRemoveLine }: LinesControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold uppercase tracking-wide text-stone-700">Text</span>
      <div className="flex flex-col gap-2">
        {lines.map((line, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="flex-1">
              <TextField label={`Line ${index + 1}`} value={line} onChange={(text) => onChangeLine(index, text)} maxLength={16} placeholder="Emma" />
            </div>
            <button
              type="button"
              onClick={() => onRemoveLine(index)}
              disabled={lines.length <= 1}
              aria-label={`Remove line ${index + 1}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              −
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAddLine}
        disabled={lines.length >= MAX_LINES}
        className="self-start rounded-lg border border-dashed border-stone-300 px-3 py-1.5 text-sm text-stone-600 transition-colors hover:border-stone-500 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-30"
      >
        + Add line
      </button>
    </div>
  );
}
