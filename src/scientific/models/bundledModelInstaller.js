import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import { BUNDLED_MODEL_PACKAGES } from './bundledModelPackages.js';
import { ensureModelAvailable } from './modelAvailability.js';

const bundledResources = Object.freeze({
  u2netp: { artifact: require('../../../assets/scientific/models/u2netp.onnx') },
  mobilenetV3Large: {
    artifact: require('../../../assets/scientific/models/mobilenet-v3-large-imagenet1k-v2.onnx'),
    labels: require('../../../assets/scientific/models/imagenet-1k-labels.txt'),
  },
});

const bytesFor = async (resource) => {
  const [asset] = await Asset.loadAsync(resource);
  if (!asset?.localUri) throw new Error('Bundled model resource is unavailable.');
  return new File(asset.localUri).bytes();
};

export const installBundledModel = async ({ modelStore, projectKey, name }) => {
  const modelPackage = BUNDLED_MODEL_PACKAGES[name];
  const resources = bundledResources[name];
  if (!modelPackage || !resources) throw new Error(`Unknown bundled model "${name}".`);
  return modelStore.install({
    projectKey,
    modelPackage,
    artifactBytes: await bytesFor(resources.artifact),
    labelBytes: resources.labels ? await bytesFor(resources.labels) : null,
  });
};

/**
 * The immutable Model Store is the source of truth after first installation.
 * Avoid loading and hashing bundled multi-megabyte resources on every run.
 */
export const ensureBundledModel = async ({ modelStore, projectKey, name }) => {
  const modelPackage = BUNDLED_MODEL_PACKAGES[name];
  if (!modelPackage || !bundledResources[name]) throw new Error(`Unknown bundled model "${name}".`);
  return ensureModelAvailable({
    modelStore,
    projectKey,
    modelPackage,
    install: () => installBundledModel({ modelStore, projectKey, name }),
  });
};
