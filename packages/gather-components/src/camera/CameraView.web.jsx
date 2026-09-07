import { useEffect, useRef, useState } from 'react';

import { CameraFrame } from './CameraFrame.jsx';

const MAX_DIMENSION = 960;

/**
 * Web photo camera surface (`CameraView`): a live getUserMedia preview rendered
 * inside the shared `CameraFrame`. When a camera is unavailable (headless preview,
 * denied permission, or a Composer iframe without camera policy) it falls back to
 * a placeholder and the shutter drives a fixture capture, so the flow always
 * works. The only platform-specific code here is the DOM camera/canvas glue; it
 * emits the same plain serializable capture as the native `CameraView`.
 */
export function CameraView({
  onCapture,
  canCapture = true,
  notice = null,
  leading = null,
  trailing = null,
  testIDPrefix = 'camera',
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [live, setLive] = useState(true);
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setLive(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setLive(false);
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const grabFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    return { uri: canvas.toDataURL('image/jpeg', 0.9), path: 'camera/web-capture.jpg', contentType: 'image/jpeg', width, height };
  };

  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);
    setError(null);
    try {
      await onCapture?.(live ? grabFrame() : null);
    } catch {
      setError('Could not capture a frame. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const viewport = live ? (
    <video
      ref={videoRef}
      playsInline
      muted
      style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
    />
  ) : (
    <span aria-hidden="true" style={{ fontSize: 40, lineHeight: 1 }}>📷</span>
  );

  return (
    <CameraFrame
      testIDPrefix={testIDPrefix}
      viewport={viewport}
      capturing={capturing}
      captureDisabled={!canCapture}
      notice={notice}
      error={error}
      leading={leading}
      trailing={trailing}
      onCapture={handleCapture}
    />
  );
}
