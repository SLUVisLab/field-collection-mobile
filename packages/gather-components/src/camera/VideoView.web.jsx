import { useEffect, useRef, useState } from 'react';

import { CameraFrame } from './CameraFrame.jsx';
import { RecordButton } from './RecordButton.jsx';

const pickMimeType = () => {
  const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const supported = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported;
  return candidates.find((type) => supported && MediaRecorder.isTypeSupported(type)) ?? 'video/webm';
};

/**
 * Web video recording surface (`VideoView`): a live getUserMedia preview plus a
 * `MediaRecorder`, rendered inside the shared `CameraFrame`. On stop it emits a
 * plain, serializable capture (object URL + mime + duration) via `onRecord`; the
 * durable `VideoAsset` is materialized by the storage layer. When no camera is
 * available it falls back to a placeholder and emits `null` so a fixture can be
 * substituted. The only platform-specific code is the DOM media glue.
 */
export function VideoView({ onRecord, onCancel, testIDPrefix = 'video' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const [live, setLive] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setLive(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setLive(false);
      }
    }
    start();
    return () => {
      cancelled = true;
      try { recorderRef.current?.stop(); } catch { /* ignore */ }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
    return () => clearInterval(id);
  }, [recording]);

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setError('Video recording is unavailable in this browser.');
      return;
    }
    try {
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const track = streamRef.current?.getVideoTracks?.()[0];
        const settings = track?.getSettings?.() ?? {};
        void onRecord?.({
          uri: URL.createObjectURL(blob),
          path: `camera/web-recording.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`,
          mimeType,
          durationMs,
          width: settings.width ?? null,
          height: settings.height ?? null,
        });
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      recorder.start();
      setRecording(true);
      setError(null);
    } catch {
      setError('Could not start recording. Try again.');
    }
  };

  const stopRecording = () => {
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    setRecording(false);
  };

  const toggle = () => {
    if (!live) { void onRecord?.(null); return; }
    if (recording) stopRecording(); else startRecording();
  };

  const viewport = live ? (
    <video ref={videoRef} playsInline muted style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }} />
  ) : (
    <span aria-hidden="true" style={{ fontSize: 40, lineHeight: 1 }}>🎥</span>
  );

  return (
    <CameraFrame
      testIDPrefix={testIDPrefix}
      viewport={viewport}
      error={error}
      onCancel={onCancel}
      control={<RecordButton recording={recording} elapsedMs={elapsedMs} onToggle={toggle} testIDPrefix={testIDPrefix} />}
    />
  );
}
