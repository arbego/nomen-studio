import { useEffect, useRef, useState } from 'react';

export interface AsyncGeometryState<T> {
  result: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Runs a product's async geometry build whenever its config changes, and hands
 * back the latest result. Font parsing and glyph extrusion are async and not
 * free, so results are guarded against out-of-order resolution (a fast edit
 * followed by a slow one must not let the slow one's stale result overwrite the
 * fast one's).
 *
 * Generic over the build's result type so every product can keep its own shape —
 * the cake topper returns an array of text blocks, the name display returns its
 * two blocks plus the pocketed initial — without this hook knowing any of them.
 */
export function useAsyncGeometry<TConfig, TResult>(config: TConfig, build: (config: TConfig) => Promise<TResult>): AsyncGeometryState<TResult> {
  const [state, setState] = useState<AsyncGeometryState<TResult>>({ result: null, loading: true, error: null });
  const requestId = useRef(0);
  // Held in a ref so a caller passing an inline arrow (the normal case) doesn't
  // re-trigger the build on every render — the config is what decides that.
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    const thisRequest = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    buildRef
      .current(config)
      .then((result) => {
        if (requestId.current === thisRequest) {
          setState({ result, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (requestId.current === thisRequest) {
          const message = err instanceof Error ? err.message : 'Failed to generate geometry';
          setState((prev) => ({ ...prev, loading: false, error: message }));
        }
      });
    // config is a plain object rebuilt each render from store fields; stringify
    // keeps the effect from re-running when values are unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);

  return state;
}
