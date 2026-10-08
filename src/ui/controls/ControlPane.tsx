import type { ReactNode } from 'react';

/** Status stays visible while the controls scroll beneath the product header. */
export function ControlPane({ children, loading, error }: { children: ReactNode; loading: boolean; error: string | null }) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      {error ? (
        <div role="alert" className="max-h-40 shrink-0 overflow-y-auto border-t border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Preview could not update.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : loading ? (
        <p role="status" className="shrink-0 border-t border-stone-200 px-6 py-3 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-300">Updating preview…</p>
      ) : null}
    </div>
  );
}
