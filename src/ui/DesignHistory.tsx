import { createContext, useContext, useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { DesignHistory } from '../store/designHistory';

const HistoryContext = createContext<DesignHistory | null>(null);

/** Mount only in an open product's studio, so shortcuts follow that product. */
export function DesignHistoryProvider({ history, children }: { history: DesignHistory; children: ReactNode }) {
  useEffect(() => {
    const endGroup = () => history.endGroup();
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      const undo = key === 'z' && !event.shiftKey;
      const redo = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.shiftKey);
      if (!undo && !redo) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const textInput = target instanceof HTMLInputElement && ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(target.type);
        const editable = textInput ? target : target.closest('textarea, select, [contenteditable]:not([contenteditable="false"])');
        // Design fields share the same timeline as the preview. Search fields
        // and other text editors retain their browser's own undo stack.
        if (editable && !editable.hasAttribute('data-design-input')) return;
      }
      event.preventDefault();
      if (undo) history.undo();
      else history.redo();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerup', endGroup);
    window.addEventListener('pointercancel', endGroup);
    window.addEventListener('blur', endGroup);
    return () => {
      history.endGroup();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerup', endGroup);
      window.removeEventListener('pointercancel', endGroup);
      window.removeEventListener('blur', endGroup);
    };
  }, [history]);

  return <HistoryContext.Provider value={history}>{children}</HistoryContext.Provider>;
}

/** Shared design fields group typing bursts and slider gestures automatically. */
export function DesignInput({ onChange, onBlur, onPointerDown, onKeyUp, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const history = useContext(HistoryContext);
  const key = useRef({});
  return (
    <input
      {...props}
      data-design-input=""
      onChange={(event) => {
        if (history) history.group(key.current, () => onChange?.(event), props.type === 'range' ? Infinity : 750);
        else onChange?.(event);
      }}
      // A range can emit its first input BEFORE focus moves. Neither its new
      // focus nor the previous field's blur should split that starting step.
      onBlur={(event) => { history?.endGroup(key.current); onBlur?.(event); }}
      onPointerDown={(event) => { history?.endGroup(); onPointerDown?.(event); }}
      onKeyUp={(event) => {
        if (props.type === 'range') history?.endGroup(key.current);
        onKeyUp?.(event);
      }}
    />
  );
}

const BUTTON_CLASS = 'flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white/90 text-stone-600 shadow-md backdrop-blur transition-colors hover:border-stone-400 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 disabled:cursor-not-allowed disabled:opacity-35 dark:border-stone-700 dark:bg-stone-900/90 dark:text-stone-400 dark:hover:border-stone-500 dark:hover:text-stone-100';

export function HistoryButtons({ history }: { history: DesignHistory }) {
  const canUndo = useStore(history, (state) => state.canUndo);
  const canRedo = useStore(history, (state) => state.canRedo);
  return (
    <div role="group" aria-label="Design history" className="flex gap-2">
      <button type="button" onClick={history.undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z / ⌘Z)" aria-keyshortcuts="Control+z Meta+z" className={BUTTON_CLASS}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12" transform="translate(0 -2)" />
        </svg>
      </button>
      <button type="button" onClick={history.redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z / ⌘⇧Z / Ctrl+Y)" aria-keyshortcuts="Control+Shift+z Meta+Shift+z Control+y" className={BUTTON_CLASS}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12" transform="translate(0 -2)" />
        </svg>
      </button>
    </div>
  );
}
