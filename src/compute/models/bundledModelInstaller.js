import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import { bundledModelFor } from './bundledModels.js';
import { ensureModelAvailable } from 'gather-models';

const bytesFor = async (resource) => {
  const [asset] = await Asset.loadAsync(resource);
  if (!asset?.localUri) throw new Error('Bundled model resource is unavailable.');
  return new File(asset.localUri).bytes();
};

export const installBundledModel = async ({ modelStore, projectKey, name }) => {
  const declared = bundledModelFor(name);
  if (!declared) throw new Error(`Unknown bundled model "${name}".`);
  return modelStore.install({
    projectKey,
    modelPackage: declared.modelPackage,
    artifactBytes: await bytesFor(declared.resources.artifact()),
    labelBytes: declared.resources.labels ? await bytesFor(declared.resources.labels()) : null,
  });
};

/**
 * The immutable Model Store is the source of truth after first installation.
 * Avoid loading and hashing bundled multi-megabyte resources on every run.
 */
export const ensureBundledModel = async ({ modelStore, projectKey, name }) => {
  const declared = bundledModelFor(name);
  if (!declared) throw new Error(`Unknown bundled model "${name}".`);
  return ensureModelAvailable({
    modelStore,
    projectKey,
    modelPackage: declared.modelPackage,
    install: () => installBundledModel({ modelStore, projectKey, name }),
  });
};
