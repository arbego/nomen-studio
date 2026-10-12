import { useEffect, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AsyncGeometryState } from '../../hooks/useAsyncGeometry';
import { buildStickyNameGeometry, disposeStickyNameGeometry, type StickyNameGeometry } from './geometry';
import { selectStickyNameConfig, useStickyNameStore } from './store';
import { StickyNameGeometryContext } from './geometryContext';

export function StickyNameProvider({ children }: { children: ReactNode }) {
  const config = useStickyNameStore(useShallow(selectStickyNameConfig));
  // Cosmetic color edits must not rebuild solids. The signature also marks stale exports immediately.
  const signature = JSON.stringify({ ...config, previewColor: '' });
  const [state, setState] = useState<AsyncGeometryState<StickyNameGeometry> & { signature: string }>({ result: null, loading: true, error: null, signature: '' });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let owned: StickyNameGeometry | null = null;
    const timer = setTimeout(() => {
      buildStickyNameGeometry(JSON.parse(signature), controller.signal).then((result) => {
        if (!active) { disposeStickyNameGeometry(result); return; }
        owned = result;
        setState({ result, loading: false, error: null, signature });
      }).catch((error: unknown) => {
        if (active) setState({ result: null, loading: false, error: error instanceof Error ? error.message : 'Could not build letters.', signature });
      });
    }, 160);
    return () => { active = false; controller.abort(); clearTimeout(timer); if (owned) disposeStickyNameGeometry(owned); };
  }, [signature]);
  const value = state.signature === signature ? state : { result: null, loading: true, error: null };
  return <StickyNameGeometryContext.Provider value={value}>{children}</StickyNameGeometryContext.Provider>;
}
