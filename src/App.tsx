import { Fragment, useEffect, useRef, useState } from 'react';
import { useAppStore } from './store/appStore';
import { getProduct } from './products/registry';
import { AppShell } from './ui/AppShell';
import { ProductPicker } from './ui/ProductPicker';
import { ProductHeader } from './ui/ProductHeader';
import { SaveProjectButton } from './ui/ProjectButtons';
import { ShareProjectButton } from './ui/ShareProjectButton';
import { hasSharedProject, readSharedProject } from './project/shareProject';
import { ProjectFileError } from './project/projectFile';
import { hasUnsavedChanges } from './project/projectSession';
import { StudioTips, TipButton, type StudioTipsHandle } from './ui/StudioTips';
import { SaveBeforeLeave } from './ui/SaveBeforeLeave';
import { StudioCanvas } from './scene/StudioCanvas';
import { DesignHistoryProvider, HistoryButtons } from './ui/DesignHistory';

/**
 * Either the product picker or one product's studio. The shell knows nothing
 * about any product beyond what its registry entry exposes — see
 * products/types.ts.
 */
function App() {
  const tipsRef = useRef<StudioTipsHandle>(null);
  const [tipActive, setTipActive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [loadingShare, setLoadingShare] = useState(() => hasSharedProject(window.location.href));
  const [shareError, setShareError] = useState<string | null>(null);
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const selectProduct = useAppStore((s) => s.selectProduct);
  const clearProduct = useAppStore((s) => s.clearProduct);

  useEffect(() => {
    let request = 0;
    function openSharedProject() {
      const currentRequest = ++request;
      const shared = hasSharedProject(window.location.href);
      setLoadingShare(shared);
      setShareError(null);
      if (!shared) return;
      void readSharedProject(window.location.href, (id) => getProduct(id) !== undefined).then((project) => {
        if (currentRequest !== request || !project) return;
        getProduct(project.product)!.project.load(project.design);
        selectProduct(project.product);
        // Keep the opened design in memory and replace the current history entry.
        const url = new URL(window.location.href);
        const fragment = new URLSearchParams(url.hash.slice(1));
        fragment.delete('share');
        url.hash = fragment.toString();
        window.history.replaceState(window.history.state, '', url);
      }).catch((error: unknown) => {
        if (currentRequest === request) setShareError(error instanceof ProjectFileError ? error.message : "That share link couldn't be opened.");
      }).finally(() => {
        if (currentRequest === request) setLoadingShare(false);
      });
    }
    openSharedProject();
    // Following another link on the same page changes only the fragment.
    window.addEventListener('hashchange', openSharedProject);
    return () => { request++; window.removeEventListener('hashchange', openSharedProject); };
  }, [selectProduct]);

  if (loadingShare) {
    return <div role="status" className="flex h-screen items-center justify-center bg-stone-100 text-stone-700 dark:bg-stone-950 dark:text-stone-300">Opening shared project…</div>;
  }
  if (shareError) {
    return <div className="flex h-screen flex-col items-center justify-center gap-4 bg-stone-100 px-6 dark:bg-stone-950">
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">{shareError}</p>
      <button type="button" onClick={() => setShareError(null)} className="rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 dark:border-stone-600 dark:text-stone-300">Continue to studio</button>
    </div>;
  }

  const product = selectedProductId ? getProduct(selectedProductId) : undefined;
  if (!product) {
    return <ProductPicker onSelect={selectProduct} />;
  }

  // Both halves of the studio mount inside the product's own provider, so state
  // they share (its geometry build) is created once, above both.
  const Provider = product.Provider ?? Fragment;
  return (
    <DesignHistoryProvider history={product.history}>
      <Provider>
        <AppShell
          header={<ProductHeader product={product} onBack={() => { if (hasUnsavedChanges(product)) setLeaving(true); else clearProduct(); }} />}
          sidebar={<product.Controls />}
          main={
            <StudioCanvas actions={<div className="flex items-start gap-2"><SaveProjectButton product={product} /><ShareProjectButton key={product.id} product={product} /><product.Export /></div>} tips={<StudioTips key={product.id} ref={tipsRef} productId={product.id} onActiveChange={setTipActive} />} historyActions={<div className="flex items-center gap-2"><TipButton active={tipActive} onClick={() => tipsRef.current?.showTip()} /><HistoryButtons history={product.history} /></div>} warnings={product.Warnings && <product.Warnings />} viewControls={product.ViewControls && <product.ViewControls />}>
              <product.SceneContent />
            </StudioCanvas>
          }
        />
        <SaveBeforeLeave
          product={product}
          open={leaving}
          onCancel={() => setLeaving(false)}
          onLeave={() => { setLeaving(false); clearProduct(); }}
        />
      </Provider>
    </DesignHistoryProvider>
  );
}

export default App;
