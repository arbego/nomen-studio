/** Turns a design's own text into a safe download filename, falling back to a product-supplied name when nothing usable survives. */
export function slugifyFilename(text: string, fallback = 'design'): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}
