import { useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { slugifyFilename } from '../export/filename';
import { getProduct } from '../products/registry';
import { parseProjectFile, ProjectFileError, serializeProject } from '../project/projectFile';
import type { ProductDefinition } from '../products/types';

interface ProjectButtonsProps {
  /** The product currently open — what Save writes. Open can load any product's file. */
  product: ProductDefinition;
  /** Called with the product a loaded file belongs to, so opening one can switch studios. */
  onOpened: (productId: string) => void;
}

const LINK_CLASS = 'rounded px-1 py-0.5 text-xs text-stone-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-stone-900';

/**
 * Saving the current design to a file and opening one back up.
 *
 * Lives in the shell rather than in either product's panel: a design is a
 * design whatever it is of, and the product definition's `project` hooks mean
 * this never has to know what is in one. Opening a file for a product you are
 * not in switches you to it, which is the only sensible reading of
 * double-clicking a cake topper while a name display is on screen.
 */
export function ProjectButtons({ product, onOpened }: ProjectButtonsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  function handleSave() {
    setFailure(null);
    const { name, design } = product.project.snapshot();
    const text = serializeProject(product.id, design);
    saveAs(new Blob([text], { type: 'application/json' }), `${slugifyFilename(name, product.id)}.json`);
  }

  async function handleFile(file: File) {
    setFailure(null);
    try {
      const parsed = parseProjectFile(await file.text(), (id) => getProduct(id) !== undefined);
      // Not necessarily the product on screen: a file carries its own.
      getProduct(parsed.product)!.project.load(parsed.design);
      onOpened(parsed.product);
    } catch (error) {
      setFailure(error instanceof ProjectFileError ? error.message : "That project file couldn't be opened.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} className={LINK_CLASS}>
          Save project
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} className={LINK_CLASS}>
          Open project
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so picking the same file twice in a row fires again —
            // the natural thing to do after editing it by hand.
            event.target.value = '';
            if (file) void handleFile(file);
          }}
        />
      </div>
      {failure && <p className="text-xs text-red-600">{failure}</p>}
    </div>
  );
}
