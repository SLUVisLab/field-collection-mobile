import { useCallback, useState } from 'react';
import { useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';

import { CameraFrame } from './CameraFrame.jsx';
import { CameraDevicePreview } from './CameraDevicePreview.native.jsx';
import { capturePhoto } from './capturePhoto.js';

/**
 * Native photo camera surface (`CameraView`): owns VisionCamera permission and
 * the photo output, renders the shared `CameraFrame`, and emits a plain,
 * serializable local-file capture via `onCapture`. No camera-native object
 * crosses this seam (`capturePhoto` releases the VisionCamera Photo before
 * returning). The durable `ImageAsset` is materialized by the storage layer, not
 * by this component.
 */
export function CameraView({ onCapture, onCancel, leading = null, trailing = null, testIDPrefix = 'camera' }) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg', quality: 0.9 });
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);

  const requestAccess = useCallback(async () => {
    setError(null);
    try {
      await requestPermission();
    } catch {
      setError('Camera access could not be requested. You can enable it in system settings.');
    }
  }, [requestPermission]);

  const takePhoto = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    setError(null);
    try {
      const capture = await capturePhoto({ photoOutput });
      await onCapture?.(capture);
    } catch {
      setError('Could not capture a photo. Try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCapture, photoOutput]);

  if (!hasPermission) {
    return (
      <CameraFrame
        testIDPrefix={testIDPrefix}
        error={error}
        onCancel={onCancel}
        permission={{
          message: 'Camera access is needed to take a photo. You can still continue without attaching one.',
          canRequest: canRequestPermission,
          onRequest: () => void requestAccess(),
        }}
      />
    );
  }

  return (
    <CameraFrame
      testIDPrefix={testIDPrefix}
      capturing={capturing}
      error={error}
      onCancel={onCancel}
      leading={leading}
      trailing={trailing}
      onCapture={() => void takePhoto()}
      viewport={
        <CameraDevicePreview
          outputs={[photoOutput]}
          isActive
          onError={() => setError('Camera preview is unavailable.')}
          onUnavailable={() => setError('No camera is available on this device.')}
        />
      }
    />
  );
}
