// A `.gather` arrives as a form attachment, which means the reader's input is
// whatever someone put there. These tests are written from the attacker's side:
// each one forges an archive that a permissive zip library would happily
// extract, and asserts that this reader refuses it instead.
import test from 'node:test';
import assert from 'node:assert/strict';

import { readArchive, writeArchive } from '../../src/packaging/archive.js';
import { crc32 } from '../../src/packaging/crc32.js';

const encoder = new TextEncoder();
const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

/**
 * Forges an archive one field at a time, so a test can change exactly the thing
 * it is about and leave every other byte well-formed. Anything a real writer
 * would never emit is reachable here.
 */
const forge = (entries, { centralNames = null, centralCount = null } = {}) => {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const bytes = entry.bytes ?? new Uint8Array(0);
    const crc = entry.crc ?? crc32(bytes);
    const size = entry.size ?? bytes.byteLength;
    const compressed = entry.compressedSize ?? size;
    const header = [
      ...u32(0x04034b50), ...u16(10), ...u16(entry.flags ?? 0), ...u16(entry.method ?? 0),
      ...u16(0), ...u16(0x21), ...u32(crc), ...u32(compressed), ...u32(size),
      ...u16(name.length), ...u16(0),
    ];
    local.push(Uint8Array.from(header), name, bytes);
    offset += header.length + name.length + bytes.byteLength;
  }
  const names = centralNames ?? entries.map((entry) => entry.path);
  for (const path of names) {
    const name = encoder.encode(path);
    central.push(
      Uint8Array.from([
        ...u32(0x02014b50), ...u16(10), ...u16(10), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21),
        ...u32(0), ...u32(0), ...u32(0), ...u16(name.length),
        ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0),
      ]),
      name
    );
  }
  const count = centralCount ?? names.length;
  const parts = [
    ...local,
    ...central,
    Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count), ...u32(0), ...u32(0), ...u16(0)]),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
};

const ok = { path: 'manifest.json', bytes: encoder.encode('{}') };

const refuses = (bytes, match) => assert.throws(() => readArchive(bytes), match);

test('forge produces something the reader accepts, so the refusals below mean what they say', () => {
  const entries = readArchive(forge([ok]));
  assert.equal(new TextDecoder().decode(entries.get('manifest.json')), '{}');
});

test('refuses compressed entries, because it only ever writes stored ones', () => {
  refuses(forge([{ ...ok, method: 8 }]), /compression method 8/);
});

test('refuses a repeated entry name rather than letting the last one win', () => {
  refuses(forge([ok, { ...ok, bytes: encoder.encode('{"other":true}') }]), /repeats the entry/);
});

test('refuses absolute paths', () => {
  refuses(forge([{ ...ok, path: '/etc/passwd' }]), /not acceptable/);
});

test('refuses parent-directory traversal', () => {
  refuses(forge([{ ...ok, path: 'models/../../escape.json' }]), /not acceptable/);
});

test('refuses backslashes, which mean one thing on posix and another on windows', () => {
  refuses(forge([{ ...ok, path: 'models\\sha256-x\\model.onnx' }]), /not acceptable/);
});

test('refuses drive letters', () => {
  refuses(forge([{ ...ok, path: 'C:/manifest.json' }]), /not acceptable/);
});

test('refuses streamed sizes, whose lengths cannot be checked before reading', () => {
  refuses(forge([{ ...ok, flags: 0x08 }]), /streamed entry sizes/);
});

test('refuses headers that disagree with themselves about entry size', () => {
  refuses(forge([{ ...ok, compressedSize: 99 }]), /sizes disagree/);
});

test('refuses an entry that claims to run past the end of the file', () => {
  refuses(forge([{ ...ok, size: 4096, compressedSize: 4096 }]), /past the end/);
});

test('refuses a corrupted entry whose declared CRC no longer matches', () => {
  refuses(forge([{ ...ok, crc: 0xdeadbeef }]), /failed its CRC/);
});

test('refuses an index that names an entry the archive does not contain', () => {
  refuses(forge([ok], { centralNames: ['manifest.json', 'composition.a2ui.json'] }), /does not contain/);
});

test('refuses an index that disagrees about how many entries there are', () => {
  // The classic ambiguity: two readers disagree about what the archive holds,
  // so the one that verifies and the one that extracts see different files.
  refuses(forge([ok, { path: 'extra.json', bytes: encoder.encode('1') }], { centralNames: ['manifest.json'] }), /disagree about how many/);
});

test('refuses more entries than a Tool could plausibly need', () => {
  const many = Array.from({ length: 65 }, (_, index) => ({ path: `f${index}.json`, bytes: encoder.encode('1') }));
  refuses(forge(many), /more entries than/);
});

test('refuses empty input rather than reporting an empty package', () => {
  refuses(new Uint8Array(0), /No archive entries/);
});

test('still reads what writeArchive writes', () => {
  const bytes = writeArchive([
    { path: 'manifest.json', bytes: encoder.encode('{"gatherPackage":2}') },
    { path: 'models/sha256-abc/model.onnx', bytes: Uint8Array.from([1, 2, 3]) },
  ]);
  const entries = readArchive(bytes);
  assert.deepEqual([...entries.keys()], ['manifest.json', 'models/sha256-abc/model.onnx']);
});
