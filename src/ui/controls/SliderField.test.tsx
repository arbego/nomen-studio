// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SliderField } from './SliderField';

let container: HTMLDivElement;
let root: Root;
const changed = vi.fn();
function render(value = 12, min = 5, max = 100) {
  act(() => root.render(<SliderField label="Thickness" value={value} onChange={changed} min={min} max={max} step={0.5} />));
}
function input() { return container.querySelector<HTMLInputElement>('input[type="number"]')!; }
function enter(value: string) {
  act(() => {
    input().focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
beforeEach(() => {
  changed.mockClear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  render();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it('applies exact decimal values without requiring a slider gesture', () => {
  enter('12.25');
  expect(changed).toHaveBeenLastCalledWith(12.25);
});

it('allows clearing and typing a partial value without applying zero or an invalid dimension', () => {
  enter('');
  expect(changed).not.toHaveBeenCalled();
  enter('1');
  expect(changed).not.toHaveBeenCalled();
  enter('18');
  expect(changed).toHaveBeenLastCalledWith(18);
});

it('clamps out-of-range entries when editing finishes and restores an empty entry', () => {
  enter('1000');
  expect(changed).not.toHaveBeenCalled();
  act(() => input().blur());
  expect(changed).toHaveBeenLastCalledWith(100);
  enter('');
  act(() => input().blur());
  expect(input().value).toBe('12');
});

it('reflects external changes such as undo and supports negative angles', () => {
  render(-8, -180, 180);
  expect(input().value).toBe('-8');
  enter('-20');
  expect(changed).toHaveBeenLastCalledWith(-20);
  render(0, -180, 180);
  expect(input().value).toBe('0');
  expect(container.querySelector<HTMLInputElement>('input[type="range"]')!.value).toBe('0');
});
