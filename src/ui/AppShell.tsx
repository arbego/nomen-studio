import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface AppShellProps {
  /** Fixed above the sidebar: which product you're in, and the way back out of it. */
  header: ReactNode;
  /** The current product's controls panel — scrolls under the header. */
  sidebar: ReactNode;
  main: ReactNode;
}

const DEFAULT_PANEL_WIDTH = 380;
const MIN_PANEL_WIDTH = 280;

export function AppShell({ header, sidebar, main }: AppShellProps) {
  const panelId = useId();
  const [preferredWidth, setPreferredWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const maxWidth = viewportWidth / 2;
  const minWidth = Math.min(MIN_PANEL_WIDTH, maxWidth);
  const width = Math.min(maxWidth, Math.max(minWidth, preferredWidth));

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function resize(nextWidth: number) {
    setPreferredWidth(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
  }

  function endDrag() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-stone-100 dark:bg-stone-950 ${dragging ? 'cursor-col-resize select-none' : ''}`}>
      <aside id={panelId} style={{ width, maxWidth: '50vw' }} className="relative flex shrink-0 flex-col border-r border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
        {header}
        <div className="min-h-0 flex-1">{sidebar}</div>
        <div
          role="separator"
          tabIndex={0}
          aria-label="Resize controls panel"
          aria-orientation="vertical"
          aria-controls={panelId}
          aria-valuemin={Math.round(minWidth)}
          aria-valuemax={Math.round(maxWidth)}
          aria-valuenow={Math.round(width)}
          aria-valuetext={`${Math.round(width)} pixels`}
          title="Drag to resize the controls panel"
          className="absolute right-0 top-1/2 z-20 flex h-8 w-3 -translate-y-1/2 translate-x-1/2 touch-none cursor-col-resize items-center justify-center rounded-full border border-stone-300 bg-white text-stone-400 shadow-sm transition-colors hover:border-stone-400 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-500 dark:hover:border-stone-500 dark:hover:text-stone-300"
          onPointerDown={(event) => {
            if (event.button !== 0 || drag.current) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { pointerId: event.pointerId, x: event.clientX, width };
            setDragging(true);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (start?.pointerId === event.pointerId) resize(start.width + event.clientX - start.x);
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointerId !== event.pointerId) return;
            endDrag();
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 50 : 10;
            if (event.key === 'ArrowLeft') resize(width - step);
            else if (event.key === 'ArrowRight') resize(width + step);
            else if (event.key === 'Home') resize(minWidth);
            else if (event.key === 'End') resize(maxWidth);
            else return;
            event.preventDefault();
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 8 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="h-4 w-1.5">
            <path d="M2 5v14M6 5v14" />
          </svg>
        </div>
      </aside>
      <main className="relative min-w-0 flex-1">{main}</main>
    </div>
  );
}
