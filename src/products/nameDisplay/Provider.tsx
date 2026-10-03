import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAsyncGeometry } from '../../hooks/useAsyncGeometry';
import { useNameDisplayStore, selectNameDisplayGeometryConfig } from './store';
import { buildNameDisplay } from './geometry';
import { NameDisplayGeometryContext } from './geometryContext';

/**
 * Runs the build once for the whole product and shares it with both the
 * controls panel and the scene, which are mounted in separate subtrees.
 */
export function NameDisplayProvider({ children }: { children: ReactNode }) {
  const config = useNameDisplayStore(useShallow(selectNameDisplayGeometryConfig));
  const state = useAsyncGeometry(config, buildNameDisplay);
  return <NameDisplayGeometryContext.Provider value={state}>{children}</NameDisplayGeometryContext.Provider>;
}
