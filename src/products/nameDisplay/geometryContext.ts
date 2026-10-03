import { createContext, useContext } from 'react';
import type { AsyncGeometryState } from '../../hooks/useAsyncGeometry';
import type { NameDisplayGeometry } from './geometry';

const EMPTY: AsyncGeometryState<NameDisplayGeometry> = { result: null, loading: true, error: null };

export const NameDisplayGeometryContext = createContext<AsyncGeometryState<NameDisplayGeometry>>(EMPTY);

export function useNameDisplayGeometry(): AsyncGeometryState<NameDisplayGeometry> {
  return useContext(NameDisplayGeometryContext);
}
