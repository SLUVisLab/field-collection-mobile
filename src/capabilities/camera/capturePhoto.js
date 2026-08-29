export class CameraCaptureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CameraCaptureError';
  }
}

const localPathFor = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CameraCaptureError('Camera capture did not produce a local file.');
  }
  const path = value.startsWith('file://') ? value.slice('file://'.length) : value;
  if (!path.startsWith('/')) {
    throw new CameraCaptureError('Camera capture did not produce a local file.');
  }
  return path;
};

const dimensionOrNull = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

/**
 * Converts a camera-library file result into the plain, stable local-file
 * contract used by Gather callers. No camera-native object crosses this seam.
 */
export const localImageCaptureResult = ({
  filePath,
  path,
  uri,
  contentType = 'image/jpeg',
  width,
  height,
} = {}) => {
  if (typeof contentType !== 'string' || !contentType.startsWith('image/')) {
    throw new CameraCaptureError('Camera capture did not produce an image.');
  }
  const localPath = localPathFor(filePath ?? path ?? uri);
  return {
    uri: `file://${localPath}`,
    file: localPath,
    path: localPath,
    contentType,
    width: dimensionOrNull(width),
    height: dimensionOrNull(height),
  };
};

/**
 * Captures one JPEG into a temporary local file and releases VisionCamera's
 * in-memory Photo before returning only Gather's plain local-file result.
 */
export const capturePhoto = async ({
  photoOutput,
  flashMode = 'off',
  contentType = 'image/jpeg',
} = {}) => {
  if (!photoOutput || typeof photoOutput.capturePhoto !== 'function') {
    throw new CameraCaptureError('Camera capture is not ready.');
  }

  const photo = await photoOutput.capturePhoto({ flashMode }, {});
  try {
    // Convert the Photo to an Image so the camera orientation (and mirroring)
    // is baked into the pixel buffer instead of being left as a lazy EXIF flag.
    // Downstream consumers (RN <Image> display and Nitro's raw-pixel decode for
    // segmentation) then agree on a single upright orientation, keeping the
    // proposed mask aligned with the reviewed image.
    if (typeof photo.toImageAsync !== 'function' || typeof photo.saveToTemporaryFileAsync !== 'function') {
      throw new CameraCaptureError('Camera capture did not produce a photo.');
    }
    const image = await photo.toImageAsync();
    try {
      const filePath = await image.saveToTemporaryFileAsync('jpg', 90);
      return localImageCaptureResult({
        filePath,
        contentType,
        width: image.width,
        height: image.height,
      });
    } finally {
      image?.dispose?.();
    }
  } finally {
    photo?.dispose?.();
  }
};
