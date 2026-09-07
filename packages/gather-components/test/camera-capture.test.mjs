import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CameraCaptureError,
  capturePhoto,
  localImageCaptureResult,
} from '../src/camera/capturePhoto.js';

// Moved from the app in Phase 3 with `capturePhoto` itself. This is the seam that
// converts a VisionCamera photo into a plain local-file descriptor: no native
// camera object may cross it, and the native photo/image must always be disposed.

test('camera capture returns only a stable local-file result and disposes the native photo and image', async () => {
  let captureSettings = null;
  let photoDisposed = false;
  let imageDisposed = false;
  let savedFormat = null;
  const nativeImage = {
    width: 4032,
    height: 3024,
    async saveToTemporaryFileAsync(format, quality) {
      savedFormat = { format, quality };
      return '/private/var/mobile/Containers/Data/photo.jpeg';
    },
    dispose() {
      imageDisposed = true;
    },
  };
  const nativePhoto = {
    width: 3024,
    height: 4032,
    async toImageAsync() {
      return nativeImage;
    },
    async saveToTemporaryFileAsync() {
      throw new Error('should use the oriented Image path');
    },
    dispose() {
      photoDisposed = true;
    },
  };
  const photoOutput = {
    async capturePhoto(settings, callbacks) {
      captureSettings = { settings, callbacks };
      return nativePhoto;
    },
  };

  const result = await capturePhoto({ photoOutput });

  assert.deepEqual(result, {
    uri: 'file:///private/var/mobile/Containers/Data/photo.jpeg',
    file: '/private/var/mobile/Containers/Data/photo.jpeg',
    path: '/private/var/mobile/Containers/Data/photo.jpeg',
    contentType: 'image/jpeg',
    width: 4032,
    height: 3024,
  });
  assert.deepEqual(savedFormat, { format: 'jpg', quality: 90 });
  assert.deepEqual(captureSettings, { settings: { flashMode: 'off' }, callbacks: {} });
  assert.equal(photoDisposed, true);
  assert.equal(imageDisposed, true);
  assert.notEqual(result, nativePhoto);
});

test('camera capture releases a native photo when converting its oriented image fails', async () => {
  let disposed = false;
  const photoOutput = {
    async capturePhoto() {
      return {
        async toImageAsync() {
          throw new Error('disk full');
        },
        async saveToTemporaryFileAsync() {
          return '/cache/photo.jpeg';
        },
        dispose() {
          disposed = true;
        },
      };
    },
  };

  await assert.rejects(capturePhoto({ photoOutput }), /disk full/);
  assert.equal(disposed, true);
});

test('camera capture normalizes file URIs and rejects non-local results', () => {
  assert.deepEqual(
    localImageCaptureResult({
      uri: 'file:///cache/image.jpeg',
      contentType: 'image/jpeg',
      width: 0,
      height: undefined,
    }),
    {
      uri: 'file:///cache/image.jpeg',
      file: '/cache/image.jpeg',
      path: '/cache/image.jpeg',
      contentType: 'image/jpeg',
      width: null,
      height: null,
    }
  );
  assert.throws(
    () => localImageCaptureResult({ uri: 'https://example.test/image.jpeg' }),
    CameraCaptureError
  );
});
