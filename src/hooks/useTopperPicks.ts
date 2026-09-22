import { useEffect, useRef, useState } from 'react';
import type { MainGeometryConfig, Pick } from '../geometry/types';
import { buildTopperPicks } from '../geometry/buildTopper';

interface TopperPicksState {
  picks: Pick[];
  loading: boolean;
  error: string | null;
}

/**
 * Rebuilds all pick geometry whenever the config changes. Font parsing and glyph
 * extrusion are async and not free, so results are guarded against out-of-order
 * resolution (a fast edit followed by a slow one must not let the slow one's
 * stale result overwrite the fast one's).
 */
export function useTopperPicks(config: MainGeometryConfig): TopperPicksState {
  const [state, setState] = useState<TopperPicksState>({ picks: [], loading: true, error: null });
  const requestId = useRef(0);

  useEffect(() => {
    const thisRequest = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    buildTopperPicks(config)
      .then((picks) => {
        if (requestId.current === thisRequest) {
          setState({ picks, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (requestId.current === thisRequest) {
          const message = err instanceof Error ? err.message : 'Failed to generate topper geometry';
          setState((prev) => ({ ...prev, loading: false, error: message }));
        }
      });
    // config is a plain object rebuilt each render from store fields; stringify
    // keeps the effect from re-running when values are unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);

  return state;
}
