import { useMemo, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAsyncGeometry } from '../../hooks/useAsyncGeometry';
import { useNameDisplayStore, selectNameDisplayBlocksConfig, selectNameDisplayConfig } from './store';
import { assembleNameDisplay, buildNameDisplayBlocks } from './geometry';
import { NameDisplayGeometryContext } from './geometryContext';

/**
 * Runs the build once for the whole product and shares it with both the
 * controls panel and the scene, which are mounted in separate subtrees.
 *
 * Split in two on purpose: the async half re-runs only when the glyphs
 * themselves change, while the pocket — which does depend on where the name was
 * dragged — is recomputed synchronously here, so a drag never re-extrudes a font.
 */
export function NameDisplayProvider({ children }: { children: ReactNode }) {
  const blocksConfig = useNameDisplayStore(useShallow(selectNameDisplayBlocksConfig));
  const config = useNameDisplayStore(useShallow(selectNameDisplayConfig));
  const { result: blocks, loading, error } = useAsyncGeometry(blocksConfig, buildNameDisplayBlocks);

  const built = useMemo(() => {
    try {
      return { assembly: blocks ? assembleNameDisplay(blocks, config) : null, error: null };
    } catch (failure) {
      return { assembly: null, error: failure instanceof Error ? failure.message : 'Failed to build the initial.' };
    }
  }, [blocks, config]);
  const value = useMemo(() => ({ blocks, assembly: built.assembly, loading, error: error ?? built.error }), [blocks, built, loading, error]);

  return <NameDisplayGeometryContext.Provider value={value}>{children}</NameDisplayGeometryContext.Provider>;
}
