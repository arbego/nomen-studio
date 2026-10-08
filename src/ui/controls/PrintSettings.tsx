import type { ReactNode } from 'react';

/** Less frequent print and fit adjustments, kept beside the feature they affect. */
export function PrintSettings({ children }: { children: ReactNode }) {
  return (
    <details className="group/print border-t border-stone-200 pt-2 dark:border-stone-700">
      <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 rounded px-1 text-sm font-medium text-stone-600 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-stone-400 dark:hover:text-stone-100 [&::-webkit-details-marker]:hidden">
        Print settings
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 transition-transform group-open/print:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-4 pt-3">{children}</div>
    </details>
  );
}
