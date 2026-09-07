import test from 'node:test';
import assert from 'node:assert/strict';

import { ProvenanceError, createExecutionReceipt } from '../../src/provenance/receipt.js';
import { createImageAsset } from '../../src/media/assetContracts.js';

// Provenance is capability-generic, which an authored composition proved: it
// mints a receipt with no model in the picture at all.

const digest = `sha256:${'a'.repeat(64)}`;
const image = createImageAsset({
  assetId: 'image-1',
  uri: 'file:///documents/image.jpg',
  path: '/documents/image.jpg',
  width: 100,
  height: 80,
  sha256: digest,
});

test('a receipt carries only serializable provenance', () => {
  const receipt = createExecutionReceipt({
    capability: 'image.segment',
    capabilityRevision: 'sha256:capability',
    model: { id: 'u2netp', version: '1.0.0', revision: digest },
    inputs: { image: image.sha256 },
    outputs: { mask: digest },
    runtime: { onnxruntime: '1.24.3' },
    timestamp: '2026-08-29T00:00:00.000Z',
  });
  assert.match(receipt.revision, /^sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(receipt), /Tensor|InferenceSession|Mat|Frame/);
});

test('a receipt needs no model — a composition is a producer too', () => {
  const receipt = createExecutionReceipt({
    capability: 'authored_photo_v1',
    capabilityRevision: '1.0.0',
    inputs: {},
    outputs: { note: 'authored' },
    runtime: { kind: 'composition', surfaceId: 'authored-photo' },
    timestamp: '2026-09-02T00:00:00.000Z',
  });
  assert.equal(receipt.model, null);
  assert.match(receipt.revision, /^sha256:[a-f0-9]{64}$/);
});

test('a receipt missing its capability is a provenance failure, not a hashing one', () => {
  assert.throws(
    () =>
      createExecutionReceipt({
        capability: '',
        capabilityRevision: 'r',
        inputs: {},
        outputs: {},
        runtime: {},
        timestamp: 't',
      }),
    ProvenanceError
  );
});
