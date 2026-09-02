import assert from 'node:assert/strict';
import test from 'node:test';

import { segment } from '../src/image/segment/implementation.js';
import { classify } from '../src/image/classify/implementation.js';
import { IMAGE_TASK_PROFILES } from '../src/contracts.js';

const image = { assetId: 'image-1', path: 'img.jpg' };
const segRef = { id: 'u2netp', version: '1', revision: 'sha256:x', taskProfile: IMAGE_TASK_PROFILES.segmentationBinary };
const clsRef = { id: 'mnet', version: '1', revision: 'sha256:x', taskProfile: IMAGE_TASK_PROFILES.classificationRanked };

test('image.segment runs the injected engine and shapes a serializable result', async () => {
  const mask = { assetId: 'mask-1', path: 'm.png', width: 1, height: 1 };
  const result = await segment({
    image,
    model: { opaque: true },
    modelRef: segRef,
    execute: async ({ image: img, model }) => {
      assert.equal(img, image);
      assert.deepEqual(model, { opaque: true });
      return { mask, threshold: 0.5, receipt: { r: 1 } };
    },
  });
  assert.equal(result.model, segRef, 'echoes the app-computed model ref for provenance');
  assert.equal(result.mask, mask);
  assert.equal(result.threshold, 0.5);
  assert.deepEqual(result.receipt, { r: 1 });
  assert.equal(result.performance, null);
});

test('image.segment enforces input, profile, engine, and result contracts', async () => {
  await assert.rejects(() => segment({ image: {}, modelRef: segRef, execute: async () => ({}) }), /ImageAsset/);
  await assert.rejects(() => segment({ image, modelRef: clsRef, execute: async () => ({}) }), /segmentation\.binary/);
  await assert.rejects(() => segment({ image, modelRef: segRef, execute: null }), /runtime is unavailable/);
  await assert.rejects(() => segment({ image, modelRef: segRef, execute: async () => ({}) }), /did not produce a mask/);
});

test('image.classify runs the injected engine and normalizes ranked labels', async () => {
  const result = await classify({
    image,
    modelRef: clsRef,
    execute: async () => ({ ranked: [{ label: 'a', score: 0.9, extra: 1 }, { label: 'b', score: 0.1 }] }),
  });
  assert.equal(result.model, clsRef);
  assert.deepEqual(result.ranked, [{ label: 'a', score: 0.9 }, { label: 'b', score: 0.1 }]);
});

test('image.classify rejects malformed ranked output', async () => {
  await assert.rejects(
    () => classify({ image, modelRef: clsRef, execute: async () => ({ ranked: [{ label: 'a' }] }) }),
    /ranked labels/,
  );
});

// Ported from the retired app-side vision test: the public result must stay
// serializable, with no native runtime type leaking across the capability
// boundary (ONNX Tensor/InferenceSession, OpenCV Mat, VisionCamera Frame).
test('image capability results carry no native runtime objects', async () => {
  const segmentation = await segment({
    image,
    modelRef: segRef,
    execute: async () => ({
      mask: { assetId: 'mask-1', path: 'm.png', width: 1, height: 1 },
      threshold: 0.5,
      performance: { elapsedMs: 1, phases: [] },
    }),
  });
  const classification = await classify({
    image,
    modelRef: clsRef,
    execute: async () => ({ ranked: [{ label: 'specimen', score: 0.8 }] }),
  });

  assert.doesNotMatch(
    JSON.stringify({ segmentation, classification }),
    /Tensor|InferenceSession|Mat|Frame/,
  );
  assert.doesNotThrow(() => structuredClone({ segmentation, classification }));
});
