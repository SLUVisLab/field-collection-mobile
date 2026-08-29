import { ScientificContractError } from '../../scientific/contracts.js';

const requireMask = (mask) => {
  if (!mask || typeof mask.path !== 'string' || !Number.isInteger(mask.width) || !Number.isInteger(mask.height)) {
    throw new ScientificContractError('A durable MaskAsset is required.', { code: 'GATHER_MEASURE_INVALID_MASK' });
  }
};

const requireImage = (image) => {
  if (!image || typeof image.path !== 'string') {
    throw new ScientificContractError('A durable ImageAsset is required.', { code: 'GATHER_MEASURE_INVALID_IMAGE' });
  }
};

const requireAdapter = (adapter, method) => {
  if (typeof adapter?.[method] !== 'function') {
    throw new ScientificContractError('Scientific measurement runtime is unavailable.', { code: 'GATHER_MEASURE_UNAVAILABLE' });
  }
};

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
