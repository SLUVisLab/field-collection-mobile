import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageAsset, createMaskAsset } from '../../src/scientific/contracts.js';
import { createScientificModelRef, TASK_PROFILES } from '../../src/scientific/models/modelPackage.js';
import {
  IMAGE_TASK_PROFILES,
  ImageAssetSchema,
  MaskAssetSchema,
  ModelRefSchema,
} from '../../packages/gather-capabilities/src/contracts.js';

/**
 * Cross-runtime contract parity.
 *
 * The app constructs these values (`src/scientific/contracts.js`) while
 * `gather-capabilities` declares them as zod schemas that nothing parses at
 * runtime. That duplication is deliberate for now — see
 * docs/contract-ownership-audit.md — so these tests exist to make drift **fail
 * loudly** without committing to a dependency direction.
 *
 * Scope note: parity is about **shape and meaning**, never the locator.
 * `uri` is a runtime-local renderable reference (`file://` on device,
 * `blob:`/`data:` on web), so nothing here asserts a URI scheme or cross-runtime
 * equality of `uri`. That difference is intended, not a defect.
 */

const digest = (character) => `sha256:${character.repeat(64)}`;

test('a constructed ImageAsset satisfies the advertised ImageAssetSchema', () => {
  const asset = createImageAsset({
    assetId: 'image-1',
    uri: 'file:///var/mobile/photo.jpg',
    path: 'projects/p/media/photo.jpg',
    width: 960,
    height: 640,
    mimeType: 'image/jpeg',
    sha256: digest('a'),
    capturedAt: '2026-09-01T00:00:00.000Z',
  });

  const parsed = ImageAssetSchema.safeParse(asset);
  assert.ok(parsed.success, parsed.error && JSON.stringify(parsed.error.issues));
});

test('a constructed ImageAsset satisfies the schema regardless of URI scheme', () => {
  // Same shape, different runtime-local locators: both must satisfy the contract.
  for (const uri of ['file:///var/mobile/photo.jpg', 'blob:https://example.test/abc', 'data:image/jpeg;base64,AA']) {
    const asset = createImageAsset({
      assetId: 'image-1',
      uri,
      path: 'projects/p/media/photo.jpg',
      width: 4,
      height: 3,
      sha256: digest('a'),
    });
    assert.ok(ImageAssetSchema.safeParse(asset).success, `rejected locator: ${uri}`);
  }
});

test('a constructed MaskAsset satisfies the advertised MaskAssetSchema', () => {
  const mask = createMaskAsset({
    assetId: 'mask-1',
    uri: 'file:///var/mobile/mask.png',
    path: 'projects/p/media/mask.png',
    width: 960,
    height: 640,
    sha256: digest('b'),
    sourceImageAssetId: 'image-1',
  });

  const parsed = MaskAssetSchema.safeParse(mask);
  assert.ok(parsed.success, parsed.error && JSON.stringify(parsed.error.issues));
  // `format` defaults in the constructor and is required by the schema — the
  // exact drift that made the renderer's fixture mask invalid.
  assert.equal(mask.format, 'binary-png');
});

test('a constructed ModelRef satisfies the advertised ModelRefSchema', () => {
  const modelPackage = {
    identity: { id: 'u2netp', version: '1' },
    artifact: { path: '/model.onnx', sha256: digest('c') },
    tensor: { inputName: 'input', inputShape: [1, 3, 1, 1], outputNames: ['output'] },
    upstream: { project: 'source', revision: 'pin' },
    preprocessing: [{ operation: 'resize', width: 1, height: 1 }],
    postprocessing: [{ operation: 'binaryMask' }],
    taskProfile: TASK_PROFILES.segmentationBinary,
  };

  const modelRef = createScientificModelRef(modelPackage);
  const parsed = ModelRefSchema.safeParse(modelRef);
  assert.ok(parsed.success, parsed.error && JSON.stringify(parsed.error.issues));
});

test('the app and the capability package agree on the task-profile vocabulary', () => {
  // Independently defined on both sides of the package boundary. Divergence
  // would make correct models silently unusable, so assert it directly.
  assert.deepEqual(TASK_PROFILES, IMAGE_TASK_PROFILES);
});
