import { useRef, useState } from 'react';
import { getProduct } from '../products/registry';
import { parseProjectFile, ProjectFileError } from '../project/projectFile';
import { saveProject } from '../project/saveProject';
import type { ProductDefinition } from '../products/types';

const BUTTON_CLASS = 'inline-flex items-center justify-center gap-2 border border-stone-200 bg-white font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-800';

function SaveIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" />
      <path d="M7 3v6h10V3M7 21v-8h10v8" />
    </svg>
  );
}

export function SaveProjectButton({ product }: { product: ProductDefinition }) {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" disabled={busy} onClick={async () => {
        setFailed(false);
        setBusy(true);
        try { await saveProject(product); } catch { setFailed(true); } finally { setBusy(false); }
      }} className={`${BUTTON_CLASS} h-10 rounded-full px-4 text-sm shadow-md disabled:cursor-not-allowed disabled:opacity-50`}>
        <SaveIcon />
        Save project
      </button>
      {failed && <p role="alert" className="rounded-lg bg-white/95 px-3 py-2 text-xs text-red-600 dark:bg-stone-900/95 dark:text-red-400">That project couldn't be saved. Please try again.</p>}
    </div>
  );
}

/** Open a file from the picker, then enter the studio it belongs to. */
export function OpenProjectButton({ onOpened }: { onOpened: (productId: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFailure(null);
    try {
      const parsed = parseProjectFile(await file.text(), (id) => getProduct(id) !== undefined);
      // Not necessarily the product on screen: a file carries its own.
      getProduct(parsed.product)!.project.load(parsed.design);
      onOpened(parsed.product);
    } catch (error) {
      setFailure(error instanceof ProjectFileError ? error.message : "That project file couldn't be opened.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} className={`${BUTTON_CLASS} rounded-md px-3 py-2 text-xs`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
            <path d="M3 17V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2" />
            <path d="M5 21h14a2 2 0 0 0 2-1.6l1-7A2 2 0 0 0 20 10H7a2 2 0 0 0-2 1.6l-2 7A2 2 0 0 0 5 21Z" />
          </svg>
          Open project
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so picking the same file twice in a row fires again —
            // the natural thing to do after editing it by hand.
            event.target.value = '';
            if (file) void handleFile(file);
          }}
        />
      </div>
      {failure && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{failure}</p>}
    </div>
  );
}
