/**
 * A deterministic ZIP, written and read here rather than pulled in.
 *
 * The same Tool and the same dependencies must produce the same bytes: Central
 * caches a form attachment by hash, and a reproducible artifact is the whole
 * point of freezing one. Most zip libraries embed timestamps, host attributes
 * and a compression level that varies with version, none of which we want and
 * all of which are easier to guarantee by writing the two hundred bytes of
 * header ourselves than by configuring them away.
 *
 * ```text
 * entries      sorted by path, bytewise
 * timestamps   fixed
 * compression  none — model bytes are already compressed, and STORE is the one
 *              setting no library version can disagree about
 * attributes   none: no unix modes, no extra fields, no comments
 * ```
 *
 * Not a general zip implementation, and the reader is deliberately narrower
 * still. A `.gather` file arrives from a form attachment — untrusted input — so
 * the reader accepts only the subset written here and says "this is not a
 * Gather package I understand" to everything else. Being a bad zip library is
 * the point: an unsupported archive is a clearer outcome than a surprising one.
 */
import { crc32 } from './crc32.js';

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const END_SIG = 0x06054b50;
/** 1980-01-01, the earliest a DOS timestamp can express. */
const FIXED_TIME = 0;
const FIXED_DATE = 0x0021;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const u16 = (value) => [value & 0xff, (value >> 8) & 0xff];
const u32 = (value) => [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];

/**
 * @param {Array<{ path: string, bytes: Uint8Array }>} entries
 * @returns {Uint8Array}
 */
export const writeArchive = (entries) => {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const seen = new Set();
  for (const entry of sorted) {
    if (seen.has(entry.path)) throw new Error(`Duplicate archive entry: ${entry.path}`);
    seen.add(entry.path);
  }

  const local = [];
  const central = [];
  let offset = 0;

  for (const entry of sorted) {
    const name = encoder.encode(entry.path);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.byteLength;

    const header = [
      ...u32(LOCAL_SIG), ...u16(10), ...u16(0), ...u16(0),
      ...u16(FIXED_TIME), ...u16(FIXED_DATE),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(name.length), ...u16(0),
    ];
    local.push(Uint8Array.from(header), name, entry.bytes);

    central.push(
      Uint8Array.from([
        ...u32(CENTRAL_SIG), ...u16(10), ...u16(10), ...u16(0), ...u16(0),
        ...u16(FIXED_TIME), ...u16(FIXED_DATE),
        ...u32(crc), ...u32(size), ...u32(size),
        ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(0), ...u32(offset),
      ]),
      name
    );
    offset += header.length + name.length + size;
  }

  const centralStart = offset;
  const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0);
  const end = Uint8Array.from([
    ...u32(END_SIG), ...u16(0), ...u16(0),
    ...u16(sorted.length), ...u16(sorted.length),
    ...u32(centralSize), ...u32(centralStart), ...u16(0),
  ]);

  const parts = [...local, ...central, end];
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
};

/** Bounds chosen to be far above any real Tool and far below anything alarming. */
const LIMITS = Object.freeze({
  entries: 64,
  entryBytes: 256 * 1024 * 1024,
  totalBytes: 512 * 1024 * 1024,
  pathLength: 200,
});

/**
 * Paths we are willing to extract.
 *
 * A `.gather` is written by us and read from a form attachment, so the reader
 * refuses anything that could escape a directory or mean two things: absolute
 * paths, `..` segments, backslashes, drive letters, empty or trailing segments.
 * Nothing is ever written to a filesystem from here, but a path that lies is
 * evidence enough to stop.
 */
const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

const assertSafePath = (path) => {
  if (path.length === 0 || path.length > LIMITS.pathLength) {
    throw new Error(`Archive entry name is not acceptable: ${path.slice(0, 40)}`);
  }
  if (path.includes('\\') || path.includes('..') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    throw new Error(`Archive entry name is not acceptable: ${path}`);
  }
  if (!SAFE_PATH.test(path)) {
    throw new Error(`Archive entry name is not acceptable: ${path}`);
  }
};

/** @returns {Map<string, Uint8Array>} */
export const readArchive = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength > LIMITS.totalBytes) throw new Error('Archive is larger than this reader accepts.');
  const entries = new Map();
  let at = 0;
  while (at + 30 <= bytes.byteLength && view.getUint32(at, true) === LOCAL_SIG) {
    if (entries.size >= LIMITS.entries) throw new Error('Archive declares more entries than this reader accepts.');

    const method = view.getUint16(at + 8, true);
    const compressed = view.getUint32(at + 18, true);
    const size = view.getUint32(at + 22, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const flags = view.getUint16(at + 6, true);

    if (method !== 0) {
      throw new Error(`Archive entry uses compression method ${method}; only stored entries are read.`);
    }
    // Bit 3 puts the sizes in a trailing descriptor, so the header's are zero.
    // We never write it, and honouring it would mean trusting a length we
    // cannot check until after reading.
    if (flags & 0x08) throw new Error('Archive uses streamed entry sizes, which this reader does not accept.');
    if (compressed !== size) throw new Error('Archive entry sizes disagree.');
    if (size > LIMITS.entryBytes) throw new Error('Archive entry is larger than this reader accepts.');

    const nameAt = at + 30;
    const dataAt = nameAt + nameLength + extraLength;
    if (dataAt + size > bytes.byteLength) throw new Error('Archive entry extends past the end of the file.');

    const path = decoder.decode(bytes.subarray(nameAt, nameAt + nameLength));
    assertSafePath(path);
    if (entries.has(path)) throw new Error(`Archive repeats the entry ${path}.`);

    const data = bytes.subarray(dataAt, dataAt + size);
    if (crc32(data) !== view.getUint32(at + 14, true)) throw new Error(`Archive entry ${path} failed its CRC.`);
    entries.set(path, data);
    at = dataAt + size;
  }
  if (entries.size === 0) throw new Error('No archive entries found.');

  // The central directory is the archive's own index. If it disagrees with the
  // local headers we just read, the file means two things and we read neither.
  let central = at;
  let counted = 0;
  while (central + 46 <= bytes.byteLength && view.getUint32(central, true) === CENTRAL_SIG) {
    const nameLength = view.getUint16(central + 28, true);
    const name = decoder.decode(bytes.subarray(central + 46, central + 46 + nameLength));
    if (!entries.has(name)) throw new Error(`Archive index names ${name}, which it does not contain.`);
    counted += 1;
    central += 46 + nameLength + view.getUint16(central + 30, true) + view.getUint16(central + 32, true);
  }
  if (counted !== entries.size) {
    throw new Error('Archive index and contents disagree about how many entries there are.');
  }
  return entries;
};

/**
 * How to open a `.gather` file.
 *
 * By signature, not by byte zero: v1 is the composition JSON verbatim and may
 * be pretty-printed or carry a BOM. Sniffing decides only how to *open* the
 * file — `manifest.gatherPackage` decides what the contents mean.
 */
export const detectFormat = (bytes) => {
  if (bytes.length >= 4) {
    const signature = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
    // Local header, central directory, or an empty archive.
    if (signature === LOCAL_SIG || signature === CENTRAL_SIG || signature === END_SIG) return 'container';
  }
  let at = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) at = 3;
  while (at < bytes.length && [0x20, 0x09, 0x0a, 0x0d].includes(bytes[at])) at += 1;
  const first = String.fromCharCode(bytes[at]);
  if (first === '[' || first === '{') return 'composition';
  return 'unknown';
};
