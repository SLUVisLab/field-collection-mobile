import { CameraCapture } from '../camera/CameraCapture.js';

/**
 * Capture step for the Segment & Measure instrument. The post-capture views
 * (mask review, measurements, classification, result) are shared cross-platform
 * in `gather-components`; only the native camera surface lives here.
 */
export function SegmentAndMeasureCapture({ onCapture, onCancel, testIDPrefix }) {
  return <CameraCapture onCaptured={onCapture} onCancel={onCancel} testIDPrefix={testIDPrefix} />;
}
