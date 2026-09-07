import assert from 'node:assert/strict';
import test from 'node:test';

import { Catalog } from '@a2ui/web_core/v0_9/catalog';
import { MessageProcessor } from '@a2ui/web_core/v0_9/processor';

import { createCapabilityActionHandler } from '../../src/a2ui/capabilityActionAdapter.js';
import { GATHER_ACTION_IDS, SEGMENT_AND_MEASURE_VIEWS } from '../../packages/gather-catalog/src/index.js';

const image = { assetId: 'image-1', uri: 'file:///image.jpg', path: 'projects/p/media/image.jpg', width: 3, height: 2, mimeType: 'image/jpeg', sha256: `sha256:${'a'.repeat(64)}`, orientation: null, capturedAt: null };
const mask = { assetId: 'mask-1', uri: 'file:///mask.png', path: 'projects/p/media/mask.png', width: 3, height: 2, mimeType: 'image/png', sha256: `sha256:${'b'.repeat(64)}` };
const model = { id: 'model', version: '1' };

const measurementCapabilities = {
  measureScientificMask: async () => ({ area: { value: 3, unit: 'px2' }, perimeter: { value: 8, unit: 'px' }, boundingBox: { width: 2, height: 2, unit: 'px' }, centroid: { x: 1, y: 1, unit: 'px' } }),
  measureScientificImage: async () => ({ color: { colorSpace: 'sRGB', channels: { red: 1, green: 2, blue: 3 } }, sharpness: { metric: 'variance-of-laplacian', score: 2 } }),
  classifyScientificImage: async () => ({ image, model, ranked: [{ label: 'example', score: 1 }], receipt: { id: 'classify' }, performance: null }),
};

const createProcessor = (onAction) => {
  const processor = new MessageProcessor([new Catalog('gather-test', [])], onAction);
  processor.processMessages([{ version: 'v0.9', createSurface: { surfaceId: 'instrument', catalogId: 'gather-test', sendDataModel: true } }]);
  return processor;
};

const harness = ({ capabilities = {}, onAcceptedResult } = {}) => {
  let handleAction;
  const processor = createProcessor((action) => handleAction(action));
  handleAction = createCapabilityActionHandler({ processor, capabilities, onAcceptedResult });
  const surface = processor.model.getSurface('instrument');
  return {
    processor,
    surface,
    state: () => processor.getClientDataModel().surfaces.instrument.gather,
    dispatch: (name, context) => surface.dispatchAction({ event: { name, ...(context ? { context } : {}) } }, name),
    seed: (value) => surface.dataModel.set('/gather', value),
  };
};

test('capture persists, segments, and lands on the review view', async () => {
  const calls = [];
  const { dispatch, state } = harness({
    capabilities: {
      persistScientificCapture: async (capture) => {
        calls.push(['persist', capture.path]);
        return image;
      },
      segmentScientificImage: async ({ image: input }) => {
        calls.push(['segment', input.assetId]);
        return { image: input, model, mask, threshold: 0.5, receipt: { id: 'segment' }, performance: null };
      },
    },
  });

  await dispatch(GATHER_ACTION_IDS.capture, { capture: { path: '/tmp/camera.jpg', uri: 'file:///tmp/camera.jpg', contentType: 'image/jpeg' } });

  assert.deepEqual(calls, [['persist', '/tmp/camera.jpg'], ['segment', 'image-1']]);
  assert.equal(state().status, SEGMENT_AND_MEASURE_VIEWS.review);
  assert.equal(state().segmentation.mask.assetId, 'mask-1');
});

// The controller owns transitions: capture walks the working views in order and
// the presentation components are never consulted.
test('the controller drives the working views in order during capture', async () => {
  const observed = [];
  let harnessRef;
  harnessRef = harness({
    capabilities: {
      persistScientificCapture: async () => {
        observed.push(harnessRef.state().status);
        return image;
      },
      segmentScientificImage: async ({ image: input }) => {
        observed.push(harnessRef.state().status);
        return { image: input, model, mask, threshold: 0.5 };
      },
    },
  });

  await harnessRef.dispatch(GATHER_ACTION_IDS.capture, { capture: { path: '/tmp/camera.jpg' } });

  assert.deepEqual(observed, [SEGMENT_AND_MEASURE_VIEWS.persisting, SEGMENT_AND_MEASURE_VIEWS.segmenting]);
  assert.equal(harnessRef.state().status, SEGMENT_AND_MEASURE_VIEWS.review);
});

test('web previews can supply a deterministic fixture capture', async () => {
  const { dispatch, state } = harness({
    capabilities: {
      capture: async () => ({ path: 'fixtures/camera.jpg' }),
      persistScientificCapture: async () => image,
      segmentScientificImage: async ({ image: input }) => ({ image: input, model, mask, threshold: 0.5 }),
    },
  });

  await dispatch(GATHER_ACTION_IDS.capture);

  assert.equal(state().image.assetId, 'image-1');
});

test('accept measures and moves to the summary view without delivering the result', async () => {
  let delivered;
  const { dispatch, state, seed } = harness({
    capabilities: measurementCapabilities,
    onAcceptedResult: async (result) => { delivered = result; },
  });
  seed({
    status: SEGMENT_AND_MEASURE_VIEWS.review,
    image,
    segmentation: { image, model, mask, threshold: 0.5, receipt: { id: 'segment' }, performance: null },
  });

  await dispatch(GATHER_ACTION_IDS.accept);

  assert.equal(state().status, SEGMENT_AND_MEASURE_VIEWS.accepted);
  assert.equal(state().result.provenance.classificationModel.id, 'model');
  // Delivery is the explicit submit gesture, not entering the summary view.
  assert.equal(delivered, undefined);
});

test('submit delivers the typed result from the summary view', async () => {
  let delivered;
  const accepted = { image, measurements: { area: { value: 3, unit: 'px2' } } };
  const { dispatch, state, seed } = harness({
    onAcceptedResult: async (result) => { delivered = result; },
  });
  seed({ status: SEGMENT_AND_MEASURE_VIEWS.accepted, image, result: accepted, error: null });

  await dispatch(GATHER_ACTION_IDS.submit);

  assert.deepEqual(delivered, accepted);
  assert.equal(state().status, SEGMENT_AND_MEASURE_VIEWS.accepted, 'submit does not move the view');
});

test('submit is inert before a result exists', async () => {
  let delivered = null;
  const { dispatch, state, seed } = harness({ onAcceptedResult: async (r) => { delivered = r; } });
  seed({ status: SEGMENT_AND_MEASURE_VIEWS.review, image, result: null, error: null });

  await dispatch(GATHER_ACTION_IDS.submit);

  assert.equal(delivered, null);
  assert.equal(state().status, SEGMENT_AND_MEASURE_VIEWS.review);
});

test('accept is idempotent once an output is already accepted', async () => {
  const { dispatch, state, seed } = harness({
    capabilities: {
      measureScientificMask: async () => { throw new Error('should not re-measure'); },
      measureScientificImage: async () => { throw new Error('should not re-measure'); },
      classifyScientificImage: async () => { throw new Error('should not re-classify'); },
    },
  });
  const accepted = {
    image,
    segmentation: { image, model, mask, threshold: 0.5 },
    measurements: { area: { value: 3, unit: 'px2' } },
    provenance: { acceptedAt: '2026-08-30T00:00:00.000Z' },
  };
  seed({ status: SEGMENT_AND_MEASURE_VIEWS.accepted, image, segmentation: accepted.segmentation, result: accepted, error: null });

  await dispatch(GATHER_ACTION_IDS.accept);

  assert.equal(state().status, SEGMENT_AND_MEASURE_VIEWS.accepted);
  assert.deepEqual(state().result, accepted);
});

test('a failing capability writes an observable error view', async () => {
  const { dispatch, state } = harness({
    capabilities: { persistScientificCapture: async () => { throw new Error('camera unavailable'); } },
  });

  await dispatch(GATHER_ACTION_IDS.capture, { capture: { path: '/tmp/camera.jpg' } });

  assert.deepEqual(state(), {
    status: SEGMENT_AND_MEASURE_VIEWS.error,
    image: null,
    segmentation: null,
    classification: null,
    result: null,
    error: 'camera unavailable',
  });
});

test('retake clears capability state and resets to the capture view', async () => {
  const outputReview = { title: 'Review output' };
  const { dispatch, state, seed } = harness();
  seed({
    status: SEGMENT_AND_MEASURE_VIEWS.accepted,
    image,
    segmentation: { image, model, mask, threshold: 0.5 },
    classification: { model, ranked: [{ label: 'example', score: 1 }] },
    result: { image },
    outputReview,
    error: null,
  });

  await dispatch(GATHER_ACTION_IDS.retake);

  assert.equal(state().status, SEGMENT_AND_MEASURE_VIEWS.capture);
  assert.equal(state().result, null);
  // Authored display metadata survives a reset — it is not capability state.
  assert.deepEqual(state().outputReview, outputReview);
});

test('retake returns to capture from the error view', async () => {
  const { dispatch, state, seed } = harness();
  seed({ status: SEGMENT_AND_MEASURE_VIEWS.error, image: null, error: 'camera unavailable' });

  await dispatch(GATHER_ACTION_IDS.retake);

  assert.equal(state().status, SEGMENT_AND_MEASURE_VIEWS.capture);
  assert.equal(state().error, null);
});

test('the host never reshapes the surface — it only writes data', async () => {
  const { dispatch, seed, processor } = harness({ capabilities: measurementCapabilities });
  seed({ status: SEGMENT_AND_MEASURE_VIEWS.review, image, segmentation: { image, model, mask, threshold: 0.5 } });
  const componentsBefore = JSON.stringify([...processor.model.getSurface('instrument').componentsModel.components ?? []]);

  await dispatch(GATHER_ACTION_IDS.accept);
  await dispatch(GATHER_ACTION_IDS.retake);

  const componentsAfter = JSON.stringify([...processor.model.getSurface('instrument').componentsModel.components ?? []]);
  assert.equal(componentsAfter, componentsBefore, 'no updateComponents was sent');
});
