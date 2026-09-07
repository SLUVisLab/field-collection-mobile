/**
 * `.gather` v2 — pack, open, verify.
 *
 * The format is deliberately small: a frozen dependency declaration, the
 * author's composition unchanged, and the exact model bytes those dependencies
 * name. See docs/planning/gather-package-v2-design.md for why there is no lock
 * file and why the package never learns about its XForm.
 *
 * ```text
 * tool.gather
 * ├── manifest.json
 * ├── composition.a2ui.json
 * └── models/sha256-<revision>/{model.json,model.onnx,labels.txt?}
 * ```
 */
import { canonicalize, digestBytes } from 'gather-hashing';

import { detectFormat, readArchive, writeArchive } from './archive.js';

export const GATHER_PACKAGE_VERSION = 2;
const MANIFEST = 'manifest.json';
const COMPOSITION = 'composition.a2ui.json';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class PackageError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = 'PackageError';
    this.code = code;
  }
}

const modelDirFor = (revision) => `models/${revision.replace(':', '-')}`;

/**
 * @param {{
 *   tool: { id: string, revision: string, title?: string },
 *   composition: object,                        the whole composition, unchanged
 *   plan: object,                               from planPublication()
 *   modelSources: Map<string, { modelPackage: object, artifactBytes: Uint8Array, labelBytes?: Uint8Array }>,
 *   builtBy?: string,
 *   builtAt?: string,
 * }} input
 */
export const packTool = ({ tool, composition, plan, modelSources, builtBy = 'gather', builtAt } = {}) => {
  if (!tool?.id || !tool?.revision) {
    throw new PackageError('A package needs a Tool id and revision.', { code: 'GATHER_PACKAGE_NO_IDENTITY' });
  }
  // The **whole** composition, not its message list.
  //
  // This was an array until 2026-09-06, which was wrong in two ways that share
  // one cause — mistaking `messages` for the composition. A device loads a
  // packaged Tool through `definitionLoader`, which requires an object with
  // `id`, `catalogId`, `surfaceId` and `messages`; and `bindCompositionOutputs`
  // needs the `result` block to know an output's declared type. A package
  // carrying only messages satisfies neither, so it could be staged onto a form
  // and then fail to load on the device that received it.
  if (Array.isArray(composition) || typeof composition !== 'object' || composition === null) {
    throw new PackageError(
      'A package carries the whole composition, not its message list — a device needs its id, ' +
        'catalogId, surfaceId and declared result to load and bind it.',
      { code: 'GATHER_PACKAGE_COMPOSITION_NOT_WHOLE' }
    );
  }
  for (const key of ['id', 'catalogId', 'surfaceId']) {
    if (typeof composition[key] !== 'string' || composition[key].length === 0) {
      throw new PackageError(`The composition declares no ${key}, so a device could not load it.`, {
        code: 'GATHER_PACKAGE_COMPOSITION_INCOMPLETE',
      });
    }
  }
  if (!Array.isArray(composition.messages) || composition.messages.length === 0) {
    throw new PackageError('The composition has no messages to render.', {
      code: 'GATHER_PACKAGE_COMPOSITION_INCOMPLETE',
    });
  }
  // Canonical JSON so the same Tool yields the same bytes.
  const compositionBytes = encoder.encode(canonicalize(composition));
  const entries = [{ path: COMPOSITION, bytes: compositionBytes }];

  const models = [];
  for (const required of plan.models) {
    const { revision } = required.modelRef;
    const source = modelSources?.get(revision);
    if (!source) {
      throw new PackageError(
        `No model package or bytes were supplied for ${revision}, so it cannot be packaged.`,
        { code: 'GATHER_PACKAGE_MODEL_MISSING' }
      );
    }
    const declared = source.modelPackage?.artifact?.sha256;
    if (digestBytes(source.artifactBytes) !== declared) {
      throw new PackageError(
        `Artifact bytes for ${revision} do not match the digest its package declares.`,
        { code: 'GATHER_PACKAGE_ARTIFACT_MISMATCH' }
      );
    }
    const directory = modelDirFor(revision);
    entries.push({ path: `${directory}/model.json`, bytes: encoder.encode(canonicalize(source.modelPackage)) });
    entries.push({ path: `${directory}/model.onnx`, bytes: source.artifactBytes });
    if (source.labelBytes) entries.push({ path: `${directory}/labels.txt`, bytes: source.labelBytes });
    models.push({ modelRef: required.modelRef, for: required.for, path: directory });
  }

  const manifest = {
    gatherPackage: GATHER_PACKAGE_VERSION,
    tool: {
      id: tool.id,
      revision: tool.revision,
      ...(tool.title ? { title: tool.title } : {}),
      composition: { path: COMPOSITION, sha256: digestBytes(compositionBytes) },
    },
    requires: {
      capabilities: plan.capabilities,
      // Not installed — verified against the host at load. See the design.
      hostFunctions: plan.hostFunctions,
      models,
    },
    // What a `default` selection resolved to at publication. Execution consults
    // this before app policy, which is what makes the package frozen.
    modelResolutions: plan.modelResolutions,
    outputs: plan.outputs,
    builtAt: builtAt ?? new Date().toISOString(),
    builtBy,
  };

  entries.push({ path: MANIFEST, bytes: encoder.encode(canonicalize(manifest)) });
  return { bytes: writeArchive(entries), manifest };
};

/**
 * Parses JSON from package bytes as untrusted input.
 *
 * A `SyntaxError` escaping the reader would say "Unexpected token }" to someone
 * who opened a file. The package either parses or it is not a package.
 */
const parseJson = (bytes, what) => {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    throw new PackageError(`The package's ${what} is not readable JSON.`, {
      code: 'GATHER_PACKAGE_MALFORMED',
    });
  }
};

/** The manifest fields this reader dereferences, checked before it does. */
const assertManifestShape = (manifest) => {
  const path = manifest?.tool?.composition?.path;
  const sha256 = manifest?.tool?.composition?.sha256;
  if (typeof path !== 'string' || typeof sha256 !== 'string') {
    throw new PackageError('The package manifest does not describe its composition.', {
      code: 'GATHER_PACKAGE_MALFORMED',
    });
  }
  const models = manifest?.requires?.models;
  if (models !== undefined && !Array.isArray(models)) {
    throw new PackageError('The package manifest does not describe its models.', {
      code: 'GATHER_PACKAGE_MALFORMED',
    });
  }
  for (const required of models ?? []) {
    if (typeof required?.path !== 'string' || typeof required?.modelRef?.revision !== 'string') {
      throw new PackageError('The package manifest does not describe its models.', {
        code: 'GATHER_PACKAGE_MALFORMED',
      });
    }
  }
};

/**
 * Opens a `.gather` file of either version and verifies what it claims.
 *
 * Verification is about **internal consistency**: does the composition match its
 * digest, does each model package hash to the revision the manifest names.
 * Whether this host can *run* it is a separate question, answered by
 * `checkHostSupport`.
 */
export const openTool = ({ bytes, modelRevisionFor } = {}) => {
  const format = detectFormat(bytes);
  if (format === 'composition') {
    // v1: the composition verbatim, which is what M10 proved on hardware.
    return { version: 1, manifest: null, composition: JSON.parse(decoder.decode(bytes)), models: new Map() };
  }
  if (format !== 'container') {
    throw new PackageError('This is not a Gather Tool package.', { code: 'GATHER_PACKAGE_UNRECOGNISED' });
  }

  if (typeof modelRevisionFor !== 'function') {
    throw new PackageError('Opening a v2 package requires a way to re-derive model revisions.', {
      code: 'GATHER_PACKAGE_NO_REVISION_FN',
    });
  }

  let entries;
  try {
    entries = readArchive(bytes);
  } catch (cause) {
    // The archive reader's refusals are deliberately narrow and worded for a
    // developer. Anyone above this line asked "is this a Gather package?".
    throw new PackageError(`This is not a Gather Tool package: ${cause.message}`, {
      code: 'GATHER_PACKAGE_UNREADABLE',
      cause,
    });
  }
  const manifestBytes = entries.get(MANIFEST);
  if (!manifestBytes) throw new PackageError('The package has no manifest.', { code: 'GATHER_PACKAGE_NO_MANIFEST' });
  const manifest = parseJson(manifestBytes, 'manifest');
  if (manifest.gatherPackage !== GATHER_PACKAGE_VERSION) {
    throw new PackageError(
      `This package declares format ${manifest.gatherPackage}; this build reads ${GATHER_PACKAGE_VERSION}.`,
      { code: 'GATHER_PACKAGE_VERSION_UNSUPPORTED' }
    );
  }
  assertManifestShape(manifest);

  const compositionBytes = entries.get(manifest.tool.composition.path);
  if (!compositionBytes) {
    throw new PackageError('The package names a composition it does not contain.', {
      code: 'GATHER_PACKAGE_COMPOSITION_MISSING',
    });
  }
  if (digestBytes(compositionBytes) !== manifest.tool.composition.sha256) {
    throw new PackageError('The composition does not match the digest in the manifest.', {
      code: 'GATHER_PACKAGE_COMPOSITION_MISMATCH',
    });
  }

  const models = new Map();
  for (const required of manifest.requires.models ?? []) {
    const packageBytes = entries.get(`${required.path}/model.json`);
    const artifactBytes = entries.get(`${required.path}/model.onnx`);
    if (!packageBytes || !artifactBytes) {
      throw new PackageError(`The package is missing files for ${required.modelRef.revision}.`, {
        code: 'GATHER_PACKAGE_MODEL_FILES_MISSING',
      });
    }
    const modelPackage = parseJson(packageBytes, `model package for ${required.modelRef.revision}`);
    // Re-derived, never trusted: a manifest that lies about which model it
    // carries fails here, before anything is installed. This is required rather
    // than optional because an identity that is only checked when the caller
    // remembers to ask is not an identity.
    const actual = modelRevisionFor(modelPackage);
    if (actual !== required.modelRef.revision) {
      throw new PackageError(
        `The package lists ${required.modelRef.revision} but carries a package for ${actual}.`,
        { code: 'GATHER_PACKAGE_REVISION_MISMATCH' }
      );
    }
    if (digestBytes(artifactBytes) !== modelPackage.artifact?.sha256) {
      throw new PackageError(`Artifact bytes for ${required.modelRef.revision} are corrupt.`, {
        code: 'GATHER_PACKAGE_ARTIFACT_CORRUPT',
      });
    }
    models.set(required.modelRef.revision, {
      modelRef: required.modelRef,
      modelPackage,
      artifactBytes,
      labelBytes: entries.get(`${required.path}/labels.txt`) ?? null,
    });
  }

  return { version: 2, manifest, composition: parseJson(compositionBytes, 'composition'), models };
};

/**
 * Whether this build can run what the package calls.
 *
 * Capabilities are portable requirements the package installs against; host
 * functions are requirements of the Gather host itself and are never packaged.
 * Both make a Tool unrunnable here if absent, and the useful failure names the
 * missing one.
 */
export const checkHostSupport = ({ manifest, capabilities = [], hostFunctions = [] } = {}) => {
  const missing = [];
  for (const id of manifest?.requires?.capabilities ?? []) {
    if (!capabilities.includes(id)) missing.push({ kind: 'capability', id });
  }
  for (const name of manifest?.requires?.hostFunctions ?? []) {
    if (!hostFunctions.includes(name)) missing.push({ kind: 'hostFunction', id: name });
  }
  return { supported: missing.length === 0, missing };
};
