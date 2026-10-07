import { deflateRawSync, inflateRawSync, gzipSync, gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PRODUCT_REGISTRY, getProduct } from '../products/registry';
import { DEFAULT_NAME_DISPLAY_CONFIG } from '../products/nameDisplay/store';
import { PROJECT_VERSION } from './projectFile';
import { createShareUrl, hasSharedProject, readSharedProject } from './shareProject';

const known = (id: string) => getProduct(id) !== undefined;
const LIAM_REFERENCE_GZIP = 'H4sIAAAAAAAAE12S3W7bMAyF34W7lQ3ZjuNEd0WLdQOabcAGDFhRDKxEO2ptyZCUbkXgdx_kv6a71Efy8JDiGWrrOgwgwGBHiQ8npW3SO_tEMgCDF3JeWwMiY9A7q05yzVXa9y2-AgOPL6SuYiDn-TbJeMKrH1kmyo3g23RTVr-AgSKvGwPiDNrooLEFAXfAltdHa8JnBQIkttoH2-Bb7BPp5hgOHYhsw1d6Q304jjBno6MoqLGD6bUKKjRSmybx0uk-zNGfWs3FWTWRVa6IXqV1GKzzIO7P8KxNFNLSmmhqFF0ykiwiac2XyUGHgZzGVjgrnyn8bvFk5BEY_Fk65llssDQbHhj4gEYdrIr1xhoCBsHp7mtdexrH5pPFCcQV_gWR5GlRMXgFsU-rapgy7igEcrfY-1h2zxln_GEKXZmmpRtqQOwuBvzWoqSOTPBR9nIqcQb7rt82LfZjv6JKq2JggKsiH4YLzWvbjpv7Tw8-1FVd1jkMDPpxOW8_uJDrltChkTROneYlA4f64gB2E1grl4wDukabSDYT-P6-Q7mezeguunksVU67-R5WOnucP2XFao97fIRh-AeCLxMUMgMAAA';
// The supplied Liam example, decoded independently as a test fixture.
const LIAM_DESIGN = JSON.parse(gunzipSync(Buffer.from(LIAM_REFERENCE_GZIP, 'base64url')).toString()).design;
function urlForJson(json: unknown) {
  return `https://studio.example/app/#share=${deflateRawSync(JSON.stringify(json)).toString('base64url')}`;
}

describe('share URLs', () => {
  it.each(PRODUCT_REGISTRY.map((product) => [product.id, product] as const))('round-trips the complete %s design', async (_id, product) => {
    const design = product.project.snapshot().design;
    const url = await createShareUrl(product, 'https://studio.example/app/?theme=dark#old');
    expect(new URL(url).pathname).toBe('/app/');
    expect(new URL(url).search).toBe('?theme=dark');
    expect(new URL(url).hash).toMatch(/^#share=[A-Za-z0-9_-]+$/);
    expect(hasSharedProject(url)).toBe(true);
    const payload = JSON.parse(inflateRawSync(Buffer.from(new URL(url).hash.slice('#share='.length), 'base64url')).toString());
    expect(payload).toEqual([PROJECT_VERSION, product.id, design]);
    const shared = await readSharedProject(url, known);
    expect(shared?.product).toBe(product.id);
    expect(shared?.design).toEqual(design);
    product.project.load(shared!.design);
    expect(product.project.snapshot().design).toEqual(design);
  });

  it('uses real raw DEFLATE and preserves Unicode, placements, and colors from the captured snapshot', async () => {
    let design = { text: 'Zoë 🎂 日本語', placements: { a: { x: -12.5, y: 70 } }, colors: ['#b7c4ac'], repeated: 'letter '.repeat(1000) };
    const captured = design;
    const product = { ...PRODUCT_REGISTRY[0], project: { snapshot: () => ({ name: 'Unicode', design }), load: () => {} } };
    const promise = createShareUrl(product, 'https://studio.example/');
    design = { ...design, text: 'Later edit' };
    const url = await promise;
    const compressed = Buffer.from(new URL(url).hash.slice('#share='.length), 'base64url');
    const json = inflateRawSync(compressed).toString('utf8');
    expect(compressed.length).toBeLessThan(Buffer.byteLength(json));
    expect(JSON.parse(json)[2]).toEqual(captured);
    expect((await readSharedProject(url, known))?.design).toEqual(captured);
  });

  it('keeps the Liam design explicit and produces a smaller payload than gzip', async () => {
    const original = { design: LIAM_DESIGN };
    const product = getProduct('name-display')!;
    const capturedProduct = { ...product, project: { ...product.project, snapshot: () => ({ name: 'Liam', design: original!.design }) } };
    const url = await createShareUrl(capturedProduct, 'https://studio.example/');
    const payload = new URL(url).hash.slice('#share='.length);
    expect(LIAM_REFERENCE_GZIP.length).toBe(602);
    expect(payload.length).toBeLessThan(LIAM_REFERENCE_GZIP.length);
    const compact = JSON.parse(inflateRawSync(Buffer.from(payload, 'base64url')).toString());
    expect(compact).toEqual([PROJECT_VERSION, product.id, original.design]);
    expect(payload.length).toBeLessThan(gzipSync(JSON.stringify(compact)).toString('base64url').length);
    expect((await readSharedProject(url, known))?.design).toEqual(original?.design);
    expect((await readSharedProject(url, known))?.product).toBe('name-display');
  });

  it('preserves the complete design after loading reorders JSON object keys', async () => {
    const product = getProduct('name-display')!;
    const original = { design: LIAM_DESIGN };
    const captured = { ...product, project: { ...product.project, snapshot: () => ({ name: 'Liam', design: original!.design }) } };
    const before = await createShareUrl(captured, 'https://studio.example/');
    product.project.load(original!.design);
    const after = await createShareUrl(product, 'https://studio.example/');
    expect((await readSharedProject(after, known))?.design).toEqual((await readSharedProject(before, known))?.design);
  });

  it.each(PRODUCT_REGISTRY.map((product) => [product.id, product] as const))('preserves edited fields, removals, and added fields for %s', async (_id, product) => {
    const design = {
      ...(product.project.snapshot().design as Record<string, unknown>),
      name: 'Zoë 🎂 日本語',
      decorators: [],
      decoratorPlacements: {},
      decoratorColors: {},
      outlineEnabled: false,
      trimOffsetMm: -1.23456789,
      nameOffset: { x: 0, y: -23.45 },
      futureField: { value: null, empty: '', items: [] },
    };
    const capturedProduct = { ...product, project: { ...product.project, snapshot: () => ({ name: 'Edited', design }) } };
    const url = await createShareUrl(capturedProduct, 'https://studio.example/');
    expect((await readSharedProject(url, known))?.design).toEqual(design);
  });

  it('preserves partial snapshots without inserting fields that were absent', async () => {
    const product = getProduct('name-display')!;
    const design = { name: 'Partial', decorators: [] };
    const partial = { ...product, project: { ...product.project, snapshot: () => ({ name: 'Partial', design }) } };
    const url = await createShareUrl(partial, 'https://studio.example/');
    expect((await readSharedProject(url, known))?.design).toEqual(design);
  });

  it('restores the explicit design even when application defaults change', async () => {
    const product = getProduct('name-display')!;
    const originalDesign = LIAM_DESIGN;
    const url = await createShareUrl({ ...product, project: { ...product.project, snapshot: () => ({ name: 'Liam', design: originalDesign }) } }, 'https://studio.example/');
    const defaults = { ...DEFAULT_NAME_DISPLAY_CONFIG };
    try {
      Object.assign(DEFAULT_NAME_DISPLAY_CONFIG, { name: 'New default', initial: 'N', initialColor: '#000000', nameWidthMm: 200 });
      const shared = await readSharedProject(url, known);
      expect(shared?.design).toEqual(originalDesign);
      product.project.load(shared!.design);
      expect(product.project.snapshot().design).toEqual(originalDesign);
    } finally {
      Object.assign(DEFAULT_NAME_DISPLAY_CONFIG, defaults);
    }
  });

  it.each([
    [PROJECT_VERSION, 'name-display'],
    [PROJECT_VERSION, 'name-display', {}, 'extra'],
    { product: 'name-display', design: {} },
    null,
  ].map((compact) => [compact]))('rejects malformed share data %j', async (compact) => {
    await expect(readSharedProject(urlForJson(compact), known)).rejects.toThrow('incomplete or damaged');
  });

  it('ignores ordinary URLs and unrelated fragments', async () => {
    for (const url of ['https://studio.example/', 'https://studio.example/#section', 'https://studio.example/?share=abc']) {
      expect(hasSharedProject(url)).toBe(false);
      expect(await readSharedProject(url, known)).toBeNull();
    }
  });

  it.each(['', '%', 'invalid', Buffer.from('plain JSON').toString('base64url')])('rejects damaged share payload %j', async (payload) => {
    await expect(readSharedProject(`https://studio.example/#share=${payload}`, known)).rejects.toThrow('incomplete or damaged');
  });

  it('checks the version and product before a shared design can load', async () => {
    await expect(readSharedProject(urlForJson([PROJECT_VERSION + 1, 'name-display', {}]), known)).rejects.toThrow('newer version');
    await expect(readSharedProject(urlForJson(['1', 'name-display', {}]), known)).rejects.toThrow("doesn't say which version");
    await expect(readSharedProject(urlForJson([PROJECT_VERSION, 'unknown', {}]), known)).rejects.toThrow("doesn't have");
  });

  it('reports malformed JSON after successful decompression', async () => {
    const payload = deflateRawSync('invalid JSON').toString('base64url');
    await expect(readSharedProject(`https://studio.example/#share=${payload}`, known)).rejects.toThrow("isn't valid JSON");
  });
});
