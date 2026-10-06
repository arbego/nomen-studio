import { Fragment } from 'react';
import { useAppStore } from './store/appStore';
import { getProduct } from './products/registry';
import { AppShell } from './ui/AppShell';
import { ProductPicker } from './ui/ProductPicker';
import { ProductHeader } from './ui/ProductHeader';
import { StudioCanvas } from './scene/StudioCanvas';
import { DesignHistoryProvider } from './ui/DesignHistory';

/**
 * Either the product picker or one product's studio. The shell knows nothing
 * about any product beyond what its registry entry exposes — see
 * products/types.ts.
 */
function App() {
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
          header={<ProductHeader product={product} onBack={clearProduct} onOpenProduct={selectProduct} />}
          sidebar={<product.Controls />}
          main={
            <StudioCanvas actions={<product.Export />} warnings={product.Warnings && <product.Warnings />}>
              <product.SceneContent />
            </StudioCanvas>
          }
        />
      </Provider>
    </DesignHistoryProvider>
  );
}

export default App;
