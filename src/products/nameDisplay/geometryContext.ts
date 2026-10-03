import { createContext, useContext } from 'react';
import type { NameDisplayAssembly, NameDisplayBlocks } from './geometry';

export interface NameDisplayState {
  /** The font-built pieces, or null while the first build is in flight. */
  blocks: NameDisplayBlocks | null;
  /** The pocket and seating, recomputed synchronously whenever the cheap config changes. */
  assembly: NameDisplayAssembly | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: NameDisplayState = { blocks: null, assembly: null, loading: true, error: null };

export const NameDisplayGeometryContext = createContext<NameDisplayState>(EMPTY);

export function useNameDisplayGeometry(): NameDisplayState {
  return useContext(NameDisplayGeometryContext);
}
