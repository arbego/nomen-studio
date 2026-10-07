import { useEffect, useRef, useState } from 'react';
import type { ProductDefinition } from '../products/types';
import { createShareUrl } from '../project/shareProject';

const BUTTON_CLASS = 'inline-flex items-center justify-center gap-2 border border-stone-200 bg-white font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-800';

export function ShareProjectButton({ product }: { product: ProductDefinition }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (url) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [url]);

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" disabled={busy} onClick={async () => {
        setBusy(true);
        setFailed(false);
        setCopyStatus('');
        try { setUrl(await createShareUrl(product, window.location.href)); }
        catch { setFailed(true); }
        finally { setBusy(false); }
      }} className={`${BUTTON_CLASS} h-10 rounded-full px-4 text-sm shadow-md disabled:cursor-not-allowed disabled:opacity-50`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
        </svg>
        {busy ? 'Creating link…' : 'Share'}
      </button>
      {failed && <p role="alert" className="rounded-lg bg-white/95 px-3 py-2 text-xs text-red-600 dark:bg-stone-900/95 dark:text-red-400">That share link couldn't be created. Please try again.</p>}
      <dialog ref={dialogRef} onCancel={() => setUrl(null)} onClose={() => setUrl(null)} aria-labelledby="share-project-title" aria-describedby="share-project-description" className="m-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-xl backdrop:bg-black/40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
        <h2 id="share-project-title" className="text-lg font-semibold">Share project</h2>
        <p id="share-project-description" className="mt-2 text-sm text-stone-500 dark:text-stone-400">Anyone with this link can open and edit a copy of this design. Later changes won't update the link.</p>
        <label htmlFor="share-project-url" className="mt-4 block text-sm font-medium">Project link</label>
        <input id="share-project-url" type="text" readOnly value={url ?? ''} onFocus={(event) => event.currentTarget.select()} className="mt-1 w-full rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800" />
        {copyStatus && <p role="status" className="mt-2 text-sm">{copyStatus}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setUrl(null)} className={`${BUTTON_CLASS} rounded-md px-3 py-2 text-sm`}>Close</button>
          <button type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(url!);
              setCopyStatus('Link copied.');
            } catch {
              setCopyStatus('Select the link above and copy it manually.');
            }
          }} className={`${BUTTON_CLASS} rounded-md px-3 py-2 text-sm`}>Copy link</button>
        </div>
      </dialog>
    </div>
  );
}
