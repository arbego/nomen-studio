import { createContext, useContext } from 'react';
import type { TextBlock } from '../../geometry/types';
import type { AsyncGeometryState } from '../../hooks/useAsyncGeometry';

const EMPTY: AsyncGeometryState<TextBlock[]> = { result: null, loading: true, error: null };

export const CakeTopperGeometryContext = createContext<AsyncGeometryState<TextBlock[]>>(EMPTY);

export function useCakeTopperGeometry(): AsyncGeometryState<TextBlock[]> & { blocks: TextBlock[] } {
  const state = useContext(CakeTopperGeometryContext);
  // Callers overwhelmingly just want to map over the blocks; handing back [] while
  // a build is in flight keeps every one of them from repeating the null check.
  return { ...state, blocks: state.result ?? [] };
}
