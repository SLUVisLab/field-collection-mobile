import { CapabilityError } from '../../errors.js';
import { IMAGE_TASK_PROFILES } from '../../contracts.js';

const requireImageAsset = (image) => {
  if (!image || typeof image !== 'object' || typeof image.assetId !== 'string') {
    throw new CapabilityError('A durable ImageAsset is required.', { code: 'GATHER_IMAGE_INVALID_IMAGE' });
  }
};

const requireProfile = (modelRef, expected) => {
  if (!modelRef || typeof modelRef !== 'object' || typeof modelRef.taskProfile !== 'string') {
    throw new CapabilityError('A resolved model reference is required.', { code: 'GATHER_IMAGE_INVALID_MODEL' });
  }
  if (modelRef.taskProfile !== expected) {
    throw new CapabilityError(`Model does not support ${expected}.`, { code: 'GATHER_IMAGE_UNSUPPORTED_PROFILE' });
  }
};

const requireExecute = (execute) => {
  if (typeof execute !== 'function') {
    throw new CapabilityError('Image inference runtime is unavailable.', { code: 'GATHER_IMAGE_UNAVAILABLE' });
  }
};

/**
 * `image.segment` — portable orchestration. It validates the durable inputs,
 * runs the injected `execute` (the platform inference engine, provided by the
 * app; native ONNX / OpenCV never enters this package), and shapes a serializable
 * result. `modelRef` is the app-computed serializable model reference echoed into
 * the result for provenance; `model` is the opaque resolved model handed to
 * `execute`.
 */
export const segment = async ({ image, model, modelRef, execute } = {}) => {
  requireImageAsset(image);
  requireProfile(modelRef, IMAGE_TASK_PROFILES.segmentationBinary);
  requireExecute(execute);
  const result = await execute({ image, model });
  if (!result || typeof result !== 'object' || !result.mask) {
    throw new CapabilityError('Segmentation did not produce a mask.', { code: 'GATHER_IMAGE_POSTPROCESS_FAILED' });
  }
  return {
    image,
    model: modelRef,
    mask: result.mask,
    threshold: result.threshold,
    receipt: result.receipt ?? null,
    performance: result.performance ?? null,
  };
};
