import test from 'node:test';
import assert from 'node:assert/strict';

import { createSegmentAndMeasureResult } from '../../src/scientific/workflows/segmentAndMeasure.js';

test('Segment and Measure accepts one serializable researcher-reviewed result', () => {
  const result = createSegmentAndMeasureResult({
    image: { assetId: 'image-1' },
    segmentation: { mask: { assetId: 'mask-1' }, model: { id: 'u2netp' }, receipt: { revision: 'segmentation-receipt' } },
    maskMeasurements: { area: { value: 3, unit: 'px2' }, perimeter: { value: 8, unit: 'px' } },
    imageMeasurements: { color: { colorSpace: 'sRGB' }, sharpness: { metric: 'variance-of-laplacian', score: 2 } },
    classification: { model: { id: 'mobilenet' }, ranked: [{ label: 'example', score: 1 }], receipt: { revision: 'classification-receipt' } },
    acceptedAt: '2026-08-29T00:00:00.000Z',
  });
  assert.equal(result.provenance.segmentationModel.id, 'u2netp');
  assert.equal(result.classification.ranked[0].label, 'example');
  assert.equal(result.provenance.executionReceipts.segmentation.revision, 'segmentation-receipt');
});
