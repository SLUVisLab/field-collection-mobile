
/**
 * The serializable descriptors for media Gather owns.
 *
 * An `ImageAsset` is what a capture becomes once its bytes are durable; a
 * `MaskAsset` is what an image capability produces from one. Both are plain
 * JSON, because they cross the A2UI boundary into compositions and are recorded
 * verbatim in execution receipts.
 *
 * These are **media** contracts, not model or inference contracts. They lived
 * in a `scientific/contracts.js` that also owned model validation and canonical
 * hashing, which is why a mask asset and a model package used to raise the same
 * error type.
 */
export class MediaAssetError extends Error {
  constructor(message, { code = 'GATHER_MEDIA_ASSET_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'MediaAssetError';
    this.code = code;
    this.cause = cause;
  }
}

const SHA256 = /^[a-f0-9]{64}$/;

const requireString = (value, name) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MediaAssetError(`${name} must be a non-empty string.`);
  }
  return value;
};

const requirePositiveInteger = (value, name) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new MediaAssetError(`${name} must be a positive integer.`);
  }
  return value;
};

const requireSha256 = (value, name) => {
  const digest = requireString(value, name).replace(/^sha256:/, '');
  if (!SHA256.test(digest)) {
    throw new MediaAssetError(`${name} must be a SHA-256 digest.`);
  }
  return `sha256:${digest}`;
};

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
