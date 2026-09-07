/**
 * Where the browser gets model bytes.
 *
 * Three things stay separate, and this file is only the third:
 *
 * ```text
 * ModelRef       identity — what a Tool pins
 * ModelPackage   contract — tensors, preprocessing, postprocessing
 * provider       bytes    — where they come from, here and now
 * ```
 *
 * So no URL ever enters a `ModelRef`. The provider looks bytes up **by the
 * revision it is given**, which is the same identity the device installs under,
 * and the path is content-addressed for the same reason.
 *
 * Scope is deliberately one line long: models this Gather distribution
 * declares, served as static assets by this renderer. No CDN, no registry, no
 * arbitrary URLs, no cloud inference.
 */
import { digestBytes } from 'gather-hashing';

const directoryFor = (revision) => `/models/${revision.replace(':', '-')}`;
const pathFor = (revision) => `${directoryFor(revision)}/model.onnx`;

export const createWebModelProvider = ({ fetchImpl = fetch, verify = true } = {}) => {
  const cache = new Map();
  const packages = new Map();

  const provider = {
    /**
     * Bytes for an exact revision, verified against it.
     *
     * A provider that returned *something* for a revision it does not have
     * would make every identity downstream a guess, so a miss and a mismatch
     * are both loud.
     */
    async bytesFor(modelRef) {
      const revision = modelRef?.revision;
      if (typeof revision !== 'string' || !revision.startsWith('sha256:')) {
        throw new Error(`"${revision}" is not a model revision, so no bytes can be found for it.`);
      }
      if (cache.has(revision)) return cache.get(revision);

      const path = pathFor(revision);
      const response = await fetchImpl(path);
      if (!response.ok) {
        throw new Error(
          `This renderer serves no bytes for ${revision} (${response.status} at ${path}). ` +
            'Only models this Gather distribution declares can run in the browser preview.'
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());

      if (verify) {
        // Two digests, and they are not interchangeable:
        //
        //   revision         digest of the canonical ModelPackage — identity
        //   artifactSha256   digest of the .onnx bytes            — these bytes
        //
        // The directory is keyed by revision because that is what a Tool pins
        // and what the device installs under; the bytes are checked against
        // artifactSha256 because that is what they are.
        const expected = modelRef.artifactSha256 ?? (await provider.packageFor(modelRef))?.artifact?.sha256;
        if (!expected) {
          throw new Error(`${revision} declares no artifact digest, so its bytes cannot be verified.`);
        }
        const actual = digestBytes(bytes);
        if (actual !== expected) {
          throw new Error(
            `Bytes at ${path} digest ${actual}, but ${revision} declares ${expected}.`
          );
        }
      }
      cache.set(revision, bytes);
      return bytes;
    },

    /**
     * The ModelPackage, which stays authoritative about tensors, preprocessing
     * and postprocessing. `models.json` is an authoring projection and never
     * stands in for this.
     */
    async packageFor(modelRef) {
      const revision = modelRef?.revision;
      if (packages.has(revision)) return packages.get(revision);
      const path = `${directoryFor(revision)}/model.json`;
      const response = await fetchImpl(path);
      if (!response.ok) {
        throw new Error(`This renderer serves no ModelPackage for ${revision} (${response.status}).`);
      }
      const modelPackage = await response.json();
      packages.set(revision, modelPackage);
      return modelPackage;
    },
  };

  return provider;
};

/**
 * The `modelStore` seam `createModelExecutor` expects, backed by the provider.
 * The executor asks for an `artifactPath`; here that is the bytes themselves,
 * which the ORT-Web runtime consumes directly.
 */
export const createWebModelStore = ({ provider }) => ({
  async resolve({ modelRef }) {
    const bytes = await provider.bytesFor(modelRef);
    return { artifactPath: bytes, modelRef };
  },
});

/** The resolver the preview runtime injects: package in, identity preserved. */
export const createWebModelResolver = ({ provider, models }) => async ({
  capabilityId,
  acceptedModelProfiles,
  modelRef,
}) => {
  const chosen = modelRef
    ? models.find((model) => model.modelRef.revision === modelRef.revision)
    : models.find((model) => (model.defaultFor ?? []).includes(capabilityId));
  if (!chosen) {
    throw new Error(
      modelRef
        ? `No model in this distribution has revision ${modelRef.revision}.`
        : `${capabilityId} has no default model in this distribution.`
    );
  }
  if (
    Array.isArray(acceptedModelProfiles) &&
    acceptedModelProfiles.length > 0 &&
    !acceptedModelProfiles.includes(chosen.taskProfile)
  ) {
    throw new Error(`${chosen.taskProfile} is not accepted by ${capabilityId}.`);
  }
  // The package is the model the executor works from; the ref is its identity.
  const modelPackage = await provider.packageFor(chosen.modelRef);
  return { model: modelPackage, modelRef: chosen.modelRef };
};
