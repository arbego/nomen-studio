import { PRODUCT_REGISTRY } from '../products/registry';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from './Logo';

interface ProductPickerProps {
  onSelect: (productId: string) => void;
}

/** The landing screen: pick what you want to design before entering its studio. */
export function ProductPicker({ onSelect }: ProductPickerProps) {
  return (
    <div className="h-screen w-screen overflow-y-auto bg-stone-100 dark:bg-stone-950">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Logo className="h-9 w-auto text-stone-900 dark:text-stone-100" />
              <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Name Studio</h1>
            </div>
            <p className="mt-1 text-stone-500 dark:text-stone-400">Design a personalized piece and export it print-ready. Pick what you're making.</p>
          </div>
          <ThemeToggle className="shrink-0" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PRODUCT_REGISTRY.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelect(product.id)}
              className="group flex flex-col gap-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-stone-400 dark:hover:border-stone-500 hover:shadow-lg"
            >
              <div className="flex h-28 items-center justify-center rounded-xl bg-stone-50 dark:bg-stone-800 p-5 text-stone-400 dark:text-stone-500 transition-colors group-hover:text-stone-700 dark:group-hover:text-stone-300">
                <product.Thumbnail />
              </div>
              <div>
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">{product.label}</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">{product.tagline}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
