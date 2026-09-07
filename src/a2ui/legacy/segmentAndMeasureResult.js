import { assertSerializableValue } from '../../provenance/serializable.js';

/**
 * The deprecated native Segment & Measure path's own error. This file is
 * scheduled to be deleted with that screen (roadmap step 6); it sits beside its
 * only consumer so it dies with the cluster rather than outliving it in shared
 * infrastructure.
 */
export class SegmentAndMeasureError extends Error {
  constructor(message, { code = 'GATHER_SEGMENT_MEASURE_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'SegmentAndMeasureError';
    this.code = code;
    this.cause = cause;
  }
}

const required = (condition, message) => {
  if (!condition) throw new SegmentAndMeasureError(message, { code: 'GATHER_SEGMENT_MEASURE_INVALID' });
};

/**
 * Defines the instrument-shaped, researcher-accepted result independently of
 * the native screen. M9 can later accept this same plain value from A2UI.
 */
export const createSegmentAndMeasureResult = ({
  image,
  segmentation,
  maskMeasurements,
  imageMeasurements,
  classification = null,
  acceptedAt = new Date().toISOString(),
} = {}) => {
  required(image?.assetId && segmentation?.mask?.assetId, 'An image and accepted segmentation are required.');
  required(maskMeasurements?.area && maskMeasurements?.perimeter, 'Mask measurements are required.');
  required(imageMeasurements?.color && imageMeasurements?.sharpness, 'Image measurements are required.');
  required(classification === null || Array.isArray(classification.ranked), 'Classification must contain ranked results.');
  const result = {
    image,
    segmentation,
    measurements: { ...maskMeasurements, ...imageMeasurements },
    classification,
    provenance: {
      acceptedAt,
      segmentationModel: segmentation.model,
      classificationModel: classification?.model ?? null,
      executionReceipts: {
        segmentation: segmentation.receipt ?? null,
        classification: classification?.receipt ?? null,
      },
    },
  };
  assertSerializableValue(result);
  return result;
};
