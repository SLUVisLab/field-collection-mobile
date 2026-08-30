import assert from 'node:assert/strict';
import test from 'node:test';

import { Catalog } from '@a2ui/web_core/v0_9/catalog';
import { MessageProcessor } from '@a2ui/web_core/v0_9/processor';

import { createCapabilityActionHandler } from '../../src/a2ui/capabilityActionAdapter.js';
import { GATHER_ACTION_IDS } from '../../packages/gather-catalog/src/index.js';

const image = { assetId: 'image-1', uri: 'file:///image.jpg', path: 'projects/p/media/image.jpg', width: 3, height: 2, mimeType: 'image/jpeg', sha256: `sha256:${'a'.repeat(64)}`, orientation: null, capturedAt: null };
const mask = { assetId: 'mask-1', uri: 'file:///mask.png', path: 'projects/p/media/mask.png', width: 3, height: 2, mimeType: 'image/png', sha256: `sha256:${'b'.repeat(64)}` };
const model = { id: 'model', version: '1' };

const createProcessor = (onAction) => {
  const processor = new MessageProcessor([new Catalog('gather-test', [])], onAction);
  processor.processMessages([{ version: 'v0.9', createSurface: { surfaceId: 'instrument', catalogId: 'gather-test', sendDataModel: true } }]);
  return processor;
};

test('A2UI capability actions persist, segment, and retain only serializable state', async () => {
  let processor;
  let handleAction;
  const calls = [];
  const capabilities = {
    persistScientificCapture: async (capture) => {
      calls.push(['persist', capture.path]);
      return image;
    },
    segmentScientificImage: async ({ image: input }) => {
      calls.push(['segment', input.assetId]);
      return { image: input, model, mask, threshold: 0.5, receipt: { id: 'segment' }, performance: null };
    },
  };
  processor = createProcessor((action) => handleAction(action));
  handleAction = createCapabilityActionHandler({ processor, capabilities });

  await processor.model.getSurface('instrument').dispatchAction({
    event: { name: GATHER_ACTION_IDS.capture, context: { capture: { path: '/tmp/camera.jpg', uri: 'file:///tmp/camera.jpg', contentType: 'image/jpeg' } } },
  }, 'capture');

  assert.deepEqual(calls, [['persist', '/tmp/camera.jpg'], ['segment', 'image-1']]);
  assert.equal(processor.getClientDataModel().surfaces.instrument.gather.phase, 'review-mask');
  assert.equal(processor.getClientDataModel().surfaces.instrument.gather.segmentation.mask.assetId, 'mask-1');
});

test('A2UI web previews can supply a deterministic fixture capture', async () => {
  let processor;
  let handleAction;
  processor = createProcessor((action) => handleAction(action));
  handleAction = createCapabilityActionHandler({
    processor,
    capabilities: {
      capture: async () => ({ path: 'fixtures/camera.jpg' }),
      persistScientificCapture: async () => image,
      segmentScientificImage: async ({ image: input }) => ({ image: input, model, mask, threshold: 0.5 }),
    },
  });

  await processor.model.getSurface('instrument').dispatchAction(
    { event: { name: GATHER_ACTION_IDS.capture } },
    'capture'
  );

  assert.equal(processor.getClientDataModel().surfaces.instrument.gather.image.assetId, 'image-1');
});

test('A2UI accept action writes an accepted Segment and Measure result', async () => {
  let processor;
  let handleAction;
  let accepted;
  const capabilities = {
    measureScientificMask: async () => ({ area: { value: 3, unit: 'px2' }, perimeter: { value: 8, unit: 'px' }, boundingBox: { width: 2, height: 2, unit: 'px' }, centroid: { x: 1, y: 1, unit: 'px' } }),
    measureScientificImage: async () => ({ color: { colorSpace: 'sRGB', channels: { red: 1, green: 2, blue: 3 } }, sharpness: { metric: 'variance-of-laplacian', score: 2 } }),
    classifyScientificImage: async () => ({ image, model, ranked: [{ label: 'example', score: 1 }], receipt: { id: 'classify' }, performance: null }),
  };
  processor = createProcessor((action) => handleAction(action));
  handleAction = createCapabilityActionHandler({ processor, capabilities, onAcceptedResult: async (result) => { accepted = result; } });
  processor.model.getSurface('instrument').dataModel.set('/gather', {
    phase: 'review-mask',
    image,
    segmentation: { image, model, mask, threshold: 0.5, receipt: { id: 'segment' }, performance: null },
  });

  await processor.model.getSurface('instrument').dispatchAction({ event: { name: GATHER_ACTION_IDS.accept } }, 'accept');

  assert.equal(accepted.image.assetId, 'image-1');
  assert.equal(accepted.provenance.classificationModel.id, 'model');
  assert.equal(processor.getClientDataModel().surfaces.instrument.gather.phase, 'accepted');
});

test('A2UI accept action is idempotent once an output is already accepted', async () => {
  let processor;
  let handleAction;
  const capabilities = {
    measureScientificMask: async () => {
      throw new Error('should not re-measure');
    },
    measureScientificImage: async () => {
      throw new Error('should not re-measure');
    },
    classifyScientificImage: async () => {
      throw new Error('should not re-classify');
    },
  };
  processor = createProcessor((action) => handleAction(action));
  handleAction = createCapabilityActionHandler({ processor, capabilities });
  const accepted = {
    image,
    segmentation: { image, model, mask, threshold: 0.5, receipt: { id: 'segment' }, performance: null },
    measurements: { area: { value: 3, unit: 'px2' } },
    classification: { model, ranked: [{ label: 'example', score: 1 }] },
    provenance: { acceptedAt: '2026-08-30T00:00:00.000Z' },
  };
  processor.model.getSurface('instrument').dataModel.set('/gather', {
    phase: 'accepted',
    image,
    segmentation: accepted.segmentation,
    classification: accepted.classification,
    result: accepted,
    error: null,
  });

  await processor.model.getSurface('instrument').dispatchAction({ event: { name: GATHER_ACTION_IDS.accept } }, 'accept');

  assert.equal(processor.getClientDataModel().surfaces.instrument.gather.phase, 'accepted');
  assert.deepEqual(processor.getClientDataModel().surfaces.instrument.gather.result, accepted);
});

test('A2UI capability action writes an observable error state', async () => {
  let processor;
  let handleAction;
  processor = createProcessor((action) => handleAction(action));
  handleAction = createCapabilityActionHandler({
    processor,
    capabilities: { persistScientificCapture: async () => { throw new Error('camera unavailable'); } },
  });

  await processor.model.getSurface('instrument').dispatchAction(
    { event: { name: GATHER_ACTION_IDS.capture, context: { capture: { path: '/tmp/camera.jpg' } } } },
    'capture'
  );
  assert.deepEqual(processor.getClientDataModel().surfaces.instrument.gather, {
    phase: 'error',
    image: null,
    segmentation: null,
    classification: null,
    result: null,
    error: 'camera unavailable',
  });
});

test('A2UI retake preserves declarative output review metadata on state reset', async () => {
  let processor;
  let handleAction;
  processor = createProcessor((action) => handleAction(action));
  handleAction = createCapabilityActionHandler({ processor, capabilities: {} });
  const outputReview = { title: 'Review output', primaryActionLabel: 'Accept' };
  processor.model.getSurface('instrument').dataModel.set('/gather', {
    phase: 'accepted',
    image,
    segmentation: { image, model, mask, threshold: 0.5 },
    classification: { model, ranked: [{ label: 'example', score: 1 }] },
    result: { image },
    outputReview,
    error: null,
  });

  await processor.model.getSurface('instrument').dispatchAction({ event: { name: GATHER_ACTION_IDS.retake } }, 'retake');

  assert.equal(processor.getClientDataModel().surfaces.instrument.gather.phase, 'capture');
  assert.deepEqual(processor.getClientDataModel().surfaces.instrument.gather.outputReview, outputReview);
  assert.equal(processor.getClientDataModel().surfaces.instrument.gather.result, null);
});
