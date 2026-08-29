import { canonicalJson, ScientificContractError, sha256For } from '../contracts.js';
import {
  createScientificModelRef,
  modelRevisionFor,
  validateScientificModelPackage,
} from './modelPackage.js';

const revisionSegment = (revision) => {
  if (typeof revision !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(revision)) {
    throw new ScientificContractError('Model revision must be a SHA-256 digest.');
  }
  return revision.slice('sha256:'.length);
};

const modelKey = (projectKey, revision, filename) => {
  if (typeof projectKey !== 'string' || !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(projectKey)) {
    throw new ScientificContractError('Model Store requires a valid project key.');
  }
  return `projects/${projectKey}/models/${revisionSegment(revision)}${filename ? `/${filename}` : ''}`;
};

const requireDependencies = (deps) => {
  for (const name of ['readBytes', 'writeBytesAtomic', 'writeTextAtomic', 'fileExists', 'fileForKey']) {
    if (typeof deps[name] !== 'function') {
      throw new ScientificContractError(`Model Store requires ${name}.`);
    }
  }
};

const keysFor = ({ projectKey, revision }) => {
  return {
    descriptor: modelKey(projectKey, revision, 'model.json'),
    lock: modelKey(projectKey, revision, 'model.lock.json'),
    artifact: modelKey(projectKey, revision, 'model.onnx'),
    labels: modelKey(projectKey, revision, 'labels.txt'),
    base: modelKey(projectKey, revision),
  };
};

/**
 * Device-side immutable model installation. Bundled and future downloaded
 * packages pass the same descriptor and artifact bytes through this boundary.
 */
export const createModelStore = (deps) => {
  requireDependencies(deps);
  const verifiedRevisions = new Set();

  const verifyInstalledPackage = async ({ keys, descriptor, revision }) => {
    if (verifiedRevisions.has(revision)) return;
    const lock = JSON.parse(await deps.readText(keys.lock));
    if (
      lock?.revision !== revision ||
      lock.artifactSha256 !== descriptor.artifact.sha256 ||
      lock.labelsSha256 !== (descriptor.labels?.sha256 ?? null)
    ) {
      throw new ScientificContractError('Installed model lock does not match its descriptor.', {
        code: 'GATHER_MODEL_LOCK_MISMATCH',
      });
    }
    if (sha256For(await deps.readBytes(keys.artifact)) !== descriptor.artifact.sha256) {
      throw new ScientificContractError('Installed model artifact does not match its package.', {
        code: 'GATHER_MODEL_HASH_MISMATCH',
      });
    }
    if (
      descriptor.labels &&
      (!(await deps.fileExists(keys.labels)) || sha256For(await deps.readBytes(keys.labels)) !== descriptor.labels.sha256)
    ) {
      throw new ScientificContractError('Installed model labels do not match their package.', {
        code: 'GATHER_MODEL_HASH_MISMATCH',
      });
    }
    verifiedRevisions.add(revision);
  };

  return {
    async install({ projectKey, modelPackage, artifactBytes, labelBytes = null } = {}) {
      validateScientificModelPackage(modelPackage);
      if (!(artifactBytes instanceof Uint8Array) || artifactBytes.byteLength === 0) {
        throw new ScientificContractError('Model artifact bytes are required.');
      }
      const revision = modelRevisionFor(modelPackage);
      const keys = keysFor({ projectKey, revision });
      const expectedArtifactDigest = modelPackage.artifact.sha256;
      if (sha256For(artifactBytes) !== expectedArtifactDigest) {
        throw new ScientificContractError('Model artifact SHA-256 does not match its package.', {
          code: 'GATHER_MODEL_HASH_MISMATCH',
        });
      }
      if (modelPackage.labels) {
        if (!(labelBytes instanceof Uint8Array) || labelBytes.byteLength === 0) {
          throw new ScientificContractError('Classification labels bytes are required.');
        }
        if (sha256For(labelBytes) !== modelPackage.labels.sha256) {
          throw new ScientificContractError('Model labels SHA-256 does not match its package.', {
            code: 'GATHER_MODEL_HASH_MISMATCH',
          });
        }
      }

      if (!(await deps.fileExists(keys.lock))) {
        await deps.writeBytesAtomic(keys.artifact, artifactBytes);
        if (modelPackage.labels) await deps.writeBytesAtomic(keys.labels, labelBytes);
        await deps.writeTextAtomic(keys.descriptor, canonicalJson(modelPackage));
        await deps.writeTextAtomic(
          keys.lock,
          canonicalJson({
            revision,
            artifactSha256: expectedArtifactDigest,
            labelsSha256: modelPackage.labels?.sha256 ?? null,
          })
        );
      }
      verifiedRevisions.delete(revision);
      return this.resolve({ projectKey, modelRef: createScientificModelRef(modelPackage) });
    },

    async resolve({ projectKey, modelRef } = {}) {
      const revision = revisionSegment(modelRef?.revision);
      const keys = keysFor({ projectKey, revision: `sha256:${revision}` });
      if (
        !(await deps.fileExists(keys.lock)) ||
        !(await deps.fileExists(keys.descriptor)) ||
        !(await deps.fileExists(keys.artifact))
      ) {
        throw new ScientificContractError('The required model is not installed on this device.', {
          code: 'GATHER_MODEL_UNAVAILABLE',
        });
      }
      const descriptor = JSON.parse(await deps.readText(keys.descriptor));
      validateScientificModelPackage(descriptor);
      if (modelRevisionFor(descriptor) !== modelRef.revision) {
        throw new ScientificContractError('Installed model descriptor revision does not match its lock.', {
          code: 'GATHER_MODEL_LOCK_MISMATCH',
        });
      }
      await verifyInstalledPackage({ keys, descriptor, revision: modelRef.revision });
      const artifact = deps.fileForKey(keys.artifact);
      return {
        model: descriptor,
        modelRef: createScientificModelRef(descriptor),
        artifactPath: artifact.uri ?? artifact.path,
        labelsPath: descriptor.labels ? (deps.fileForKey(keys.labels).uri ?? deps.fileForKey(keys.labels).path) : null,
        labelsKey: descriptor.labels ? keys.labels : null,
        keys,
      };
    },
  };
};
