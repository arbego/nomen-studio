import { describe, expect, it } from 'vitest';
import { scaleForTargetWidth } from './units';

describe('scaleForTargetWidth', () => {
  it('computes mm-per-unit scale from a raw width', () => {
    expect(scaleForTargetWidth(2000, 100)).toBeCloseTo(0.05);
  });

  it('rejects a non-positive raw width', () => {
    expect(() => scaleForTargetWidth(0, 100)).toThrow();
    expect(() => scaleForTargetWidth(-5, 100)).toThrow();
  });
});
