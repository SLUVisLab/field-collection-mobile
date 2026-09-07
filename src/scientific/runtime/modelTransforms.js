import { ScientificContractError } from '../contracts.js';

const required = (condition, message) => {
  if (!condition) throw new ScientificContractError(message, { code: 'GATHER_MODEL_TRANSFORM_INVALID' });
};

export const rgbToTensor = ({ pixels, width, height, steps, inputShape }) => {
  required(pixels instanceof Uint8Array, 'Model input pixels must be RGB bytes.');
  required(pixels.length === width * height * 3, 'Model input pixels do not match image dimensions.');
  let divisor = 1;
  let mean = null;
  let std = null;
  for (const step of steps) {
    if (step.operation === 'scale') divisor = step.divisor;
    if (step.operation === 'normalize') ({ mean, std } = step);
  }
  required(Number.isFinite(divisor) && divisor > 0, 'Model scale divisor must be positive.');
  const [, channels, tensorHeight, tensorWidth] = inputShape;
  required(channels === 3 && tensorHeight === height && tensorWidth === width, 'Decoded image must match model input dimensions.');
  const plane = width * height;
  const tensor = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const normalized = pixels[index * 3 + channel] / divisor;
      tensor[channel * plane + index] = mean ? (normalized - mean[channel]) / std[channel] : normalized;
    }
  }
  return tensor;
};

export const sigmoid = (values) => values.map((value) => 1 / (1 + Math.exp(-value)));

export const binaryMask = ({ values, threshold, width, height }) => {
  required(values.length === width * height, 'Segmentation output dimensions are unsupported.');
  return Uint8Array.from(values, (value) => (value >= threshold ? 255 : 0));
};

export const softmax = (values) => {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const denominator = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / denominator);
};

export const rankedLabels = ({ logits, labels, count }) => {
  required(Array.isArray(labels) && labels.length === logits.length, 'Classification labels do not match model output.');
  required(Number.isInteger(count) && count > 0, 'Classification top-K must be positive.');
  const scores = softmax(logits);
  return scores
    .map((score, index) => ({ label: labels[index], score }))
    .sort((left, right) => right.score - left.score)
    .slice(0, count);
};
