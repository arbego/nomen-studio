import type { ProductDefinition } from './types';
import { cakeTopperProduct } from './cakeTopper';

/**
 * Every product the studio can design, in the order the picker lists them.
 *
 * To add one: create `src/products/<id>/` with its own config, store, geometry,
 * Controls and SceneContent (the existing two are the template), then add one
 * entry here. Nothing else in the app needs to change — same pattern as
 * fonts/registry.ts.
 */
export const PRODUCT_REGISTRY: ProductDefinition[] = [cakeTopperProduct];

export function getProduct(id: string): ProductDefinition | undefined {
  return PRODUCT_REGISTRY.find((product) => product.id === id);
}
