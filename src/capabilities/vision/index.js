import { createScientificModelRef, TASK_PROFILES, validateScientificModelPackage } from '../../scientific/models/modelPackage.js';
import { ScientificContractError } from '../../scientific/contracts.js';

const validateInvocation = ({ image, model, expectedProfile, execute }) => {
  if (!image || typeof image !== 'object' || typeof image.assetId !== 'string') {
    throw new ScientificContractError('A durable ImageAsset is required.', { code: 'GATHER_VISION_INVALID_IMAGE' });
  }
  validateScientificModelPackage(model);
  if (model.taskProfile !== expectedProfile) {
    throw new ScientificContractError(`Model does not support ${expectedProfile}.`, {
      code: 'GATHER_VISION_UNSUPPORTED_PROFILE',
    });
  }
  if (typeof execute !== 'function') {
    throw new ScientificContractError('Vision runtime is unavailable.', { code: 'GATHER_VISION_UNAVAILABLE' });
  }
};

export const segment = async ({ image, model, execute } = {}) => {
  validateInvocation({ image, model, expectedProfile: TASK_PROFILES.segmentationBinary, execute });
  const result = await execute({ image, model });
  if (!result || typeof result !== 'object' || !result.mask) {
    throw new ScientificContractError('Segmentation did not produce a mask.', { code: 'GATHER_VISION_POSTPROCESS_FAILED' });
  }
  return {
    image,
    model: createScientificModelRef(model),
    mask: result.mask,
    threshold: result.threshold,
    receipt: result.receipt ?? null,
    performance: result.performance ?? null,
  };
};

export const classify = async ({ image, model, execute } = {}) => {
  validateInvocation({ image, model, expectedProfile: TASK_PROFILES.classificationRanked, execute });
  const result = await execute({ image, model });
  if (!Array.isArray(result?.ranked) || result.ranked.some((item) => typeof item?.label !== 'string' || !Number.isFinite(item?.score))) {
    throw new ScientificContractError('Classification did not produce ranked labels.', {
      code: 'GATHER_VISION_POSTPROCESS_FAILED',
    });
  }
  return {
    image,
    model: createScientificModelRef(model),
    ranked: result.ranked.map(({ label, score }) => ({ label, score })),
    receipt: result.receipt ?? null,
    performance: result.performance ?? null,
  };
};
