// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

let container: HTMLDivElement;
let root: Root;
let handle: HTMLElement;
function panelWidth() {
  return Number.parseFloat(container.querySelector('aside')!.style.width);
}
function pointer(type: string, clientX: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  act(() => handle.dispatchEvent(event));
}
function key(value: string) {
  act(() => handle.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: value })));
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('innerWidth', 1200);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<AppShell header="Header" sidebar="Controls" main="Preview" />));
  handle = container.querySelector('[role="separator"]')!;
  handle.setPointerCapture = vi.fn();
  handle.releasePointerCapture = vi.fn();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('resizable controls panel', () => {
  it('drags from the existing width and clamps between the minimum and half the viewport', () => {
    expect(panelWidth()).toBe(380);
    pointer('pointerdown', 380);
    pointer('pointermove', 500);
    expect(panelWidth()).toBe(500);
    pointer('pointermove', 1000);
    expect(panelWidth()).toBe(600);
    pointer('pointermove', 100);
    expect(panelWidth()).toBe(280);
    pointer('pointerup', 100);
    pointer('pointermove', 500);
    expect(panelWidth()).toBe(280);
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('stops resizing when a drag is canceled', () => {
    pointer('pointerdown', 380);
    pointer('pointermove', 450);
    pointer('pointercancel', 450);
    pointer('pointermove', 550);
    expect(panelWidth()).toBe(450);
    expect(container.firstElementChild!.className).not.toContain('select-none');
  });

  it('supports keyboard resizing and exposes the current limits', () => {
    key('ArrowRight');
    expect(panelWidth()).toBe(390);
    key('ArrowLeft');
    expect(panelWidth()).toBe(380);
    key('End');
    expect(panelWidth()).toBe(600);
    expect(handle.getAttribute('aria-valuenow')).toBe('600');
    expect(handle.getAttribute('aria-valuemax')).toBe('600');
    key('Home');
    expect(panelWidth()).toBe(280);
  });

  it('keeps the panel within half the width when the browser becomes smaller', () => {
    key('End');
    vi.stubGlobal('innerWidth', 500);
    act(() => window.dispatchEvent(new Event('resize')));
    expect(panelWidth()).toBe(250);
    expect(handle.getAttribute('aria-valuemin')).toBe('250');
    expect(handle.getAttribute('aria-valuemax')).toBe('250');
  });
});
