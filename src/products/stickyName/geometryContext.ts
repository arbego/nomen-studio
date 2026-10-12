import { createContext, useContext } from 'react';
import type { AsyncGeometryState } from '../../hooks/useAsyncGeometry';
import type { StickyNameGeometry } from './geometry';

export const StickyNameGeometryContext = createContext<AsyncGeometryState<StickyNameGeometry>>({ result: null, loading: true, error: null });
export const useStickyNameGeometry = () => useContext(StickyNameGeometryContext);
