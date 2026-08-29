import test from 'node:test';
import assert from 'node:assert/strict';

import { binaryMask, rankedLabels, rgbToTensor } from '../../src/scientific/runtime/modelTransforms.js';

test('RGB preprocessing creates normalized NCHW tensors', () => {
  const tensor = rgbToTensor({
    pixels: new Uint8Array([255, 128, 0]),
    width: 1,
    height: 1,
    steps: [{ operation: 'scale', divisor: 255 }],
    inputShape: [1, 3, 1, 1],
  });
  assert.equal(tensor[0], 1);
  assert.ok(Math.abs(tensor[1] - 128 / 255) < 1e-7);
  assert.equal(tensor[2], 0);
});

test('binary segmentation and ranked classification postprocessing are deterministic', () => {
  assert.deepEqual(Array.from(binaryMask({ values: [0.49, 0.5], threshold: 0.5, width: 2, height: 1 })), [0, 255]);
  const ranked = rankedLabels({ logits: [0, 2, 1], labels: ['zero', 'two', 'one'], count: 2 });
  assert.deepEqual(ranked.map((item) => item.label), ['two', 'one']);
  assert.ok(ranked[0].score > ranked[1].score);
});
