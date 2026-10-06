import { ThemeToggle } from './ThemeToggle';
import { Logo } from './Logo';
import type { ProductDefinition } from '../products/types';

interface ProductHeaderProps {
  product: ProductDefinition;
  onBack: () => void;
}

/** Names the product you're designing, gets you back to the picker to switch to another, and offers a way to leave the editor. */
export function ProductHeader({ product, onBack }: ProductHeaderProps) {
  return (
    <div className="shrink-0 border-b border-stone-100 dark:border-stone-800 px-6 pb-4 pt-5">
      {/* The toggle shares the back link's row, which has room to spare — beside
          the heading it would squeeze the tagline onto two lines. */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo className="h-4 w-auto text-stone-700 dark:text-stone-300" label="Name Studio" />
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-stone-400 dark:text-stone-500 transition-colors hover:text-stone-700 dark:hover:text-stone-300"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            All products
          </button>
        </div>
        <ThemeToggle className="-mr-1.5 h-7 w-7 shrink-0" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">{product.label}</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400">{product.tagline}</p>
    </div>
  );
}
