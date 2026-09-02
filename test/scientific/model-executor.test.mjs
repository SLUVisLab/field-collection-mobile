import test from 'node:test';
import assert from 'node:assert/strict';

import { createModelExecutor } from '../../src/scientific/runtime/modelExecutor.js';
import { TASK_PROFILES } from '../../src/scientific/models/modelPackage.js';

const image = {
  assetId: 'image-1',
  path: 'images/source.jpg',
  uri: 'file://images/source.jpg',
  width: 2,
  height: 2,
  sha256: 'sha256:d'.padEnd(71, 'd'),
};
const segmentationModel = {
  identity: { id: 'segmenter', version: '1' },
  taskProfile: TASK_PROFILES.segmentationBinary,
  artifact: { path: 'bundle/segmenter.onnx', sha256: 'sha256:a'.padEnd(71, 'a') },
  tensor: { inputName: 'image', inputShape: [1, 3, 2, 2], outputNames: ['mask'] },
  preprocessing: [{ operation: 'resize', width: 2, height: 2 }, { operation: 'scale', divisor: 255 }],
  postprocessing: [{ operation: 'sigmoid' }, { operation: 'threshold', value: 0.5 }, { operation: 'binaryMask' }],
  upstream: { project: 'test', revision: '1' },
};
const classificationModel = {
  identity: { id: 'classifier', version: '1' },
  taskProfile: TASK_PROFILES.classificationRanked,
  artifact: { path: 'bundle/classifier.onnx', sha256: 'sha256:b'.padEnd(71, 'b') },
  tensor: { inputName: 'image', inputShape: [1, 3, 2, 2], outputNames: ['logits'] },
  preprocessing: [{ operation: 'resize', width: 2, height: 2 }, { operation: 'scale', divisor: 255 }],
  postprocessing: [{ operation: 'topK', count: 2 }],
  labels: { path: 'labels.txt', sha256: 'sha256:c'.padEnd(71, 'c') },
  upstream: { project: 'test', revision: '1' },
};

const executorFor = ({ output, labels = null }) => {
  const writes = new Map();
  return createModelExecutor({
    modelStore: {
      resolve: async () => ({
        artifactPath: 'file:///models/model.onnx',
        labelsPath: labels ? 'file:///models/labels.txt' : null,
        labelsKey: labels ? 'models/labels.txt' : null,
      }),
    },
    onnxRuntime: { run: async () => output },
    imageAdapter: {
      decodeResizeRgb: async () => ({ width: 2, height: 2, pixels: new Uint8Array(12).fill(255) }),
      resizeMask: ({ pixels }) => pixels,
      writeBinaryMaskPng: ({ uri }) => writes.set(uri.replace('file://', ''), new Uint8Array([1, 2, 3])),
    },
    files: {
      fileForKey: (path) => ({ uri: `file://${path}` }),
      readBytes: async (path) => writes.get(path),
      readText: async () => labels,
    },
    newAssetId: () => 'mask-1',
  });
};

test('model executor materializes a durable typed segmentation mask', async () => {
  const executor = executorFor({ output: { mask: { data: [10, -10, 10, -10] } } });
  const result = await executor.segment({ projectKey: 'project-a', image, model: segmentationModel });
  assert.equal(result.threshold, 0.5);
  assert.equal(result.mask.path, 'projects/project-a/media/mask-1-mask.png');
  assert.equal(result.mask.sourceImageAssetId, image.assetId);
  assert.equal(result.receipt.capability, 'image.segment');
  assert.ok(result.performance.phases.some((phase) => phase.name === 'modelStoreResolve'));
  assert.ok(result.performance.phases.some((phase) => phase.name === 'pixelNormalizeTensor'));
});

test('segmentation does not re-apply sigmoid when the model already outputs probabilities', async () => {
  let maskPixels;
  const executor = createModelExecutor({
    modelStore: { resolve: async () => ({ artifactPath: 'file:///models/model.onnx' }) },
    onnxRuntime: { run: async () => ({ mask: { data: [0.9, 0.1, 0.9, 0.1] } }) },
    imageAdapter: {
      decodeResizeRgb: async () => ({ width: 2, height: 2, pixels: new Uint8Array(12).fill(255) }),
      resizeMask: ({ pixels }) => {
        maskPixels = Array.from(pixels);
        return pixels;
      },
      writeBinaryMaskPng: () => {},
    },
    files: {
      fileForKey: (path) => ({ uri: `file://${path}` }),
      readBytes: async () => new Uint8Array([1, 2, 3]),
    },
    newAssetId: () => 'mask-1',
  });
  const probabilityModel = {
    ...segmentationModel,
    postprocessing: [{ operation: 'threshold', value: 0.5 }, { operation: 'binaryMask' }],
  };
  await executor.segment({ projectKey: 'project-a', image, model: probabilityModel });
  assert.deepEqual(maskPixels, [255, 0, 255, 0]);
});

test('model executor resolves labels and returns ranked typed classifications', async () => {
  const executor = executorFor({
    output: { logits: { data: [1, 4, 2] } },
    labels: 'one\ntwo\nthree\n',
  });
  const result = await executor.classify({ projectKey: 'project-a', image, model: classificationModel });
  assert.deepEqual(result.ranked.map((item) => item.label), ['two', 'three']);
  assert.equal(result.receipt.capability, 'image.classify');
  assert.ok(result.performance.phases.some((phase) => phase.name === 'labelsRead'));
});
