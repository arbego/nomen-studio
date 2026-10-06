// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FontPicker } from './FontPicker';
import { searchCatalog } from '../../fonts/catalog';
import { FONT_REGISTRY } from '../../fonts/registry';

let container: HTMLDivElement;
let root: Root;
const changed = vi.fn();
function Editor({ initial = 'roboto' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <FontPicker label="Font" value={value} onChange={(id) => { changed(id); setValue(id); }} previewText="Liam" />;
}
function result(id: string) {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-font-id]')].find((button) => button.dataset.fontId === id)!;
}
function key(target: HTMLElement, value: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
  act(() => target.dispatchEvent(event));
  return event;
}
function search(value: string) {
  const input = container.querySelector('input')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  return input;
}
beforeEach(() => {
  changed.mockClear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<Editor />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  vi.unstubAllGlobals();
});

describe('font keyboard navigation', () => {
  it('selects and focuses adjacent results instead of scrolling the list', () => {
    const results = searchCatalog('');
    act(() => result(results[0]!.id).focus());
    expect(key(document.activeElement as HTMLElement, 'ArrowDown').defaultPrevented).toBe(true);
    const next = result(results[1]!.id);
    expect(changed).toHaveBeenLastCalledWith(results[1]!.id);
    expect(next.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(next);
    expect(next.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    key(next, 'ArrowUp');
    expect(changed).toHaveBeenLastCalledWith(results[0]!.id);
    changed.mockClear();
    expect(key(result(results[0]!.id), 'ArrowUp').defaultPrevented).toBe(true);
    expect(changed).not.toHaveBeenCalled();
  });

  it('navigates filtered results from search without taking input focus', () => {
    const input = search('lora');
    const results = searchCatalog('lora');
    key(input, 'ArrowDown');
    expect(changed).toHaveBeenLastCalledWith(results[0]!.id);
    expect(document.activeElement).toBe(input);
    for (const entry of results.slice(1)) {
      key(input, 'ArrowDown');
      expect(changed).toHaveBeenLastCalledWith(entry.id);
      expect(document.activeElement).toBe(input);
    }
    changed.mockClear();
    key(input, 'ArrowDown');
    expect(changed).not.toHaveBeenCalled();
  });

  it('does not change fonts for empty results, modifier shortcuts, or category arrows', () => {
    const input = search('zzzz-no-font');
    expect(key(input, 'ArrowDown').defaultPrevented).toBe(true);
    expect(changed).not.toHaveBeenCalled();
    search('');
    expect(key(input, 'ArrowDown', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key(container.querySelector('select')!, 'ArrowDown').defaultPrevented).toBe(false);
    expect(changed).not.toHaveBeenCalled();
  });

  it('supports previous and next selection among the curated fonts', () => {
    act(() => root.render(<Editor key="curated" initial={FONT_REGISTRY[0]!.id} />));
    key(result(FONT_REGISTRY[0]!.id), 'ArrowDown');
    expect(changed).toHaveBeenLastCalledWith(FONT_REGISTRY[1]!.id);
    expect(document.activeElement).toBe(result(FONT_REGISTRY[1]!.id));
    key(document.activeElement as HTMLElement, 'ArrowUp');
    expect(changed).toHaveBeenLastCalledWith(FONT_REGISTRY[0]!.id);
  });
});
