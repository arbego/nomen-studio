import type { ProductDefinition } from '../products/types';

const savedListeners = new WeakMap<ProductDefinition, Set<() => void>>();
const cleanDesigns = new WeakMap<ProductDefinition, string>();

/** A studio entry starts a new timeline, using the started or loaded design as its baseline. */
export function startProjectSession(product: ProductDefinition) {
  product.history.clear();
  markProjectSaved(product, product.project.snapshot().design);
}

/** Record the exact design written to the downloaded project file. */
export function markProjectSaved(product: ProductDefinition, design: unknown) {
  cleanDesigns.set(product, JSON.stringify(design));
  savedListeners.get(product)?.forEach((listener) => listener());
}

/** Compare the live design so undoing back to the baseline also removes the leave prompt. */
export function hasUnsavedChanges(product: ProductDefinition): boolean {
  return JSON.stringify(product.project.snapshot().design) !== cleanDesigns.get(product);
}

/** Observe both live edits and successful saves, without depending on history button availability. */
export function subscribeProjectChanges(product: ProductDefinition, listener: () => void): () => void {
  let listeners = savedListeners.get(product);
  if (!listeners) {
    listeners = new Set();
    savedListeners.set(product, listeners);
  }
  listeners.add(listener);
  const unsubscribe = product.history.subscribeDesign(listener);
  return () => {
    listeners.delete(listener);
    unsubscribe();
  };
}
