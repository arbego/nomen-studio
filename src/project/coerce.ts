/**
 * Coercion helpers for reading a project file.
 *
 * A saved file is whatever was on someone's disk: written by an older release,
 * hand-edited, truncated, or simply not ours. Rather than trusting it or
 * rejecting it wholesale, every field is read through one of these, which keeps
 * a value only when it is of the right kind and in range and otherwise falls
 * back to the default. A file missing a field added since it was written loads
 * with that field's default, which is what makes old files keep working.
 */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a field off something that may not be an object at all. Arrays are not objects here: indexing one is `element` below, and conflating the two hides the mistake. */
export function field(source: unknown, key: string): unknown {
  return isPlainObject(source) ? source[key] : undefined;
}

/** Reads an element off something that may not be an array at all. */
export function element(source: unknown, index: number): unknown {
  return Array.isArray(source) ? source[index] : undefined;
}

export interface NumberRange {
  min?: number;
  max?: number;
}

/** A finite number, clamped into range. NaN and Infinity are rejected outright — they travel silently into geometry and come out as an empty mesh. */
export function asNumber(value: unknown, fallback: number, range: NumberRange = {}): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const { min = -Infinity, max = Infinity } = range;
  return Math.min(Math.max(value, min), max);
}

export function asString(value: unknown, fallback: string, maxLength = 200): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

export function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** One of a fixed set of strings — a standing mode, a product id — or the default. */
export function asOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function asOffset(value: unknown, fallback: { x: number; y: number }): { x: number; y: number } {
  return { x: asNumber(field(value, 'x'), fallback.x), y: asNumber(field(value, 'y'), fallback.y) };
}

/**
 * An array, each element read through `parseItem`. A `parseItem` returning null
 * drops that element, which is how an entry too broken to repair — an ornament
 * with no icon — is left out rather than loaded as a hole.
 */
export function asArray<T>(value: unknown, parseItem: (item: unknown, index: number) => T | null, maxLength = 1000): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: T[] = [];
  for (const [index, item] of value.slice(0, maxLength).entries()) {
    const parsed = parseItem(item, index);
    if (parsed !== null) {
      out.push(parsed);
    }
  }
  return out;
}

export function asNumberArray(value: unknown, range: NumberRange = {}): number[] {
  return asArray(value, (item) => (typeof item === 'number' && Number.isFinite(item) ? asNumber(item, 0, range) : null));
}

export function asStringArray(value: unknown, maxLength = 200): string[] {
  return asArray(value, (item) => (typeof item === 'string' ? item.slice(0, maxLength) : null));
}

/** A string-keyed map, each value read through `parseValue`; keys whose value cannot be read are dropped. */
export function asRecord<T>(value: unknown, parseValue: (item: unknown, key: string) => T | null): Record<string, T> {
  if (!isPlainObject(value)) {
    return {};
  }
  const out: Record<string, T> = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = parseValue(item, key);
    if (parsed !== null) {
      out[key] = parsed;
    }
  }
  return out;
}
