/**
 * Just enough ZIP to write an OPC package (which is what a .3mf file is).
 *
 * Entries are stored, never deflated: the only consumer is a slicer reading a
 * handful of parts, and a compressor is a dependency and a pile of code to
 * carry for a file the user downloads once. Every reader supports stored
 * entries — they are the original ZIP method.
 */

const CRC_TABLE = /* @__PURE__ */ (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Path inside the archive, forward-slashed and without a leading slash. */
  path: string;
  data: Uint8Array;
}

const LOCAL_HEADER_BYTES = 30;
const CENTRAL_HEADER_BYTES = 46;
const END_RECORD_BYTES = 22;

/** 1980-01-01, the earliest a DOS timestamp can express, so the same design always writes the same bytes. */
const DOS_DATE = 0x21;
const DOS_TIME = 0;

export function zipStore(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => ({ name: encoder.encode(entry.path), data: entry.data, crc: crc32(entry.data) }));

  const localBytes = prepared.reduce((sum, e) => sum + LOCAL_HEADER_BYTES + e.name.length + e.data.length, 0);
  const centralBytes = prepared.reduce((sum, e) => sum + CENTRAL_HEADER_BYTES + e.name.length, 0);
  const out = new Uint8Array(localBytes + centralBytes + END_RECORD_BYTES);
  const view = new DataView(out.buffer);

  let at = 0;
  const localOffsets: number[] = [];
  for (const entry of prepared) {
    localOffsets.push(at);
    view.setUint32(at, 0x04034b50, true); // local file header
    view.setUint16(at + 4, 20, true); // version needed
    view.setUint16(at + 6, 0, true); // flags
    view.setUint16(at + 8, 0, true); // method: stored
    view.setUint16(at + 10, DOS_TIME, true);
    view.setUint16(at + 12, DOS_DATE, true);
    view.setUint32(at + 14, entry.crc, true);
    view.setUint32(at + 18, entry.data.length, true); // compressed size
    view.setUint32(at + 22, entry.data.length, true); // uncompressed size
    view.setUint16(at + 26, entry.name.length, true);
    view.setUint16(at + 28, 0, true); // extra field length
    out.set(entry.name, at + LOCAL_HEADER_BYTES);
    out.set(entry.data, at + LOCAL_HEADER_BYTES + entry.name.length);
    at += LOCAL_HEADER_BYTES + entry.name.length + entry.data.length;
  }

  const centralStart = at;
  prepared.forEach((entry, i) => {
    view.setUint32(at, 0x02014b50, true); // central directory header
    view.setUint16(at + 4, 20, true); // version made by
    view.setUint16(at + 6, 20, true); // version needed
    view.setUint16(at + 8, 0, true); // flags
    view.setUint16(at + 10, 0, true); // method: stored
    view.setUint16(at + 12, DOS_TIME, true);
    view.setUint16(at + 14, DOS_DATE, true);
    view.setUint32(at + 16, entry.crc, true);
    view.setUint32(at + 20, entry.data.length, true);
    view.setUint32(at + 24, entry.data.length, true);
    view.setUint16(at + 28, entry.name.length, true);
    view.setUint16(at + 30, 0, true); // extra field length
    view.setUint16(at + 32, 0, true); // comment length
    view.setUint16(at + 34, 0, true); // disk number
    view.setUint16(at + 36, 0, true); // internal attributes
    view.setUint32(at + 38, 0, true); // external attributes
    view.setUint32(at + 42, localOffsets[i], true);
    out.set(entry.name, at + CENTRAL_HEADER_BYTES);
    at += CENTRAL_HEADER_BYTES + entry.name.length;
  });

  view.setUint32(at, 0x06054b50, true); // end of central directory
  view.setUint16(at + 4, 0, true); // this disk
  view.setUint16(at + 6, 0, true); // disk with central directory
  view.setUint16(at + 8, prepared.length, true);
  view.setUint16(at + 10, prepared.length, true);
  view.setUint32(at + 12, at - centralStart, true);
  view.setUint32(at + 16, centralStart, true);
  view.setUint16(at + 20, 0, true); // comment length

  return out;
}
