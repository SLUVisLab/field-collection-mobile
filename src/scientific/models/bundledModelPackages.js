import { TASK_PROFILES } from './modelPackage.js';

const hash = (value) => `sha256:${value}`;

export const BUNDLED_MODEL_PACKAGES = Object.freeze({
  u2netp: {
    identity: { id: 'u2netp-salient-segmentation', version: '1.0.0' },
    taskProfile: TASK_PROFILES.segmentationBinary,
    artifact: {
      path: 'bundle/u2netp.onnx',
      sha256: hash('571926ae339d435a039712e7a0cf15798ae29a078cae4a56d090693b47d9c31e'),
    },
    tensor: {
      inputName: 'image',
      inputShape: [1, 3, 320, 320],
      outputNames: ['saliency'],
      layout: 'NCHW',
    },
    upstream: {
      project: 'xuebinqin/U-2-Net',
      revision: 'ac7e1c817ecab7c7dff5ce6b1abba61cd213ff29',
      model: 'u2netp',
      license: 'Apache-2.0',
      sourceWeightsSha256: hash('e7567cde013fb64813973ce6e1ecc25a80c05c3ca7adbc5a54f3c3d90991b854'),
    },
    conversion: {
      exporter: 'experiments/m8-model-export/export_reference_models.py',
      exporterSha256: hash('3418a8440b2787bc2231056f4a50e863acb6e1c3090538a5405c8326dc858c7f'),
      torch: '2.13.0',
      onnx: '1.22.0',
      opset: 17,
      primaryOutput: 0,
    },
    preprocessing: [
      { operation: 'resize', width: 320, height: 320, mode: 'bilinear' },
      { operation: 'colorConvert', from: 'RGB', to: 'RGB' },
      { operation: 'scale', divisor: 255 },
      { operation: 'tensorLayout', layout: 'NCHW' },
    ],
    postprocessing: [
      { operation: 'threshold', value: 0.5 },
      { operation: 'binaryMask', foreground: 255, background: 0 },
      { operation: 'restoreSourceSize', mode: 'nearest' },
    ],
  },
  mobilenetV3Large: {
    identity: { id: 'mobilenet-v3-large-imagenet1k-v2', version: '1.0.0' },
    taskProfile: TASK_PROFILES.classificationRanked,
    artifact: {
      path: 'bundle/mobilenet-v3-large-imagenet1k-v2.onnx',
      sha256: hash('b15d8e4946ad08687f928376445f7e19af1f5d98a1525c4ab1d2d7e4ebbc3356'),
    },
    tensor: {
      inputName: 'image',
      inputShape: [1, 3, 224, 224],
      outputNames: ['logits'],
      layout: 'NCHW',
    },
    upstream: {
      project: 'pytorch/vision',
      revision: '8fb87713a24951e639c494b0f2a8a81b5f8e33a6',
      model: 'MobileNet_V3_Large_Weights.IMAGENET1K_V2',
      license: 'BSD-3-Clause',
      sourceWeightsSha256: hash('5c1a416349c4cf298f2a6a5e2600ed0ee55e604713578f5e74e6bc8bcaef7997'),
    },
    conversion: {
      exporter: 'experiments/m8-model-export/export_reference_models.py',
      exporterSha256: hash('3418a8440b2787bc2231056f4a50e863acb6e1c3090538a5405c8326dc858c7f'),
      torch: '2.13.0',
      torchvision: '0.28.0',
      onnx: '1.22.0',
      opset: 17,
    },
    labels: {
      path: 'bundle/imagenet-1k-labels.txt',
      sha256: hash('e697a491aa735cc6c2aaf982f8e86e8fc7b0a1ea7750a2cc6a2bdfc1e109012f'),
    },
    preprocessing: [
      { operation: 'resize', shortestSide: 232, mode: 'bilinear' },
      { operation: 'crop', width: 224, height: 224, mode: 'center' },
      { operation: 'colorConvert', from: 'RGB', to: 'RGB' },
      { operation: 'scale', divisor: 255 },
      { operation: 'normalize', mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
      { operation: 'tensorLayout', layout: 'NCHW' },
    ],
    postprocessing: [{ operation: 'softmax' }, { operation: 'topK', count: 5 }],
  },
});
