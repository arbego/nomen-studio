import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLASH_MS, useFocusStore } from './focusStore';

afterEach(() => {
  vi.useRealTimers();
  useFocusStore.setState({ request: null });
});

describe('focus store', () => {
  it('names what the panel should reveal, and stops naming it once the flash is spent', () => {
    vi.useFakeTimers();
    useFocusStore.getState().focus('name');
    expect(useFocusStore.getState().request).toEqual({ key: 'name' });

    vi.advanceTimersByTime(FLASH_MS + 100);
    // Nothing stays lit: the panel is not a selection, it is an answer to a
    // click that has now been given.
    expect(useFocusStore.getState().request).toBeNull();
  });

  it('asks again when the same thing is clicked twice, rather than silently doing nothing', () => {
    useFocusStore.getState().focus('name');
    const first = useFocusStore.getState().request;
    useFocusStore.getState().focus('name');
    const second = useFocusStore.getState().request;

    expect(second).toEqual(first);
    // A fresh object, which is what makes the panel scroll to it a second time —
    // an unchanged value would leave the effect watching it asleep.
    expect(second).not.toBe(first);
  });

  it('lets a second target supersede the first, instead of the first one putting it out', () => {
    vi.useFakeTimers();
    useFocusStore.getState().focus('initial');
    vi.advanceTimersByTime(FLASH_MS - 400);
    useFocusStore.getState().focus('name');

    // Past when the first flash would have ended. Without its timer being
    // cancelled, this is the moment it would have put the second one out.
    vi.advanceTimersByTime(500);
    expect(useFocusStore.getState().request).toEqual({ key: 'name' });

    vi.advanceTimersByTime(FLASH_MS);
    expect(useFocusStore.getState().request).toBeNull();
  });
});
