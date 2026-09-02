import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { join } from 'node:path';

import { localImageCaptureResult } from '../../packages/gather-components/src/camera/capturePhoto.js';

/**
 * The ODK image-capture boundary (Phase 3 / Phase 5 gate).
 *
 * ```text
 * XFormsImageControl → package-owned CameraView → serializable capture
 *   → attachImageMedia → existing ODK attachment/value path → submission
 * ```
 *
 * Scope note: this path deliberately does **not** produce an `ImageAsset`.
 * `ImageAsset` is the scientific/capability contract; the XForms path uses the
 * M5 instance-media model (durable file + safe filename bound in XML), and
 * `gather-storage` is deliberately asset-agnostic. Introducing `ImageAsset` here
 * would add coupling the contract audit warned against, for no current need. A
 * bridge belongs with the first consumer that actually needs one — a collection
 * field writing `ImageAsset[]` into XForms.
 */

const srcFiles = async (dir) => {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await srcFiles(path));
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) found.push(path);
  }
  return found;
};

test('the capture descriptor carries exactly what the attachment path needs', () => {
  // What CameraView hands to XFormsImageControl.
  const capture = localImageCaptureResult({
    uri: 'file:///cache/photo.jpeg',
    contentType: 'image/jpeg',
    width: 960,
    height: 640,
  });

  // `attachImageMedia` is called with `new File(capture.uri)` and
  // `capture.contentType`, so both must be present and local.
  assert.equal(typeof capture.uri, 'string');
  assert.ok(capture.uri.startsWith('file://'), 'the attachment path resolves a local file URI');
  assert.equal(capture.contentType, 'image/jpeg');

  // Dimensions travel too, so the review still renders at its true aspect ratio.
  assert.equal(capture.width, 960);
  assert.equal(capture.height, 640);

  // Nothing camera-native crosses the seam.
  assert.doesNotThrow(() => structuredClone(capture));
  assert.doesNotMatch(JSON.stringify(capture), /Photo|Frame|Camera/);
});

test('a non-local capture is rejected before it can reach the attachment path', () => {
  assert.throws(() => localImageCaptureResult({ uri: 'https://example.test/photo.jpg' }));
});

test('the app owns no photo acquisition — only the package does', async () => {
  const offenders = [];
  for (const path of await srcFiles('src')) {
    const source = await readFile(path, 'utf8');
    if (!source.includes('react-native-vision-camera')) continue;
    // QR/barcode scanning was deliberately left app-side in Phase 3; photo
    // acquisition was not.
    if (path.endsWith('QrScanner.js')) continue;
    offenders.push(path);
  }
  assert.deepEqual(offenders, [], 'photo acquisition must live in gather-components/camera');
});

test('the camera folder in src/ holds only app-specific scanning', async () => {
  const entries = await readdir('src/components/camera');
  assert.deepEqual(entries.sort(), ['QrScanner.js']);
});
