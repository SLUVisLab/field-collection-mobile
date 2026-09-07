// Camera components. `CameraView` (photo) and `VideoView` (video) each resolve to
// their platform seam via the bundler:
//   Metro (native) → *.native.jsx  (VisionCamera)
//   Vite  (web)    → *.web.jsx      (getUserMedia / MediaRecorder)
// The extensionless specifiers below are intentional — they are what lets the
// bundler pick the platform file. The shared presentation (`CameraFrame`,
// `RecordButton`, `CameraDevicePreview`) is written once with RN primitives.
export { CameraView } from './CameraView';
export { VideoView } from './VideoView';
export { CameraFrame } from './CameraFrame.jsx';
