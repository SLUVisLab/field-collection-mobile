import { CapabilityError } from '../errors.js';

const requireMask = (mask) => {
  if (!mask || typeof mask.path !== 'string' || !Number.isInteger(mask.width) || !Number.isInteger(mask.height)) {
    throw new CapabilityError('A durable MaskAsset is required.', { code: 'GATHER_MEASURE_INVALID_MASK' });
  }
};

const requireImage = (image) => {
  if (!image || typeof image.path !== 'string') {
    throw new CapabilityError('A durable ImageAsset is required.', { code: 'GATHER_MEASURE_INVALID_IMAGE' });
  }
};

const requireAdapter = (adapter, method) => {
  if (typeof adapter?.[method] !== 'function') {
    throw new CapabilityError('Measurement runtime is unavailable.', { code: 'GATHER_MEASURE_UNAVAILABLE' });
  }
};

/**
 * Measurement capabilities are portable orchestration over an injected geometry
 * `adapter` (the app's OpenCV runtime; no native Mats enter this package). Mask
 * measurements derive from a mask; image measurements derive from image + mask.
 */
export const measureMask = async ({ mask, adapter } = {}) => {
  requireMask(mask);
  requireAdapter(adapter, 'maskMeasurements');
  return adapter.maskMeasurements(mask);
};

export const measureImage = async ({ image, mask, adapter } = {}) => {
  requireImage(image);
  requireMask(mask);
  requireAdapter(adapter, 'imageMeasurements');
  return adapter.imageMeasurements(image, mask);
};

const maskResult = async (input, key) => (await measureMask(input))[key];
const imageResult = async (input, key) => (await measureImage(input))[key];

export const area = (input) => maskResult(input, 'area');
export const perimeter = (input) => maskResult(input, 'perimeter');
export const boundingBox = (input) => maskResult(input, 'boundingBox');
export const centroid = (input) => maskResult(input, 'centroid');
export const color = (input) => imageResult(input, 'color');
export const sharpness = (input) => imageResult(input, 'sharpness');
