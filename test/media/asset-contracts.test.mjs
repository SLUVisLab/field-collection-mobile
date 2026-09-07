import test from 'node:test';
import assert from 'node:assert/strict';

import { MediaAssetError, createImageAsset, createMaskAsset } from '../../src/media/assetContracts.js';

// Media contracts, with a media error. They previously shared one error type
// with model validation, canonicalization and OpenCV failures, so no `catch`
// could tell a bad digest from a bad model package.

const digest = `sha256:${'a'.repeat(64)}`;

const image = createImageAsset({
  assetId: 'image-1',
  uri: 'file:///documents/image.jpg',
  path: '/documents/image.jpg',
  width: 100,
  height: 80,
  sha256: digest,
});

test('an asset is serializable and needs durable identity and a digest', () => {
  assert.deepEqual(image, { ...image });
  assert.equal(image.sha256, digest);
  assert.throws(() => createImageAsset({ ...image, sha256: 'bad' }), MediaAssetError);
  assert.throws(() => createImageAsset({ ...image, assetId: '' }), MediaAssetError);
  assert.throws(() => createImageAsset({ ...image, width: 0 }), MediaAssetError);
});

test('a bare digest is accepted and normalized to its sha256: form', () => {
  assert.equal(createImageAsset({ ...image, sha256: 'a'.repeat(64) }).sha256, digest);
});

test('a mask names the image it came from', () => {
  const mask = createMaskAsset({
    assetId: 'mask-1',
    uri: 'file:///documents/mask.png',
    path: '/documents/mask.png',
    width: 100,
    height: 80,
    sha256: digest,
    sourceImageAssetId: image.assetId,
  });
  assert.equal(mask.sourceImageAssetId, image.assetId);
  assert.equal(mask.format, 'binary-png');
  assert.throws(() => createMaskAsset({ ...mask, sourceImageAssetId: '' }), MediaAssetError);
});
