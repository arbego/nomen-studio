import { create } from 'zustand';
import { getProduct } from '../products/registry';

const STORAGE_KEY = 'studio.selectedProductId';

/**
 * Which product's studio is open, or null for the picker.
 *
 * Persisted so a reload drops you back where you were working rather than at
 * the picker. Read through getProduct so a stored id that no longer exists
 * (a product renamed or removed between releases) falls back to the picker
 * instead of rendering nothing.
 */
function readStoredProductId(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && getProduct(stored) ? stored : null;
  } catch {
    // Private mode / blocked storage — the picker is a fine starting point.
    return null;
  }
}

function writeStoredProductId(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    // Persisting the choice is a convenience, never a requirement.
  }
}

interface AppStore {
  selectedProductId: string | null;
  selectProduct: (id: string) => void;
  clearProduct: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  selectedProductId: readStoredProductId(),
  selectProduct: (id) => {
    writeStoredProductId(id);
    set({ selectedProductId: id });
  },
  clearProduct: () => {
    writeStoredProductId(null);
    set({ selectedProductId: null });
  },
}));
