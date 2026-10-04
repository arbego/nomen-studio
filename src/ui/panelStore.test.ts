import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLASH_MS, usePanelStore } from './panelStore';

afterEach(() => {
  vi.useRealTimers();
  usePanelStore.getState().reset();
});

/** Stands in for a section asking "am I open?", which is where a default is applied. */
function isOpen(id: string, defaultOpen = false): boolean {
  const state = usePanelStore.getState();
  return state.open[id] ?? (state.defaultsApply && defaultOpen);
}

describe('what the preview asks the panel for', () => {
  it('names the control to reveal, and stops naming it once the flash is spent', () => {
    vi.useFakeTimers();
    usePanelStore.getState().focus('name', 'name-text');
    expect(usePanelStore.getState().request).toEqual({ section: 'name', target: 'name-text' });

    vi.advanceTimersByTime(FLASH_MS + 100);
    // Nothing stays lit: the panel is not a selection, it is an answer to a
    // click that has now been given.
    expect(usePanelStore.getState().request).toBeNull();
  });

  it('points at the section itself when there is nothing finer inside it to point at', () => {
    usePanelStore.getState().focus('sticks');
    expect(usePanelStore.getState().request).toEqual({ section: 'sticks', target: 'sticks' });
  });

  it('asks again when the same thing is clicked twice, rather than silently doing nothing', () => {
    usePanelStore.getState().focus('name', 'name-text');
    const first = usePanelStore.getState().request;
    usePanelStore.getState().focus('name', 'name-text');
    const second = usePanelStore.getState().request;

    expect(second).toEqual(first);
    // A fresh object, which is what makes the panel scroll to it a second time —
    // an unchanged value would leave the effect watching it asleep.
    expect(second).not.toBe(first);
  });

  it('lets a second target supersede the first, instead of the first one putting it out', () => {
    vi.useFakeTimers();
    usePanelStore.getState().focus('initial');
    vi.advanceTimersByTime(FLASH_MS - 400);
    usePanelStore.getState().focus('name');

    // Past when the first flash would have ended. Without its timer being
    // cancelled, this is the moment it would have put the second one out.
    vi.advanceTimersByTime(500);
    expect(usePanelStore.getState().request).toEqual({ section: 'name', target: 'name' });

    vi.advanceTimersByTime(FLASH_MS);
    expect(usePanelStore.getState().request).toBeNull();
  });
});

describe('which sections are open', () => {
  it('opens only what was pointed at, so clicking a piece answers with one thing', () => {
    usePanelStore.getState().setOpen('standing', true);
    usePanelStore.getState().setOpen('inlay', true);

    usePanelStore.getState().focus('decorators', 'decorator-d1');

    const { open } = usePanelStore.getState();
    expect(open.decorators).toBe(true);
    // The card inside it too — a section of folded rows would answer with the
    // right section and still hide the ornament.
    expect(open['decorator-d1']).toBe(true);
    expect(open.standing).toBeFalsy();
    expect(open.inlay).toBeFalsy();
  });

  it('lets a header click hold two open side by side, which is what comparing needs', () => {
    usePanelStore.getState().focus('initial', 'initial-text');
    usePanelStore.getState().setOpen('name', true);

    const { open } = usePanelStore.getState();
    expect(open.initial).toBe(true);
    expect(open.name).toBe(true);
  });

  it('stops a default keeping a second section open once the preview has pointed at one thing', () => {
    // The panel arrives with its first section open…
    expect(isOpen('initial', true)).toBe(true);

    usePanelStore.getState().focus('decorators', 'decorator-d1');

    // …and that default must not survive a click on a piece of the design, or
    // the answer to "show me this one" would be two sections.
    expect(isOpen('initial', true)).toBe(false);
    expect(isOpen('decorators')).toBe(true);
  });

  it('leaves the default alone when a section is merely opened by hand', () => {
    usePanelStore.getState().setOpen('name', true);
    expect(isOpen('initial', true)).toBe(true);
    expect(isOpen('name')).toBe(true);
  });

  it('starts over when the product changes, the next panel having sections of its own', () => {
    usePanelStore.getState().focus('decorators', 'decorator-d1');
    usePanelStore.getState().reset();

    expect(usePanelStore.getState().open).toEqual({});
    expect(isOpen('text', true)).toBe(true);
  });

  it('shuts one again without touching the rest', () => {
    usePanelStore.getState().setOpen('initial', true);
    usePanelStore.getState().setOpen('name', true);
    usePanelStore.getState().setOpen('name', false);

    const { open } = usePanelStore.getState();
    expect(open.initial).toBe(true);
    expect(open.name).toBe(false);
  });
});
