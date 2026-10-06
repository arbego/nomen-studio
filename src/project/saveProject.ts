import { saveAs } from 'file-saver';
import { slugifyFilename } from '../export/filename';
import type { ProductDefinition } from '../products/types';
import { markProjectSaved } from './projectSession';
import { serializeProject } from './projectFile';

/** Download the current design, shared by the save button and leave prompt. */
export function saveProject(product: ProductDefinition) {
  const { name, design } = product.project.snapshot();
  const text = serializeProject(product.id, design);
  saveAs(new Blob([text], { type: 'application/json' }), `${slugifyFilename(name, product.id)}.json`);
  markProjectSaved(product, design);
}

