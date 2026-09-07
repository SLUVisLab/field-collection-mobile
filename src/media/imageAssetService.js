import { digestBytes } from 'gather-hashing';

import { createImageAsset, MediaAssetError } from './assetContracts.js';

const nonEmpty = (value, name) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new MediaAssetError(`${name} must be a non-empty string.`);
  }
  return value;
};

/**
 * Materializes a camera-library capture into Gather-owned storage. Callers
 * provide the filesystem adapter so this service remains testable and never
 * retains a native camera object.
 *
 * Nothing here is model- or inference-specific: it copies capture bytes into
 * project storage and mints an `ImageAsset`. It lived under the retired `scientific/` tree by
 * momentum, and that is the whole of what made it look domain-specific.
 */
export const createImageAssetService = ({ readCaptureBytes, writeBytesAtomic, fileUriForKey, newAssetId }) => {
  if (
    typeof readCaptureBytes !== 'function' ||
    typeof writeBytesAtomic !== 'function' ||
    typeof fileUriForKey !== 'function' ||
    typeof newAssetId !== 'function'
  ) {
    throw new MediaAssetError('Image asset service requires filesystem dependencies.');
  }

  return {
    /**
     * `assetId` is the caller's when supplied. A caller that has already minted
     * one — because it derived the storage key from it, or recorded a ledger row
     * under it — must not receive a *second* identity for the same bytes: one
     * persisted working asset is one `ImageAsset`. Minting here is the fallback
     * for callers that have no id of their own.
     */
    async persistCapture({ capture, fileKey, assetId: suppliedAssetId = null, capturedAt = new Date().toISOString() } = {}) {
      if (!capture || typeof capture !== 'object') {
        throw new MediaAssetError('A local camera capture is required.');
      }
      const sourcePath = nonEmpty(capture.path, 'capture.path');
      const target = nonEmpty(fileKey, 'fileKey');
      let bytes;
      try {
        bytes = await readCaptureBytes(sourcePath);
      } catch (cause) {
        const detail = cause instanceof Error && cause.message ? ` ${cause.message}` : '';
        console.error('Gather failed to read temporary camera capture.', { sourcePath, cause });
        throw new MediaAssetError(`The captured image could not be read.${detail}`, {
          code: 'GATHER_IMAGE_ASSET_READ_FAILED',
          cause,
        });
      }
      if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
        throw new MediaAssetError('The captured image is empty.');
      }
      await writeBytesAtomic(target, bytes);
      const assetId = nonEmpty(suppliedAssetId ?? newAssetId(), 'assetId');
      return createImageAsset({
        assetId,
        uri: fileUriForKey(target),
        path: target,
        width: capture.width,
        height: capture.height,
        mimeType: capture.contentType,
        sha256: digestBytes(bytes),
        capturedAt,
      });
    },
  };
};
