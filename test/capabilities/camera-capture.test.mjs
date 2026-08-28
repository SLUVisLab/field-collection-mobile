import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CameraCaptureError,
  capturePhoto,
  localImageCaptureResult,
} from '../../src/capabilities/camera/capturePhoto.js';
import { scannedCodeValue } from '../../src/capabilities/camera/scanResult.js';

test('camera capture returns only a stable local-file result and disposes the native photo', async () => {
  let captureSettings = null;
  let disposed = false;
  const nativePhoto = {
    width: 3024,
    height: 4032,
    async saveToTemporaryFileAsync() {
      return '/private/var/mobile/Containers/Data/photo.jpeg';
    },
    dispose() {
      disposed = true;
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
    width: 3024,
    height: 4032,
  });
  assert.deepEqual(captureSettings, { settings: { flashMode: 'off' }, callbacks: {} });
  assert.equal(disposed, true);
  assert.notEqual(result, nativePhoto);
});

test('camera capture releases a native photo when writing its local file fails', async () => {
  let disposed = false;
  const photoOutput = {
    async capturePhoto() {
      return {
        async saveToTemporaryFileAsync() {
          throw new Error('disk full');
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

test('barcode normalization returns a plain first payload without retaining barcode objects', () => {
  const first = { rawValue: undefined, displayValue: undefined };
  const second = { rawValue: 'scanned-settings-qr', displayValue: 'display-settings-qr' };

  assert.equal(scannedCodeValue([first, second]), 'scanned-settings-qr');
  assert.equal(scannedCodeValue([{ displayValue: 'fallback-code' }]), 'fallback-code');
  assert.equal(scannedCodeValue([]), null);
  assert.equal(scannedCodeValue(null), null);
});
