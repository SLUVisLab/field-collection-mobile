import { CameraView } from 'gather-components';

/**
 * Capture step for the Segment & Measure instrument. The camera surface is now
 * the shared `CameraView` (owned by `gather-components`); the post-capture views
 * (mask review, measurements, classification, result) are shared cross-platform
 * too. This thin wrapper keeps the instrument's capture entry point stable.
 */
export function SegmentAndMeasureCapture({ onCapture, onCancel, testIDPrefix }) {
  return <CameraView onCapture={onCapture} onCancel={onCancel} testIDPrefix={testIDPrefix} />;
}
