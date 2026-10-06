import type { ProductDefinition } from '../products/types';

const cleanDesigns = new WeakMap<ProductDefinition, string>();

/** A studio entry starts a new timeline, using the started or loaded design as its baseline. */
export function startProjectSession(product: ProductDefinition) {
  product.history.clear();
  markProjectSaved(product, product.project.snapshot().design);
}

/** Record the exact design written to the downloaded project file. */
export function markProjectSaved(product: ProductDefinition, design: unknown) {
  cleanDesigns.set(product, JSON.stringify(design));
}

/** Compare the live design so undoing back to the baseline also removes the leave prompt. */
export function hasUnsavedChanges(product: ProductDefinition): boolean {
  return JSON.stringify(product.project.snapshot().design) !== cleanDesigns.get(product);
}
