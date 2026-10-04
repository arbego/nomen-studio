import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'studio.theme';

/** What the operating system says, when nobody has said otherwise. */
export function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // Private mode / blocked storage — following the system is a fine answer.
    return null;
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Remembering the choice is a convenience, never a requirement.
  }
}

/**
 * Puts the theme on the document, which is what every `dark:` class keys off
 * (see the custom variant in index.css).
 *
 * Applied imperatively rather than through an effect so the page is never
 * painted in the wrong theme first — this runs when the module is first
 * imported, before anything renders.
 */
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('dark', theme === 'dark');
  // Tells the browser to match its own furniture — form controls, scrollbars —
  // to the theme, which no amount of CSS on our side can do.
  document.documentElement.style.colorScheme = theme;
}

interface ThemeStore {
  theme: Theme;
  /**
   * Whether this is the user's own choice rather than the system's. Only a
   * choice is remembered, and only while there is none does the studio keep
   * following the system.
   */
  chosen: boolean;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  /** The system changed its mind; honoured only if the user has not expressed one. */
  systemChanged: (theme: Theme) => void;
}

const storedTheme = readStoredTheme();
const initialTheme = storedTheme ?? systemTheme();
applyTheme(initialTheme);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  chosen: storedTheme !== null,
  setTheme: (theme) => {
    writeStoredTheme(theme);
    applyTheme(theme);
    set({ theme, chosen: true });
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  systemChanged: (theme) => {
    if (get().chosen) {
      return;
    }
    applyTheme(theme);
    set({ theme });
  },
}));

// Follows the system live, so flipping the OS to dark at sunset flips the studio
// too — until the moment the user picks a side themselves.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    useThemeStore.getState().systemChanged(event.matches ? 'dark' : 'light');
  });
}
