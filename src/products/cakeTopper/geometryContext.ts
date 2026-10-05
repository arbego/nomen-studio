import { createContext, useContext } from 'react';
import type { TextBlock } from '../../geometry/types';
import type { AsyncGeometryState } from '../../hooks/useAsyncGeometry';
import type { CakeTopperGeometry, DecoratorBlock } from './geometry';

const EMPTY: AsyncGeometryState<CakeTopperGeometry> = { result: null, loading: true, error: null };

export const CakeTopperGeometryContext = createContext<AsyncGeometryState<CakeTopperGeometry>>(EMPTY);

export function useCakeTopperGeometry(): AsyncGeometryState<CakeTopperGeometry> & { blocks: TextBlock[]; decorators: DecoratorBlock[] } {
  const state = useContext(CakeTopperGeometryContext);
  // Callers overwhelmingly just want to map over these; handing back [] while a
  // build is in flight keeps every one of them from repeating the null check.
  return { ...state, blocks: state.result?.blocks ?? [], decorators: state.result?.decorators ?? [] };
}
