// @vitest-environment jsdom
import { act, createRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIRST_TIP_DELAY_MS, StudioTips, TipButton, TIP_INTERVAL_MS, TIP_VISIBLE_MS, type StudioTipsHandle } from './StudioTips';
import { STUDIO_TIPS, tipsForProduct } from './tipCatalog';

let container: HTMLDivElement;
let root: Root;
let tipsRef = createRef<StudioTipsHandle>();
function TipControls() {
  const [active, setActive] = useState(false);
  return <><TipButton active={active} onClick={() => tipsRef.current?.showTip()} /><StudioTips ref={tipsRef} productId="cake-topper" onActiveChange={setActive} /></>;
}
function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)); }
function shown() { return container.querySelector<HTMLButtonElement>('[aria-label="Dismiss tip"]'); }
function message() { return container.querySelector('[role="status"]')!.textContent; }
function pointer(type: string) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  act(() => document.dispatchEvent(event));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  tipsRef = createRef<StudioTipsHandle>();
  act(() => root.render(<TipControls />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('occasional studio tips', () => {
  it('waits before showing a tip, hides it automatically, and leaves a long gap before the next one', () => {
    expect(shown()).toBeNull();
    advance(FIRST_TIP_DELAY_MS - 1000);
    expect(shown()).toBeNull();
    advance(1000);
    expect(shown()).not.toBeNull();
    const first = message();
    expect(container.querySelector('[role="status"]')!.getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(document.body);
    advance(TIP_VISIBLE_MS);
    expect(shown()).toBeNull();
    advance(TIP_INTERVAL_MS - 1000);
    expect(shown()).toBeNull();
    advance(1000);
    expect(shown()).not.toBeNull();
    expect(message()).not.toBe(first);
  });

  it('dismisses only the current tip and keeps a focused dismiss button available', () => {
    advance(FIRST_TIP_DELAY_MS);
    act(() => shown()!.focus());
    advance(TIP_VISIBLE_MS * 2);
    expect(shown()).not.toBeNull();
    act(() => shown()!.click());
    expect(shown()).toBeNull();
    advance(TIP_INTERVAL_MS);
    expect(shown()).not.toBeNull();
  });

  it('pauses automatic dismissal while hovering and resumes the remaining time afterward', () => {
    advance(FIRST_TIP_DELAY_MS);
    advance(3000);
    const card = shown()!.parentElement!;
    act(() => card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })));
    const currentMessage = message();
    advance(TIP_VISIBLE_MS * 2);
    expect(shown()).not.toBeNull();
    expect(message()).toBe(currentMessage);
    act(() => card.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })));
    advance(TIP_VISIBLE_MS - 3000 - 1000);
    expect(shown()).not.toBeNull();
    advance(1000);
    expect(shown()).toBeNull();
  });

  it('allows manual dismissal while hovering and resets hover state for the next tip', () => {
    advance(FIRST_TIP_DELAY_MS);
    const card = shown()!.parentElement!;
    act(() => card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })));
    act(() => shown()!.click());
    expect(shown()).toBeNull();
    advance(TIP_INTERVAL_MS);
    expect(shown()).not.toBeNull();
    advance(TIP_VISIBLE_MS);
    expect(shown()).toBeNull();
  });

  it('waits for typing and a held pointer gesture to finish', () => {
    advance(FIRST_TIP_DELAY_MS - 1000);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })));
    advance(1000);
    expect(shown()).toBeNull();
    pointer('pointerdown');
    advance(10_000);
    expect(shown()).toBeNull();
    pointer('pointerup');
    advance(3000);
    expect(shown()).toBeNull();
    advance(1000);
    expect(shown()).not.toBeNull();
  });

  it('waits while a dialog is open and resumes without an immediate message', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    advance(FIRST_TIP_DELAY_MS * 2);
    expect(shown()).toBeNull();
    dialog.remove();
    advance(FIRST_TIP_DELAY_MS - 1000);
    expect(shown()).toBeNull();
    advance(1000);
    expect(shown()).not.toBeNull();
  });

  it('preserves the long interval when a dialog interrupts a visible tip', () => {
    advance(FIRST_TIP_DELAY_MS);
    expect(shown()).not.toBeNull();
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    advance(1000);
    expect(shown()).toBeNull();
    dialog.remove();
    advance(FIRST_TIP_DELAY_MS);
    expect(shown()).toBeNull();
    advance(TIP_INTERVAL_MS - FIRST_TIP_DELAY_MS);
    expect(shown()).not.toBeNull();
  });

  it('hides tips in background tabs and does not accumulate them while away', () => {
    advance(FIRST_TIP_DELAY_MS);
    expect(shown()).not.toBeNull();
    vi.mocked(Object.getOwnPropertyDescriptor(document, 'hidden')!.get!).mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(shown()).toBeNull();
    advance(TIP_INTERVAL_MS * 3);
    expect(shown()).toBeNull();
    vi.mocked(Object.getOwnPropertyDescriptor(document, 'hidden')!.get!).mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(FIRST_TIP_DELAY_MS - 1000);
    expect(shown()).toBeNull();
    advance(1000);
    expect(shown()).not.toBeNull();
  });

  it('continues cycling after all tips have been shown and cleans up its timer', () => {
    const count = tipsForProduct('cake-topper').length;
    const messages = new Set<string | null>();
    advance(FIRST_TIP_DELAY_MS);
    for (let i = 0; i < count; i++) {
      expect(shown()).not.toBeNull();
      messages.add(message());
      advance(TIP_VISIBLE_MS);
      advance(TIP_INTERVAL_MS);
    }
    expect(messages.size).toBe(count);
    expect(shown()).not.toBeNull();
    expect(messages.has(message())).toBe(true);
    act(() => root.render(null));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows a fresh tip immediately on request and restarts its dismissal timer', () => {
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Show a tip"]')!;
    act(() => { button.focus(); button.click(); });
    expect(shown()).not.toBeNull();
    expect(document.activeElement).toBe(button);
    const first = message();
    advance(TIP_VISIBLE_MS - 1000);
    act(() => button.click());
    expect(message()).not.toBe(first);
    advance(1000);
    expect(shown()).not.toBeNull();
    advance(TIP_VISIBLE_MS - 1000);
    expect(shown()).toBeNull();
    advance(TIP_INTERVAL_MS - 1000);
    expect(shown()).toBeNull();
    advance(1000);
    expect(shown()).not.toBeNull();
  });

  it('shows the initial tip again whenever the editor is reopened', () => {
    advance(FIRST_TIP_DELAY_MS);
    expect(shown()).not.toBeNull();
    act(() => root.render(null));
    act(() => root.render(<StudioTips productId="cake-topper" />));
    expect(shown()).toBeNull();
    advance(FIRST_TIP_DELAY_MS);
    expect(shown()).not.toBeNull();
  });

  it('lights the button while automatic or manual tips are visible, including while hovering', () => {
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Show a tip"]')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.className).not.toContain('text-orange-300');
    advance(FIRST_TIP_DELAY_MS);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.className).toContain('text-orange-300');
    expect(button.querySelector('svg')!.classList.contains('fill-current')).toBe(true);
    const card = shown()!.parentElement!;
    act(() => card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })));
    advance(TIP_VISIBLE_MS * 2);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    act(() => card.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })));
    advance(TIP_VISIBLE_MS);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.querySelector('svg')!.classList.contains('fill-current')).toBe(false);
    act(() => button.click());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    act(() => shown()!.click());
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('includes shared and current-product tips with unique identifiers', () => {
    const topper = tipsForProduct('cake-topper');
    const display = tipsForProduct('name-display');
    expect(topper.some((tip) => tip.productId === 'cake-topper')).toBe(true);
    expect(topper.every((tip) => !tip.productId || tip.productId === 'cake-topper')).toBe(true);
    expect(display.some((tip) => tip.productId === 'name-display')).toBe(true);
    expect(display.every((tip) => !tip.productId || tip.productId === 'name-display')).toBe(true);
    expect(tipsForProduct('another-product')).toEqual(STUDIO_TIPS.filter((tip) => !tip.productId));
    expect(new Set(STUDIO_TIPS.map((tip) => tip.id)).size).toBe(STUDIO_TIPS.length);
  });
});
