import type { ReactNode } from 'react';

interface AppShellProps {
  /** Fixed above the sidebar: which product you're in, and the way back out of it. */
  header: ReactNode;
  /** The current product's controls panel — scrolls under the header. */
  sidebar: ReactNode;
  main: ReactNode;
}

export function AppShell({ header, sidebar, main }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-100 dark:bg-stone-950">
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
        {header}
        <div className="min-h-0 flex-1">{sidebar}</div>
      </aside>
      <main className="relative flex-1">{main}</main>
    </div>
  );
}
