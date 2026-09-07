import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

/**
 * The live native preview element, shared by `CameraView` (photo) and `VideoView`
 * (video). It fills its parent frame; visual framing (aspect/background/radius) is
 * owned by the shared `CameraFrame`, so it stays identical across platforms.
 *
 * Extension seam: `frameProcessor` is forwarded to `<Camera>` so a future live-CV
 * feature (bounding boxes, keypoints, segmentation overlays, quality guidance) can
 * attach a VisionCamera frame processor here. Native `Frame`/worklet objects stay
 * inside this component and must never cross the Tool/A2UI contract — the mounted
 * component remains the owner of the frame stream. No live-analysis API is wired
 * yet; this only preserves a clean attach point.
 */
export function CameraDevicePreview({
  facing = 'back',
  isActive = true,
  outputs = undefined,
  video = undefined,
  audio = undefined,
  frameProcessor = undefined,
  cameraRef = undefined,
  onError,
  onPreviewStarted,
  onUnavailable,
}) {
  const device = useCameraDevice(facing);

  useEffect(() => {
    if (!device) onUnavailable?.();
  }, [device, onUnavailable]);

  if (!device) return null;

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      outputs={outputs}
      video={video}
      audio={audio}
      frameProcessor={frameProcessor}
      onError={() => onError?.()}
      onPreviewStarted={onPreviewStarted}
    />
  );
}
