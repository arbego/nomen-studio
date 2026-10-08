import { PRODUCT_REGISTRY } from '../products/registry';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from './Logo';
import { OpenProjectButton } from './ProjectButtons';

interface ProductPickerProps {
  onSelect: (productId: string) => void;
}

/** The landing screen: pick what you want to design before entering its studio. */
export function ProductPicker({ onSelect }: ProductPickerProps) {
  return (
    <div className="h-screen w-screen overflow-y-auto bg-stone-100 dark:bg-stone-950">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-6 py-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Logo className="h-9 w-auto text-stone-900 dark:text-stone-100" />
              <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Nomen Studio</h1>
            </div>
            <p className="mt-1 text-stone-500 dark:text-stone-400">Design a personalized piece and export it print-ready. Pick what you're making.</p>
          </div>
          <ThemeToggle className="shrink-0" />
        </div>

        <OpenProjectButton onOpened={onSelect} />

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
        <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-8 text-xs text-stone-500 dark:text-stone-400">
          <span>Version {import.meta.env.VITE_GIT_VERSION ?? 'unavailable'}</span>
          <a
            href={`${import.meta.env.BASE_URL}licenses.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center rounded underline decoration-dotted underline-offset-2 transition-colors hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-stone-100"
          >
            Open-source licenses
          </a>
          <a
            href="https://github.com/arbego/nomen-studio/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center gap-1.5 rounded underline decoration-dotted underline-offset-2 transition-colors hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-stone-100"
          >
            Contribute to GitHub
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 .75a11.25 11.25 0 0 0-3.557 21.923c.563.105.769-.244.769-.542 0-.267-.01-.974-.015-1.911-3.13.68-3.79-1.508-3.79-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.023-.699.077-.684.077-.684 1.13.08 1.725 1.16 1.725 1.16 1.006 1.723 2.64 1.225 3.282.937.102-.728.394-1.225.716-1.506-2.498-.284-5.124-1.25-5.124-5.566 0-1.23.44-2.234 1.16-3.022-.116-.284-.503-1.43.11-2.98 0 0 .945-.303 3.095 1.155a10.78 10.78 0 0 1 5.634 0c2.149-1.458 3.092-1.155 3.092-1.155.615 1.55.228 2.696.112 2.98.722.788 1.159 1.792 1.159 3.022 0 4.327-2.63 5.279-5.136 5.557.404.35.765 1.04.765 2.097 0 1.514-.014 2.735-.014 3.106 0 .3.203.651.774.541A11.25 11.25 0 0 0 12 .75Z" />
            </svg>
          </a>
        </footer>
      </div>
    </div>
  );
}
