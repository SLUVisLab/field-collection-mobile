import { ModelError } from './errors.js';
import { canonicalize, digestBytes } from 'gather-hashing';
import {
  createModelRef,
  modelRevisionFor,
  validateModelPackage,
} from './modelPackage.js';

const revisionSegment = (revision) => {
  if (typeof revision !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(revision)) {
    throw new ModelError('Model revision must be a SHA-256 digest.');
  }
  return revision.slice('sha256:'.length);
};

const modelKey = (projectKey, revision, filename) => {
  if (typeof projectKey !== 'string' || !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(projectKey)) {
    throw new ModelError('Model Store requires a valid project key.');
  }
  return `projects/${projectKey}/models/${revisionSegment(revision)}${filename ? `/${filename}` : ''}`;
};

const requireDependencies = (deps) => {
  for (const name of ['readBytes', 'writeBytesAtomic', 'writeTextAtomic', 'fileExists', 'fileForKey']) {
    if (typeof deps[name] !== 'function') {
      throw new ModelError(`Model Store requires ${name}.`);
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
      throw new ModelError('Installed model lock does not match its descriptor.', {
        code: 'GATHER_MODEL_LOCK_MISMATCH',
      });
    }
    if (digestBytes(await deps.readBytes(keys.artifact)) !== descriptor.artifact.sha256) {
      throw new ModelError('Installed model artifact does not match its package.', {
        code: 'GATHER_MODEL_HASH_MISMATCH',
      });
    }
    if (
      descriptor.labels &&
      (!(await deps.fileExists(keys.labels)) || digestBytes(await deps.readBytes(keys.labels)) !== descriptor.labels.sha256)
    ) {
      throw new ModelError('Installed model labels do not match their package.', {
        code: 'GATHER_MODEL_HASH_MISMATCH',
      });
    }
    verifiedRevisions.add(revision);
  };

  return {
    async install({ projectKey, modelPackage, artifactBytes, labelBytes = null } = {}) {
      validateModelPackage(modelPackage);
      if (!(artifactBytes instanceof Uint8Array) || artifactBytes.byteLength === 0) {
        throw new ModelError('Model artifact bytes are required.');
      }
      const revision = modelRevisionFor(modelPackage);
      const keys = keysFor({ projectKey, revision });
      const expectedArtifactDigest = modelPackage.artifact.sha256;
      if (digestBytes(artifactBytes) !== expectedArtifactDigest) {
        throw new ModelError('Model artifact SHA-256 does not match its package.', {
          code: 'GATHER_MODEL_HASH_MISMATCH',
        });
      }
      if (modelPackage.labels) {
        if (!(labelBytes instanceof Uint8Array) || labelBytes.byteLength === 0) {
          throw new ModelError('Classification labels bytes are required.');
        }
        if (digestBytes(labelBytes) !== modelPackage.labels.sha256) {
          throw new ModelError('Model labels SHA-256 does not match its package.', {
            code: 'GATHER_MODEL_HASH_MISMATCH',
          });
        }
      }

      if (!(await deps.fileExists(keys.lock))) {
        await deps.writeBytesAtomic(keys.artifact, artifactBytes);
        if (modelPackage.labels) await deps.writeBytesAtomic(keys.labels, labelBytes);
        await deps.writeTextAtomic(keys.descriptor, canonicalize(modelPackage));
        await deps.writeTextAtomic(
          keys.lock,
          canonicalize({
            revision,
            artifactSha256: expectedArtifactDigest,
            labelsSha256: modelPackage.labels?.sha256 ?? null,
          })
        );
      }
      verifiedRevisions.delete(revision);
      return this.resolve({ projectKey, modelRef: createModelRef(modelPackage) });
    },

    /**
     * Every model installed for this project, as resolved descriptors.
     *
     * Device state — what this device currently *has*. Deliberately not the
     * source of truth for what an author may choose: models install lazily, so
     * a model this build ships is available long before it appears here. The
     * app's own declaration answers that question; this one answers "is it on
     * the device yet".
     *
     * A directory that fails to resolve is skipped rather than thrown: a
     * partially-written install must not make the whole enumeration fail.
     */
    async listInstalled({ projectKey } = {}) {
      if (typeof deps.listDirectory !== 'function') return [];
      const base = modelKey(projectKey, `sha256:${'0'.repeat(64)}`).replace(
        `/${'0'.repeat(64)}`,
        ''
      );
      const entries = await deps.listDirectory(base);
      const installed = [];
      for (const entry of entries ?? []) {
        const segment = String(entry).split('/').filter(Boolean).pop();
        if (!segment || !/^[a-f0-9]{64}$/.test(segment)) continue;
        try {
          installed.push(await this.resolve({ projectKey, modelRef: { revision: `sha256:${segment}` } }));
        } catch {
          // A half-written or corrupt install is not a reason to fail the list.
        }
      }
      return installed;
    },

    async resolve({ projectKey, modelRef } = {}) {
      const revision = revisionSegment(modelRef?.revision);
      const keys = keysFor({ projectKey, revision: `sha256:${revision}` });
      if (
        !(await deps.fileExists(keys.lock)) ||
        !(await deps.fileExists(keys.descriptor)) ||
        !(await deps.fileExists(keys.artifact))
      ) {
        throw new ModelError('The required model is not installed on this device.', {
          code: 'GATHER_MODEL_UNAVAILABLE',
        });
      }
      const descriptor = JSON.parse(await deps.readText(keys.descriptor));
      validateModelPackage(descriptor);
      if (modelRevisionFor(descriptor) !== modelRef.revision) {
        throw new ModelError('Installed model descriptor revision does not match its lock.', {
          code: 'GATHER_MODEL_LOCK_MISMATCH',
        });
      }
      await verifyInstalledPackage({ keys, descriptor, revision: modelRef.revision });
      const artifact = deps.fileForKey(keys.artifact);
      return {
        model: descriptor,
        modelRef: createModelRef(descriptor),
        artifactPath: artifact.uri ?? artifact.path,
        labelsPath: descriptor.labels ? (deps.fileForKey(keys.labels).uri ?? deps.fileForKey(keys.labels).path) : null,
        labelsKey: descriptor.labels ? keys.labels : null,
        keys,
      };
    },
  };
};
