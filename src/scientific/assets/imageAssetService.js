import { createImageAsset, ScientificContractError, sha256For } from '../contracts.js';

const nonEmpty = (value, name) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ScientificContractError(`${name} must be a non-empty string.`);
  }
  return value;
};

/**
 * Materializes a camera-library capture into Gather-owned storage. Callers
 * provide the filesystem adapter so this service remains testable and never
 * retains a native camera object.
 */
export const createImageAssetService = ({ readCaptureBytes, writeBytesAtomic, fileUriForKey, newAssetId }) => {
  if (
    typeof readCaptureBytes !== 'function' ||
    typeof writeBytesAtomic !== 'function' ||
    typeof fileUriForKey !== 'function' ||
    typeof newAssetId !== 'function'
  ) {
    throw new ScientificContractError('Image asset service requires filesystem dependencies.');
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
        throw new ScientificContractError('A local camera capture is required.');
      }
      const sourcePath = nonEmpty(capture.path, 'capture.path');
      const target = nonEmpty(fileKey, 'fileKey');
      let bytes;
      try {
        bytes = await readCaptureBytes(sourcePath);
      } catch (cause) {
        const detail = cause instanceof Error && cause.message ? ` ${cause.message}` : '';
        console.error('Gather failed to read temporary camera capture.', { sourcePath, cause });
        throw new ScientificContractError(`The captured image could not be read.${detail}`, {
          code: 'GATHER_IMAGE_ASSET_READ_FAILED',
          cause,
        });
      }
      if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
        throw new ScientificContractError('The captured image is empty.');
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
        sha256: sha256For(bytes),
        capturedAt,
      });
    },
  };
};
