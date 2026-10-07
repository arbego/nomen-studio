import type { ProductDefinition } from '../products/types';
import { parseProjectFile, ProjectFileError, PROJECT_FORMAT, PROJECT_VERSION, type ProjectFile } from './projectFile';

function expandProject(json: string, knownProduct: (id: string) => boolean): ProjectFile {
  let compact: unknown;
  try { compact = JSON.parse(json); }
  catch { throw new ProjectFileError("That share link isn't valid JSON."); }
  if (!Array.isArray(compact) || compact.length !== 3) {
    throw new ProjectFileError("That share link couldn't be opened. It may be incomplete or damaged.");
  }
  const [version, product, design] = compact;
  return parseProjectFile(JSON.stringify({ format: PROJECT_FORMAT, version, product, design }), knownProduct);
}

/** The fragment stays in the browser; no server or stored project is needed. */
export function hasSharedProject(url: string): boolean {
  return new URLSearchParams(new URL(url).hash.slice(1)).has('share');
}

/** Capture the design before compression so later edits cannot change this link. */
export async function createShareUrl(product: ProductDefinition, baseUrl: string): Promise<string> {
  const { design } = product.project.snapshot();
  // [project version, product id, complete design].
  // Omit informational file metadata, but preserve every design field and value.
  const json = JSON.stringify([PROJECT_VERSION, product.id, design]);
  const compressed = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
  // Avoid spreading the whole array: large designs can exceed argument limits.
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = new URL(baseUrl);
  url.hash = `share=${encoded}`;
  return url.href;
}

/** Validate the same envelope as project files, then let the product coerce its config. */
export async function readSharedProject(url: string, knownProduct: (id: string) => boolean): Promise<ProjectFile | null> {
  const encoded = new URLSearchParams(new URL(url).hash.slice(1)).get('share');
  if (encoded === null) return null;

  let json: string;
  try {
    if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Invalid base64');
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decompressed = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    json = await new Response(decompressed).text();
  } catch {
    throw new ProjectFileError("That share link couldn't be opened. It may be incomplete or damaged.");
  }
  return expandProject(json, knownProduct);
}
