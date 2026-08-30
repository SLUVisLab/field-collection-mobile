import { useCallback, useState } from 'react';
import { useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { CaptureView } from 'gather-components';

import { capturePhoto } from '../../capabilities/camera/capturePhoto.js';
import { CameraViewport } from './CameraViewport.js';

/**
 * Native capture surface: owns VisionCamera permission/photo output and the
 * verified capturePhoto capability, and renders the shared CaptureView so the
 * viewport frame and shutter match every other renderer.
 */
export function CameraCapture({ onCaptured, onCancel, testIDPrefix = 'camera' }) {
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
      await onCaptured?.(capture);
    } catch {
      setError('Could not capture a photo. Try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCaptured, photoOutput]);

  if (!hasPermission) {
    return (
      <CaptureView
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
    <CaptureView
      testIDPrefix={testIDPrefix}
      capturing={capturing}
      error={error}
      onCancel={onCancel}
      onCapture={() => void takePhoto()}
      viewport={
        <CameraViewport
          photoOutput={photoOutput}
          isActive
          onError={() => setError('Camera preview is unavailable.')}
          onUnavailable={() => setError('No camera is available on this device.')}
        />
      }
    />
  );
}
