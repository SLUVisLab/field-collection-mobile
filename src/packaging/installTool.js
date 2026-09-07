/**
 * Installing a `.gather` package onto a device.
 *
 * This layer is deliberately thin, and that is the design. A package carries
 * model bytes, and Gather already has exactly one place model bytes may land:
 * `createModelStore()` in `gather-models`. Packages do not get their own
 * storage, their own layout, or their own verification — a second path to the
 * same directory is a second set of rules about what is installed, and the two
 * drift the first time one of them is fixed.
 *
 * So installation is: open and verify (`openTool`), then hand each verified
 * model package to the store the same way a bundled model arrives. The store
 * re-derives the revision, re-checks the artifact digest, and skips anything
 * already present. Two Tools that share a model install it once.
 *
 * See docs/planning/gather-package-v2-design.md.
 */

import { openTool } from './gatherPackage.js';

export class InstallError extends Error {
  constructor(message, { code = 'GATHER_INSTALL_FAILED', cause } = {}) {
    super(message, { cause });
    this.name = 'InstallError';
    this.code = code;
  }
}

/**
 * Installs the models a package carries, then returns what it takes to run it.
 *
 * Nothing is written until `openTool` has verified the whole package, so a
 * corrupt or dishonest file leaves the store exactly as it was.
 *
 * @param {object} options
 * @param {Uint8Array} options.bytes           the `.gather` file
 * @param {object} options.modelStore          a `gather-models` store
 * @param {string} options.projectKey          the project the models install under
 * @param {(pkg: object) => string} options.modelRevisionFor
 * @returns {Promise<{version: number, manifest: object, composition: object,
 *                    models: Array<{revision: string, modelRef: object,
 *                                   descriptor: object, alreadyInstalled: boolean}>}>}
 */
export const installTool = async ({ bytes, modelStore, projectKey, modelRevisionFor } = {}) => {
  if (!modelStore || typeof modelStore.install !== 'function') {
    throw new InstallError('Installing a Tool package requires a model store.', {
      code: 'GATHER_INSTALL_NO_STORE',
    });
  }

  // Verification happens in full, first. `openTool` throws before returning if
  // anything about the package is inconsistent, which is what makes the loop
  // below safe to write without a rollback path.
  const opened = openTool({ bytes, modelRevisionFor });
  if (opened.version !== 2) {
    throw new InstallError('Only v2 packages carry models to install.', {
      code: 'GATHER_INSTALL_VERSION_UNSUPPORTED',
    });
  }

  const models = [];
  for (const [revision, model] of opened.models) {
    // Asked before installing, so the result can say whether this package
    // actually contributed the bytes or found them already there. The store
    // would skip the write either way; this only reports it.
    let alreadyInstalled = false;
    try {
      await modelStore.resolve({ projectKey, modelRef: model.modelRef });
      alreadyInstalled = true;
    } catch {
      alreadyInstalled = false;
    }

    const descriptor = await modelStore.install({
      projectKey,
      modelPackage: model.modelPackage,
      artifactBytes: model.artifactBytes,
      labelBytes: model.labelBytes,
    });
    models.push({ revision, modelRef: model.modelRef, descriptor, alreadyInstalled });
  }

  return { version: opened.version, manifest: opened.manifest, composition: opened.composition, models };
};
