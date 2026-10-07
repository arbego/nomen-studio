import { Fragment, useRef, useState } from 'react';
import { useAppStore } from './store/appStore';
import { getProduct } from './products/registry';
import { AppShell } from './ui/AppShell';
import { ProductPicker } from './ui/ProductPicker';
import { ProductHeader } from './ui/ProductHeader';
import { SaveProjectButton } from './ui/ProjectButtons';
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
  const selectedProductId = useAppStore((s) => s.selectedProductId);
  const selectProduct = useAppStore((s) => s.selectProduct);
  const clearProduct = useAppStore((s) => s.clearProduct);

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
            <StudioCanvas actions={<div className="flex items-start gap-2"><SaveProjectButton product={product} /><product.Export /></div>} tips={<StudioTips key={product.id} ref={tipsRef} productId={product.id} onActiveChange={setTipActive} />} historyActions={<div className="flex items-center gap-2"><TipButton active={tipActive} onClick={() => tipsRef.current?.showTip()} /><HistoryButtons history={product.history} /></div>} warnings={product.Warnings && <product.Warnings />}>
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
