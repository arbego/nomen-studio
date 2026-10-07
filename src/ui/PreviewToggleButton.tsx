import type { ReactNode } from 'react';

export const PREVIEW_BUTTON_CLASS =
  'flex h-10 w-10 items-center justify-center rounded-full border bg-white/90 dark:bg-stone-900/90 shadow-md backdrop-blur transition-colors hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-stone-100';

interface Props {
  active: boolean;
  label: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
}

export function PreviewToggleButton({ active, label, title, onClick, children }: Props) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={label} title={title}
      className={`${PREVIEW_BUTTON_CLASS} ${active ? 'border-stone-400 dark:border-stone-500 text-stone-900 dark:text-stone-100' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'}`}>
      {children}
    </button>
  );
}
