import type { ProductDefinition } from '../products/types';

interface ProductHeaderProps {
  product: ProductDefinition;
  onBack: () => void;
}

/** Names the product you're designing and gets you back to the picker to switch to another. */
export function ProductHeader({ product, onBack }: ProductHeaderProps) {
  return (
    <div className="shrink-0 border-b border-stone-100 px-6 pb-4 pt-5">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 mb-1 flex items-center gap-1 rounded px-1 py-0.5 text-xs text-stone-400 transition-colors hover:text-stone-700"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        All products
      </button>
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">{product.label}</h1>
      <p className="text-sm text-stone-500">{product.tagline}</p>
    </div>
  );
}
