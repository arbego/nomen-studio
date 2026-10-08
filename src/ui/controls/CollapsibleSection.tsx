import type { ReactNode } from 'react';
import { FocusTarget } from '../FocusTarget';
import { useIsOpen, usePanelStore } from '../panelStore';

interface CollapsibleSectionProps {
  /** Matches what the scene asks for — see each product's focus.ts. */
  id: string;
  title: string;
  /** Open before anything has been said about it, so a panel never arrives entirely shut. */
  defaultOpen?: boolean;
  /** What this section currently says, shown on its header while closed — so a shut section still answers the question it is about. */
  summary?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * One part of the controls panel, openable and shut.
 *
 * Both panels run to several screens with everything open, which is most of a
 * design you cannot see at once. Shut, a section is one line that still names
 * what it holds and what it is currently set to.
 *
 * Clicking the header toggles only this section, so two can be held open side
 * by side — the initial's thickness and the name's thickness are genuinely read
 * together, and a panel that closed one to show the other would make that a
 * chore. Clicking the piece itself in the preview is the other way in, and that
 * one does close the rest: you pointed at one thing, so you get one thing.
 */
export function CollapsibleSection({ id, title, defaultOpen = false, summary, className = '', children }: CollapsibleSectionProps) {
  const open = useIsOpen(id, defaultOpen);
  const setOpen = usePanelStore((state) => state.setOpen);

  return (
    <FocusTarget focusKey={id} className={`flex flex-col ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(id, !open)}
        aria-expanded={open}
        // The whole band from one divider to the next, not just the line the
        // title sits on: a header is a thing you aim at constantly, and a 20px
        // strip is a poor target. The padding makes the band, the negative
        // margin hands the space back to the layout, so nothing moves. Only the
        // top half of it while the section is open — the bottom half would
        // otherwise reach down over the section's own first control.
        className={`group -mt-5 flex w-full items-center gap-2 pt-5 text-left ${open ? '' : '-mb-5 pb-5'}`}
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">{title}</span>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-stone-500 dark:text-stone-400">{open ? '' : summary}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-stone-500 dark:text-stone-400 transition-transform group-hover:text-stone-700 dark:group-hover:text-stone-300 ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="flex flex-col gap-4 pt-4">{children}</div>}
    </FocusTarget>
  );
}
