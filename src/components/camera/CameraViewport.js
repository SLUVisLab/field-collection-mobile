import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

/**
 * The live native preview element only. It fills its parent frame; the visual
 * framing (aspect ratio, background, radius) is owned by the shared
 * CaptureView so it stays identical across platforms.
 */
export function CameraViewport({ photoOutput, isActive, onError, onPreviewStarted, onUnavailable }) {
  const device = useCameraDevice('back');

  useEffect(() => {
    if (!device) onUnavailable?.();
  }, [device, onUnavailable]);

  if (!device) return null;

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      outputs={[photoOutput]}
      onError={() => onError?.()}
      onPreviewStarted={onPreviewStarted}
    />
  );
}
