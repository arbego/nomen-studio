import { useThemeStore } from './theme';

/**
 * Switches between light and dark.
 *
 * Shows where you would be going rather than where you are — a sun to go light,
 * a moon to go dark — which is the convention, and the label says it outright so
 * the icon never has to carry the meaning alone.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const goingDark = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={goingDark ? 'Switch to dark mode' : 'Switch to light mode'}
      title={goingDark ? 'Switch to dark mode' : 'Switch to light mode'}
      className={`flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100 ${className}`}
    >
      {goingDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
