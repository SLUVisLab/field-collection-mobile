import { createModelRef } from 'gather-models';

import { BUNDLED_MODELS, bundledModelFor } from './bundledModels.js';

/**
 * **Which compatible model is the default** — app configuration, and only that.
 *
 * The distinction this file exists to keep:
 *
 * ```text
 * ModelRef            exact model identity
 * capability default  a policy that selects one
 * ```
 *
 * A default used to be `modelName = 'u2netp'`, a JavaScript parameter default
 * in the provider: not serializable, not discoverable, not overridable by an
 * author, and invisible until after execution. Naming it here makes it
 * configuration — and by the time a capability runs it holds a concrete
 * `ModelRef` either way, so provenance records the same thing whether the
 * author chose the model or the policy did.
 *
 * Ownership, deliberately split three ways:
 *
 * ```text
 * gather-models        what models ARE
 * gather-capabilities  which model PROFILES a capability accepts
 * here                 which compatible model is the default
 * ```
 */
export const DEFAULT_MODELS_BY_CAPABILITY = Object.freeze({
  'image.segment': 'u2netp',
  'image.classify': 'mobilenetV3Large',
});

export class ModelPolicyError extends Error {
  constructor(message, { code = 'GATHER_MODEL_POLICY_ERROR' } = {}) {
    super(message);
    this.name = 'ModelPolicyError';
    this.code = code;
  }
}

/** The bundled model this build defaults to for a capability, if any. */
export const defaultBundledModelFor = (capabilityId) =>
  bundledModelFor(DEFAULT_MODELS_BY_CAPABILITY[capabilityId] ?? '');

/**
 * The default `ModelRef` for a capability, validated against what that
 * capability actually accepts.
 *
 * A default that does not satisfy its capability's declared profiles is a
 * configuration bug, and one that would otherwise surface as a confusing
 * runtime rejection deep inside the capability. It is checked here instead.
 */
export const defaultModelRefFor = (capabilityId, acceptedModelProfiles = []) => {
  const declared = defaultBundledModelFor(capabilityId);
  if (!declared) return null;
  const modelRef = createModelRef(declared.modelPackage);
  if (
    Array.isArray(acceptedModelProfiles) &&
    acceptedModelProfiles.length > 0 &&
    !acceptedModelProfiles.includes(modelRef.taskProfile)
  ) {
    throw new ModelPolicyError(
      `The default model for ${capabilityId} has profile "${modelRef.taskProfile}", which that capability does not accept.`,
      { code: 'GATHER_MODEL_DEFAULT_INCOMPATIBLE' }
    );
  }
  return modelRef;
};

/**
 * The bundled declaration matching a `ModelRef`, or null.
 *
 * Identity is the **revision** — content-addressed, so a ref matches a shipped
 * model only when it names exactly those bytes and that tensor contract.
 */
export const bundledModelForRef = (modelRef) => {
  if (!modelRef?.revision) return null;
  return (
    BUNDLED_MODELS.find(
      (entry) => createModelRef(entry.modelPackage).revision === modelRef.revision
    ) ?? null
  );
};
