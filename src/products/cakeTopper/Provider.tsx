import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAsyncGeometry } from '../../hooks/useAsyncGeometry';
import { useCakeTopperStore, selectCakeTopperGeometryConfig } from './store';
import { buildCakeTopperGeometry } from './geometry';
import { CakeTopperGeometryContext } from './geometryContext';

/**
 * Runs the font-dependent geometry build once for the whole product and shares
 * the result. Both halves of the studio need it — the controls panel to detect
 * outline holes and to export, the scene to render — and they are mounted in
 * separate subtrees (sidebar and canvas), so the build is hoisted here rather
 * than duplicated in each.
 */
export function CakeTopperProvider({ children }: { children: ReactNode }) {
  const config = useCakeTopperStore(useShallow(selectCakeTopperGeometryConfig));
  const state = useAsyncGeometry(config, buildCakeTopperGeometry);
  return <CakeTopperGeometryContext.Provider value={state}>{children}</CakeTopperGeometryContext.Provider>;
}
