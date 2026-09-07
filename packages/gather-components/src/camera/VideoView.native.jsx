import { useCallback, useEffect, useRef, useState } from 'react';
import { useCameraPermission } from 'react-native-vision-camera';

import { CameraFrame } from './CameraFrame.jsx';
import { CameraDevicePreview } from './CameraDevicePreview.native.jsx';
import { RecordButton } from './RecordButton.jsx';

/**
 * Native video recording surface (`VideoView`): owns VisionCamera permission and
 * the live session, renders the shared `CameraFrame` with a record control, and
 * emits a plain, serializable capture (local file + mime + duration) via
 * `onRecord`. The durable `VideoAsset` is materialized by the storage layer.
 *
 * NOTE (device-validation pending): the start/stop recording uses the standard
 * VisionCamera camera-ref API (`startRecording`/`stopRecording`). Audio also
 * requires microphone permission on device. This path builds/bundles cleanly but
 * must be validated on a physical device, per the Phase 3 plan. No native
 * recording object crosses this seam.
 */
export function VideoView({ onRecord, onCancel, testIDPrefix = 'video' }) {
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef(null);
  const startedAtRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
    return () => clearInterval(id);
  }, [recording]);

  const requestAccess = useCallback(async () => {
    setError(null);
    try {
      await requestPermission();
    } catch {
      setError('Camera access could not be requested. You can enable it in system settings.');
    }
  }, [requestPermission]);

  const emit = useCallback(
    (video) => {
      const path = typeof video?.path === 'string' ? video.path : null;
      if (!path) return;
      const durationMs = Number.isFinite(video?.duration) ? Math.round(video.duration * 1000) : Date.now() - startedAtRef.current;
      void onRecord?.({
        uri: path.startsWith('file://') ? path : `file://${path}`,
        path: path.replace(/^file:\/\//, ''),
        mimeType: 'video/mp4',
        durationMs,
        width: video?.width ?? null,
        height: video?.height ?? null,
      });
    },
    [onRecord]
  );

  const toggle = useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera) return;
    if (recording) {
      try {
        await camera.stopRecording();
      } catch {
        setError('Could not stop the recording.');
      }
      setRecording(false);
      return;
    }
    try {
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setError(null);
      camera.startRecording({
        onRecordingFinished: (video) => {
          setRecording(false);
          emit(video);
        },
        onRecordingError: () => {
          setRecording(false);
          setError('Recording failed. Try again.');
        },
      });
      setRecording(true);
    } catch {
      setError('Could not start recording. Try again.');
    }
  }, [emit, recording]);

  if (!hasPermission) {
    return (
      <CameraFrame
        testIDPrefix={testIDPrefix}
        error={error}
        onCancel={onCancel}
        permission={{
          message: 'Camera access is needed to record video. You can still continue without attaching one.',
          canRequest: canRequestPermission,
          onRequest: () => void requestAccess(),
        }}
      />
    );
  }

  return (
    <CameraFrame
      testIDPrefix={testIDPrefix}
      error={error}
      onCancel={onCancel}
      viewport={
        <CameraDevicePreview
          cameraRef={cameraRef}
          video
          audio
          isActive
          onError={() => setError('Camera preview is unavailable.')}
          onUnavailable={() => setError('No camera is available on this device.')}
        />
      }
      control={<RecordButton recording={recording} elapsedMs={elapsedMs} onToggle={() => void toggle()} testIDPrefix={testIDPrefix} />}
    />
  );
}
