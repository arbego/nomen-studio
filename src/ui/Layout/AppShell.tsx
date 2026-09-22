import type { ReactNode } from 'react';

interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
}

export function AppShell({ sidebar, main }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-100">
      <aside className="w-[380px] shrink-0 border-r border-stone-200 bg-white">{sidebar}</aside>
      <main className="relative flex-1">{main}</main>
    </div>
  );
}
