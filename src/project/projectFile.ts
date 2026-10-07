import { field, isPlainObject } from './coerce';

/** Marks a file as ours. Checked before anything else, so a stray .json gets a clear answer rather than a pile of defaults. */
export const PROJECT_FORMAT = 'name-studio-project';

/**
 * Bumped only when a file written today could not be read correctly by the
 * reader of the day. Adding a field needs no bump: a reader fills a missing
 * field with its default (see coerce.ts), so old files keep working by
 * construction.
 */
export const PROJECT_VERSION = 1;

export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  /** Which product's studio this design belongs to — a ProductDefinition id. */
  product: string;
  /** Informational only; nothing reads it back. */
  savedAt: string;
  /** The product's own config, exactly as its store holds it. */
  design: unknown;
}

/** The text of a project file: pretty-printed, because a design someone may want to read or diff is worth more than a few saved bytes. */
export function serializeProject(productId: string, design: unknown): string {
  const file: ProjectFile = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    product: productId,
    savedAt: new Date().toISOString(),
    design,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Thrown with a message meant to be shown as-is: every one of these says what is wrong with the file in the user's terms. */
export class ProjectFileError extends Error {}

/**
 * Reads and checks a project file's envelope.
 *
 * Only the envelope: whether the design inside it makes sense is the product's
 * business, since only the product knows its own shape. What this guarantees is
 * that the file is ours, that it is not from a future this build cannot read,
 * and that it names a product that exists.
 */
export function parseProjectFile(text: string, knownProduct: (id: string) => boolean): ProjectFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProjectFileError("That file isn't valid JSON.");
  }

  if (!isPlainObject(parsed) || field(parsed, 'format') !== PROJECT_FORMAT) {
    throw new ProjectFileError("That doesn't look like a Nomen Studio project file.");
  }

  const version = field(parsed, 'version');
  if (typeof version !== 'number' || !Number.isFinite(version)) {
    throw new ProjectFileError("That project file doesn't say which version it is.");
  }
  if (version > PROJECT_VERSION) {
    throw new ProjectFileError('That project was saved by a newer version of Nomen Studio.');
  }

  const product = field(parsed, 'product');
  if (typeof product !== 'string' || !knownProduct(product)) {
    throw new ProjectFileError(`That project is for a product this version doesn't have${typeof product === 'string' ? ` ("${product}")` : ''}.`);
  }

  return {
    format: PROJECT_FORMAT,
    version,
    product,
    savedAt: typeof field(parsed, 'savedAt') === 'string' ? (field(parsed, 'savedAt') as string) : '',
    design: field(parsed, 'design'),
  };
}
