import { ScientificContractError } from '../contracts.js';
import { createScientificModelRef } from './modelPackage.js';

/**
 * Resolves an immutable package before requesting source bytes. Source-specific
 * installers are injected so bundle, Central, and future registry sources all
 * retain the same Model Store behavior.
 */
export const ensureModelAvailable = async ({ modelStore, projectKey, modelPackage, install }) => {
  if (!modelStore || typeof modelStore.resolve !== 'function' || typeof install !== 'function') {
    throw new ScientificContractError('Model availability requires a store and installer.');
  }
  const modelRef = createScientificModelRef(modelPackage);
  try {
    return await modelStore.resolve({ projectKey, modelRef });
  } catch (error) {
    if (error?.code !== 'GATHER_MODEL_UNAVAILABLE') throw error;
    return install();
  }
};
