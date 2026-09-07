import { BUNDLED_MODEL_PACKAGES } from './bundledModelPackages.js';

/**
 * **What this Gather distribution can provide.**
 *
 * One declaration per model this build ships: its `ModelPackage` and the app
 * resources its bytes come from. Package metadata and byte source were two
 * parallel maps keyed by the same short names, which could drift silently —
 * adding a model meant editing both and hoping.
 *
 * This is the answer to *"what may an author choose?"*, and it is deliberately
 * distinct from `modelStore.listInstalled()`, which answers *"what does this
 * device have right now?"*. Models install lazily on first use, so a model this
 * build guarantees is choosable long before it is installed. The Composer needs
 * the first question; cleanup and diagnostics need the second.
 *
 * `require` handles are resolved lazily by the installer — declaring them here
 * does not load megabytes of ONNX at import time.
 *
 * Nothing here belongs in `gather-models`: the package understands what a model
 * *is*; which models a particular build ships is app policy.
 */
export const BUNDLED_MODELS = Object.freeze([
  Object.freeze({
    name: 'u2netp',
    displayName: 'U²-Net (portable) salient segmentation',
    modelPackage: BUNDLED_MODEL_PACKAGES.u2netp,
    resources: Object.freeze({
      artifact: () => require('../../../assets/models/u2netp.onnx'),
    }),
  }),
  Object.freeze({
    name: 'mobilenetV3Large',
    displayName: 'MobileNetV3-Large ImageNet-1k classification',
    modelPackage: BUNDLED_MODEL_PACKAGES.mobilenetV3Large,
    resources: Object.freeze({
      artifact: () => require('../../../assets/models/mobilenet-v3-large-imagenet1k-v2.onnx'),
      labels: () => require('../../../assets/models/imagenet-1k-labels.txt'),
    }),
  }),
]);

/** Declarations keyed by their short app-facing name. */
export const bundledModelsByName = Object.freeze(
  Object.fromEntries(BUNDLED_MODELS.map((entry) => [entry.name, entry]))
);

export const bundledModelFor = (name) => bundledModelsByName[name] ?? null;
