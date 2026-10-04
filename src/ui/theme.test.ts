import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The theme store reads the system and localStorage once, when it is first
 * imported, so each case needs its own module instance with the environment
 * already staged.
 */
async function loadThemeStore({ prefersDark = false, stored = null as string | null, storageThrows = false } = {}) {
  vi.resetModules();
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  const classes = new Set<string>();
  const style: Record<string, string> = {};

  vi.stubGlobal('window', {
    matchMedia: (query: string) => ({
      matches: query.includes('dark') && prefersDark,
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => listeners.push(listener),
    }),
  });
  vi.stubGlobal('document', {
    documentElement: {
      style,
      classList: {
        toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      },
    },
  });
  vi.stubGlobal('localStorage', {
    getItem: () => {
      if (storageThrows) throw new Error('blocked');
      return stored;
    },
    setItem: () => {
      if (storageThrows) throw new Error('blocked');
    },
  });

  const { useThemeStore } = await import('./theme');
  return {
    store: useThemeStore,
    isDark: () => classes.has('dark'),
    colorScheme: () => style.colorScheme,
    systemChangesTo: (dark: boolean) => listeners.forEach((listener) => listener({ matches: dark })),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('choosing a theme', () => {
  it('follows the system when nobody has said otherwise', async () => {
    expect((await loadThemeStore({ prefersDark: true })).store.getState().theme).toBe('dark');
    expect((await loadThemeStore({ prefersDark: false })).store.getState().theme).toBe('light');
  });

  it('prefers a remembered choice over the system', async () => {
    const { store } = await loadThemeStore({ prefersDark: true, stored: 'light' });
    expect(store.getState().theme).toBe('light');
    expect(store.getState().chosen).toBe(true);
  });

  it('puts the theme on the document before anything renders', async () => {
    const dark = await loadThemeStore({ prefersDark: true });
    expect(dark.isDark()).toBe(true);
    expect(dark.colorScheme()).toBe('dark');

    const light = await loadThemeStore({ prefersDark: false });
    expect(light.isDark()).toBe(false);
    expect(light.colorScheme()).toBe('light');
  });

  it('toggles, and remembers that it was told to', async () => {
    const { store, isDark } = await loadThemeStore();
    expect(store.getState().chosen).toBe(false);

    store.getState().toggle();
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().chosen).toBe(true);
    expect(isDark()).toBe(true);

    store.getState().toggle();
    expect(store.getState().theme).toBe('light');
    expect(isDark()).toBe(false);
  });
});

describe('following the system', () => {
  it('keeps up with it while no choice has been made', async () => {
    const { store, systemChangesTo, isDark } = await loadThemeStore({ prefersDark: false });
    systemChangesTo(true);
    expect(store.getState().theme).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('stops following it the moment the user picks a side', async () => {
    // Someone who has chosen light does not want sunset to overrule them.
    const { store, systemChangesTo } = await loadThemeStore({ prefersDark: false });
    store.getState().setTheme('light');
    systemChangesTo(true);
    expect(store.getState().theme).toBe('light');
  });
});

describe('when the environment is unhelpful', () => {
  it('loads at all with storage blocked, which is the private-window case', async () => {
    const { store } = await loadThemeStore({ prefersDark: true, storageThrows: true });
    expect(store.getState().theme).toBe('dark');
    expect(() => store.getState().toggle()).not.toThrow();
    expect(store.getState().theme).toBe('light');
  });

  it('falls back to light where there is no window to ask', async () => {
    vi.resetModules();
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    const { useThemeStore, systemTheme } = await import('./theme');
    expect(systemTheme()).toBe('light');
    expect(useThemeStore.getState().theme).toBe('light');
  });
});
