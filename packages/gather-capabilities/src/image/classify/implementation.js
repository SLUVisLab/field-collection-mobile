import { CapabilityError } from '../../errors.js';
import { IMAGE_TASK_PROFILES } from '../../contracts.js';

const requireImageAsset = (image) => {
  if (!image || typeof image !== 'object' || typeof image.assetId !== 'string') {
    throw new CapabilityError('A durable ImageAsset is required.', { code: 'GATHER_IMAGE_INVALID_IMAGE' });
  }
};

/**
 * The accepted profiles come from the capability's own definition rather than a
 * constant in here, so the pairing is machine-readable — Composer filtering and
 * default-model validation read the same list this check enforces.
 */
const requireProfile = (modelRef, accepted) => {
  if (!modelRef || typeof modelRef !== 'object' || typeof modelRef.taskProfile !== 'string') {
    throw new CapabilityError('A resolved model reference is required.', { code: 'GATHER_IMAGE_INVALID_MODEL' });
  }
  const profiles = Array.isArray(accepted) && accepted.length > 0 ? accepted : [];
  if (!profiles.includes(modelRef.taskProfile)) {
    throw new CapabilityError(
      `Model profile "${modelRef.taskProfile}" does not satisfy ${profiles.join(', ') || 'this capability'}.`,
      { code: 'GATHER_IMAGE_UNSUPPORTED_PROFILE' }
    );
  }
};

const requireExecute = (execute) => {
  if (typeof execute !== 'function') {
    throw new CapabilityError('Image inference runtime is unavailable.', { code: 'GATHER_IMAGE_UNAVAILABLE' });
  }
};

/**
 * `image.classify` — portable orchestration mirroring `image.segment`: validate
 * durable inputs, run the injected inference `execute`, shape a serializable
 * ranked-label result.
 */
export const classify = async ({ image, model, modelRef, execute, acceptedModelProfiles } = {}) => {
  requireImageAsset(image);
  requireProfile(modelRef, acceptedModelProfiles ?? [IMAGE_TASK_PROFILES.classificationRanked]);
  requireExecute(execute);
  const result = await execute({ image, model });
  if (!Array.isArray(result?.ranked) || result.ranked.some((item) => typeof item?.label !== 'string' || !Number.isFinite(item?.score))) {
    throw new CapabilityError('Classification did not produce ranked labels.', { code: 'GATHER_IMAGE_POSTPROCESS_FAILED' });
  }
  return {
    image,
    model: modelRef,
    ranked: result.ranked.map(({ label, score }) => ({ label, score })),
    receipt: result.receipt ?? null,
    performance: result.performance ?? null,
  };
};
