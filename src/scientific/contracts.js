import { sha256 } from 'js-sha256';

export class ScientificContractError extends Error {
  constructor(message, { code = 'GATHER_SCIENTIFIC_CONTRACT_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'ScientificContractError';
    this.code = code;
    this.cause = cause;
  }
}

const SHA256 = /^[a-f0-9]{64}$/;

const requireString = (value, name) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ScientificContractError(`${name} must be a non-empty string.`);
  }
  return value;
};

const requirePositiveInteger = (value, name) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ScientificContractError(`${name} must be a positive integer.`);
  }
  return value;
};

const requireSha256 = (value, name) => {
  const digest = requireString(value, name).replace(/^sha256:/, '');
  if (!SHA256.test(digest)) {
    throw new ScientificContractError(`${name} must be a SHA-256 digest.`);
  }
  return `sha256:${digest}`;
};

const plainValue = (value) => {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new ScientificContractError('Scientific revisions cannot contain non-finite numbers.');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(plainValue);
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    throw new ScientificContractError('Scientific revisions must contain only JSON-compatible values.');
  }
  return Object.keys(value)
    .sort()
    .reduce((result, key) => ({ ...result, [key]: plainValue(value[key]) }), {});
};

export const canonicalJson = (value) => JSON.stringify(plainValue(value));

export const sha256For = (value) => {
  if (value instanceof Uint8Array) return `sha256:${sha256(value)}`;
  return `sha256:${sha256(typeof value === 'string' ? value : canonicalJson(value))}`;
};

export const revisionFor = (value) => sha256For(value);

export const createImageAsset = ({
  assetId,
  uri,
  path,
  width,
  height,
  mimeType = 'image/jpeg',
  sha256: digest,
  orientation = null,
  capturedAt = null,
} = {}) => ({
  assetId: requireString(assetId, 'image.assetId'),
  uri: requireString(uri, 'image.uri'),
  path: requireString(path, 'image.path'),
  width: requirePositiveInteger(width, 'image.width'),
  height: requirePositiveInteger(height, 'image.height'),
  mimeType: requireString(mimeType, 'image.mimeType'),
  sha256: requireSha256(digest, 'image.sha256'),
  orientation: orientation === null ? null : requireString(orientation, 'image.orientation'),
  capturedAt: capturedAt === null ? null : requireString(capturedAt, 'image.capturedAt'),
});

export const createMaskAsset = ({
  assetId,
  uri,
  path,
  width,
  height,
  format = 'binary-png',
  sha256: digest,
  sourceImageAssetId,
} = {}) => ({
  assetId: requireString(assetId, 'mask.assetId'),
  uri: requireString(uri, 'mask.uri'),
  path: requireString(path, 'mask.path'),
  width: requirePositiveInteger(width, 'mask.width'),
  height: requirePositiveInteger(height, 'mask.height'),
  format: requireString(format, 'mask.format'),
  sha256: requireSha256(digest, 'mask.sha256'),
  sourceImageAssetId: requireString(sourceImageAssetId, 'mask.sourceImageAssetId'),
});

export const assertSerializableScientificValue = (value) => {
  plainValue(value);
  return value;
};
