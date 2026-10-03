import { describe, expect, it } from 'vitest';
import { PRODUCT_REGISTRY, getProduct } from './registry';

describe('PRODUCT_REGISTRY', () => {
  it('lists every product with a unique id', () => {
    const ids = PRODUCT_REGISTRY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('cake-topper');
    expect(ids).toContain('name-display');
  });

  it('gives every product everything the shell needs to mount it', () => {
    for (const product of PRODUCT_REGISTRY) {
      expect(product.label, product.id).toBeTruthy();
      expect(product.tagline, product.id).toBeTruthy();
      expect(typeof product.Thumbnail, product.id).toBe('function');
      expect(typeof product.Controls, product.id).toBe('function');
      expect(typeof product.SceneContent, product.id).toBe('function');
    }
  });
});

describe('getProduct', () => {
  it('finds a registered product by id', () => {
    expect(getProduct('cake-topper')?.label).toBe('Cake Topper');
  });

  it('returns undefined for an unknown id, so a stale stored id falls back to the picker', () => {
    expect(getProduct('no-such-product')).toBeUndefined();
  });
});
