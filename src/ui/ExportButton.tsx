import { useState } from 'react';
import { saveAs } from 'file-saver';

/** One finished export: the file's bytes and the name to save it under. */
export interface ExportFile {
  blob: Blob;
  filename: string;
}

interface ExportButtonProps {
  /**
   * Builds the 3MF, or null when there is nothing to export yet — a build still
   * in flight, or one that failed.
   *
   * A thunk rather than a ready-made blob because building one means writing out
   * every triangle of the design: doing that on every render, for a file nobody
   * has asked for, would cost more than the preview itself.
   */
  build: (() => ExportFile) | null;
  /** What to say when `build` throws. Each product knows its own ways of ending up with nothing solid to write. */
  failureMessage: string;
}

/**
 * The one export control, pinned over the preview rather than buried at the
 * bottom of the sidebar: it is the thing you came to do, it applies to the whole
 * design rather than to any one section, and it is the same action in every
 * product.
 *
 * Deliberately one button and one format. Every product exports 3MF (see
 * export/threeMfExport.ts), so a format choice would be a choice between 3MF and
 * nothing.
 */
export function ExportButton({ build, failureMessage }: ExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function handleClick() {
    if (!build) return;
    setBusy(true);
    setFailed(false);
    try {
      const { blob, filename } = build();
      saveAs(blob, filename);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={!build || busy}
        title="Export the design as a 3MF for your slicer"
        // The accent color is the same in both themes: it sits over the 3D
        // scene, whose lighting never changes with the UI theme, so it is paint
        // on the model's world rather than part of the surrounding chrome.
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-transparent bg-orange-300 px-4 text-sm font-semibold text-stone-900 shadow-md transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-orange-300"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          <path d="M12 3v11" />
          <path d="M7.5 9.5 12 14l4.5-4.5" />
          <path d="M4.5 19.5h15" />
        </svg>
        {busy ? 'Preparing…' : 'Export'}
      </button>
      {failed && (
        <p className="max-w-64 rounded-lg border border-red-200 dark:border-red-900 bg-white/95 dark:bg-stone-900/95 px-3 py-2 text-xs text-red-600 dark:text-red-400 shadow-md backdrop-blur">
          {failureMessage}
        </p>
      )}
    </div>
  );
}
