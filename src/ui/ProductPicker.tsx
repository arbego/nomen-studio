import { PRODUCT_REGISTRY } from '../products/registry';

interface ProductPickerProps {
  onSelect: (productId: string) => void;
}

/** The landing screen: pick what you want to design before entering its studio. */
export function ProductPicker({ onSelect }: ProductPickerProps) {
  return (
    <div className="h-screen w-screen overflow-y-auto bg-stone-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Name Studio</h1>
          <p className="mt-1 text-stone-500">Design a personalized piece and export it print-ready. Pick what you're making.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PRODUCT_REGISTRY.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelect(product.id)}
              className="group flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-lg"
            >
              <div className="flex h-28 items-center justify-center rounded-xl bg-stone-50 p-5 text-stone-400 transition-colors group-hover:text-stone-700">
                <product.Thumbnail />
              </div>
              <div>
                <h2 className="font-semibold text-stone-900">{product.label}</h2>
                <p className="text-sm text-stone-500">{product.tagline}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
