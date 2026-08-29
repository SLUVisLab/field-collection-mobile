import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalJson,
  createImageAsset,
  createMaskAsset,
  revisionFor,
  ScientificContractError,
} from '../../src/scientific/contracts.js';
import {
  createScientificModelRef,
  TASK_PROFILES,
  validateScientificModelPackage,
} from '../../src/scientific/models/modelPackage.js';
import { createExecutionReceipt } from '../../src/scientific/provenance/receipt.js';

const digest = `sha256:${'a'.repeat(64)}`;
const image = createImageAsset({
  assetId: 'image-1',
  uri: 'file:///documents/image.jpg',
  path: '/documents/image.jpg',
  width: 100,
  height: 80,
  sha256: digest,
});

const segmentationPackage = {
  identity: { id: 'u2netp', version: '1.0.0' },
  taskProfile: TASK_PROFILES.segmentationBinary,
  artifact: { path: 'models/u2netp.onnx', sha256: digest },
  tensor: { inputName: 'input', inputShape: [1, 3, 320, 320], outputNames: ['output'] },
  upstream: { project: 'U-2-Net', revision: 'pinned', license: 'Apache-2.0' },
  preprocessing: [{ operation: 'resize', width: 320, height: 320 }, { operation: 'tensorLayout', layout: 'NCHW' }],
  postprocessing: [{ operation: 'sigmoid' }, { operation: 'threshold', value: 0.5 }, { operation: 'binaryMask' }],
};

test('scientific assets are serializable and require durable identity and digest', () => {
  assert.deepEqual(image, { ...image });
  assert.equal(image.sha256, digest);
  assert.throws(() => createImageAsset({ ...image, sha256: 'bad' }), ScientificContractError);
  assert.equal(createMaskAsset({
    assetId: 'mask-1', uri: 'file:///documents/mask.png', path: '/documents/mask.png',
    width: 100, height: 80, sha256: digest, sourceImageAssetId: image.assetId,
  }).sourceImageAssetId, image.assetId);
});

test('canonical scientific revisions are key-order stable', () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
  assert.equal(revisionFor({ b: 2, a: 1 }), revisionFor({ a: 1, b: 2 }));
});

test('model packages use constrained task profiles and deterministic revisions', () => {
  assert.equal(validateScientificModelPackage(segmentationPackage), segmentationPackage);
  const reference = createScientificModelRef(segmentationPackage);
  assert.equal(reference.id, 'u2netp');
  assert.match(reference.revision, /^sha256:[a-f0-9]{64}$/);
  assert.throws(() => validateScientificModelPackage({ ...segmentationPackage, taskProfile: 'anything.execute.v1' }), ScientificContractError);
});

test('execution receipts capture only serializable capability provenance', () => {
  const receipt = createExecutionReceipt({
    capability: 'vision.segment',
    capabilityRevision: 'sha256:capability',
    model: createScientificModelRef(segmentationPackage),
    inputs: { image: image.sha256 },
    outputs: { mask: digest },
    runtime: { onnxruntime: '1.24.3' },
    timestamp: '2026-08-29T00:00:00.000Z',
  });
  assert.match(receipt.revision, /^sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(receipt), /Tensor|InferenceSession|Mat|Frame/);
});
