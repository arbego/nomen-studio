import { useEffect, useRef, useState } from 'react';
import type { ProductDefinition } from '../products/types';
import { hasUnsavedChanges } from '../project/projectSession';
import { saveProject } from '../project/saveProject';

interface SaveBeforeLeaveProps {
  product: ProductDefinition;
  open: boolean;
  onCancel: () => void;
  onLeave: () => void;
}

const BUTTON_CLASS = 'rounded-md border border-stone-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 dark:border-stone-600 dark:hover:bg-stone-800';

/** Keep leaving deliberate, with a project download available before returning to the picker. */
export function SaveBeforeLeave({ product, open, onCancel, onLeave }: SaveBeforeLeaveProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges(product)) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [product]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      dialog?.showModal();
    } else {
      dialog?.close();
    }
  }, [open]);

  function cancel() {
    setFailed(false);
    onCancel();
  }

  return (
    <dialog ref={dialogRef} onCancel={cancel} aria-labelledby="leave-project-title" aria-describedby="leave-project-description" className="m-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-xl backdrop:bg-black/40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
      <h2 id="leave-project-title" className="text-lg font-semibold">Save your project before leaving?</h2>
      <p id="leave-project-description" className="mt-2 text-sm text-stone-500 dark:text-stone-400">Download a project file so you can open it later and continue editing.</p>
      {failed && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">That project couldn't be saved. Please try again.</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" autoFocus onClick={cancel} className={BUTTON_CLASS}>Cancel</button>
        <button type="button" onClick={onLeave} className={BUTTON_CLASS}>Leave without saving</button>
        <button type="button" onClick={() => {
          try {
            saveProject(product);
            onLeave();
          } catch {
            setFailed(true);
          }
        }} className={`${BUTTON_CLASS} border-orange-300 bg-orange-300 text-stone-900 hover:bg-orange-400 dark:border-orange-300 dark:hover:bg-orange-400`}>Save and leave</button>
      </div>
    </dialog>
  );
}
