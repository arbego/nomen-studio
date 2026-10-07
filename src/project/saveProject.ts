import { saveAs } from 'file-saver';
import { slugifyFilename } from '../export/filename';
import type { ProductDefinition } from '../products/types';
import { markProjectSaved } from './projectSession';
import { serializeProject } from './projectFile';

interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
}

/** Ask for a filename, then save. Cancellation leaves the design unsaved. */
export async function saveProject(product: ProductDefinition): Promise<boolean> {
  const { name, design } = product.project.snapshot();
  const text = serializeProject(product.id, design);
  const suggestedName = `${slugifyFilename(name, product.id)}.json`;
  const pickerWindow = window as SavePickerWindow;

  if (typeof pickerWindow.showSaveFilePicker === 'function') {
    let handle: FileSystemFileHandle;
    try {
      // Called directly from the button gesture, before any asynchronous work.
      handle = await pickerWindow.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'Nomen Studio project', accept: { 'application/json': ['.json'] } }],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      throw error;
    }
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  } else {
    const enteredName = window.prompt('Save project as:', suggestedName);
    if (enteredName === null || !enteredName.trim()) return false;
    // OS filenames cannot contain control characters.
    // eslint-disable-next-line no-control-regex
    const filename = enteredName.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
    saveAs(new Blob([text], { type: 'application/json' }), /\.json$/i.test(filename) ? filename : `${filename}.json`);
  }

  // Record the saved snapshot, even if further edits happened while the picker was open.
  markProjectSaved(product, design);
  return true;
}
