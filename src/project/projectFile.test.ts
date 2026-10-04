import { describe, expect, it } from 'vitest';
import { parseProjectFile, ProjectFileError, PROJECT_FORMAT, PROJECT_VERSION, serializeProject } from './projectFile';

const known = (id: string) => id === 'name-display' || id === 'cake-topper';

function envelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION, product: 'name-display', savedAt: '2026-01-01T00:00:00.000Z', design: { name: 'Mia' }, ...overrides });
}

describe('serializeProject', () => {
  it('writes a file that says what it is, what it is for, and when it was made', () => {
    const parsed = JSON.parse(serializeProject('name-display', { name: 'Mia' }));
    expect(parsed.format).toBe(PROJECT_FORMAT);
    expect(parsed.version).toBe(PROJECT_VERSION);
    expect(parsed.product).toBe('name-display');
    expect(parsed.design).toEqual({ name: 'Mia' });
    expect(Number.isNaN(Date.parse(parsed.savedAt))).toBe(false);
  });

  it('is readable and diffable, not minified', () => {
    const text = serializeProject('name-display', { name: 'Mia' });
    expect(text).toContain('\n  "product"');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('round-trips through the reader', () => {
    const design = { name: 'Mia', nested: { a: [1, 2, 3] } };
    expect(parseProjectFile(serializeProject('name-display', design), known).design).toEqual(design);
  });
});

describe('parseProjectFile', () => {
  it('rejects something that is not JSON at all', () => {
    expect(() => parseProjectFile('<html>', known)).toThrow(ProjectFileError);
    expect(() => parseProjectFile('<html>', known)).toThrow(/valid JSON/);
  });

  it.each([
    ['a bare array', '[]'],
    ['a bare number', '42'],
    ['null', 'null'],
    ['someone else’s JSON', '{"name":"package.json"}'],
  ])('rejects %s rather than loading a pile of defaults from it', (_label, text) => {
    expect(() => parseProjectFile(text, known)).toThrow(/Name Studio project file/);
  });

  it('refuses a file from a version that knows things this one does not', () => {
    expect(() => parseProjectFile(envelope({ version: PROJECT_VERSION + 1 }), known)).toThrow(/newer version/);
  });

  it('accepts an older version, since a reader fills in what it adds', () => {
    expect(parseProjectFile(envelope({ version: 0 }), known).version).toBe(0);
  });

  it('refuses a product this build does not have, and says which', () => {
    expect(() => parseProjectFile(envelope({ product: 'fridge-magnet' }), known)).toThrow(/fridge-magnet/);
  });

  it('refuses a file with no version at all', () => {
    expect(() => parseProjectFile(envelope({ version: undefined }), known)).toThrow(/which version/);
  });

  it('survives a file whose design is missing — the product decides what to do with nothing', () => {
    expect(parseProjectFile(envelope({ design: undefined }), known).design).toBeUndefined();
  });

  it('every refusal explains itself in words worth showing someone', () => {
    const inputs = ['not json', '{}', envelope({ version: 99 }), envelope({ product: 'nope' })];
    for (const input of inputs) {
      try {
        parseProjectFile(input, known);
        throw new Error(`expected ${input} to be refused`);
      } catch (error) {
        expect(error).toBeInstanceOf(ProjectFileError);
        expect((error as Error).message).toMatch(/\.$/); // a sentence, not a code
      }
    }
  });
});
