import test from 'node:test';
import assert from 'node:assert/strict';

import { classify, segment } from '../../src/capabilities/vision/index.js';
import { TASK_PROFILES } from '../../src/scientific/models/modelPackage.js';

const digest = `sha256:${'c'.repeat(64)}`;
const image = { assetId: 'image', uri: 'file:///image', path: '/image', width: 10, height: 10, mimeType: 'image/jpeg', sha256: digest, orientation: null, capturedAt: null };
const baseModel = {
  identity: { id: 'model', version: '1' },
  artifact: { path: '/model.onnx', sha256: digest },
  tensor: { inputName: 'input', inputShape: [1, 3, 1, 1], outputNames: ['output'] },
  upstream: { project: 'source', revision: 'pin' },
  preprocessing: [{ operation: 'resize', width: 1, height: 1 }],
};
const segmentationModel = { ...baseModel, taskProfile: TASK_PROFILES.segmentationBinary, postprocessing: [{ operation: 'binaryMask' }] };
const classificationModel = {
  ...baseModel, taskProfile: TASK_PROFILES.classificationRanked,
  postprocessing: [{ operation: 'topK', count: 3 }],
  labels: { path: '/labels.txt', sha256: digest },
};

test('vision capabilities expose only semantic serializable results', async () => {
  const segmentation = await segment({
    image, model: segmentationModel,
    execute: async () => ({
      mask: { assetId: 'mask', sha256: digest },
      threshold: 0.5,
      performance: { elapsedMs: 1, phases: [] },
    }),
  });
  assert.equal(segmentation.mask.assetId, 'mask');
  assert.equal(segmentation.performance.elapsedMs, 1);
  const classification = await classify({
    image, model: classificationModel,
    execute: async () => ({ ranked: [{ label: 'specimen', score: 0.8 }] }),
  });
  assert.deepEqual(classification.ranked, [{ label: 'specimen', score: 0.8 }]);
  assert.doesNotMatch(JSON.stringify({ segmentation, classification }), /Tensor|InferenceSession|Mat|Frame/);
});
