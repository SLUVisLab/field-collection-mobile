import assert from 'node:assert/strict';
import test from 'node:test';

import { GATHER_ACTION_IDS } from '../../packages/gather-catalog/src/index.js';
import { PHOTO_CAPTURE_DEFINITION, PHOTO_CAPTURE_VIEWS } from '../fixtures/photo-capture/definition.mjs';
import { createPhotoCaptureActionHandler } from '../fixtures/photo-capture/actionHandler.mjs';
import { createA2uiRuntime } from '../../src/a2ui/a2uiRuntime.js';
import { gatherComponentApis, mobileBasicApis } from '../../src/a2ui/mobile/componentApis.js';

/**
 * Exercises the **generic A2UI runtime** end to end using the Photo Capture
 * fixture — everything except rendering, which only a device exercises.
 *
 * The subject under test is `createA2uiRuntime` + `Flow` + `FlowController` +
 * the action/completion seam. Photo Capture is deterministic test material, not
 * a production concept: a real photo field uses `CameraView` directly.
 */

const digest = (character) => `sha256:${character.repeat(64)}`;

const image = {
  assetId: 'image-1',
  uri: 'file:///var/mobile/photo.jpg',
  path: 'projects/p/media/photo.jpg',
  width: 960,
  height: 640,
  mimeType: 'image/jpeg',
  sha256: digest('a'),
  orientation: null,
  capturedAt: '2026-09-01T00:00:00.000Z',
};

const descriptor = { uri: 'file:///tmp/camera.jpg', path: '/tmp/camera.jpg', contentType: 'image/jpeg', width: 960, height: 640 };

const harness = ({ persistCapture = async () => image, capture } = {}) => {
  const accepted = [];
  const runtime = createA2uiRuntime({
    tool: PHOTO_CAPTURE_DEFINITION,
    componentApis: [...mobileBasicApis, ...gatherComponentApis],
  });
  const handler = createPhotoCaptureActionHandler({ capabilities: { persistCapture, capture } })({
    processor: runtime.processor,
    onAcceptedResult: async (result) => { accepted.push(result); },
  });
  runtime.setActionHandler(handler);
  return {
    runtime,
    accepted,
    state: () => runtime.state(PHOTO_CAPTURE_DEFINITION.statePath),
    dispatch: (name, context) =>
      runtime.surface.dispatchAction({ event: { name, ...(context ? { context } : {}) } }, name),
  };
};

test('the runtime creates the definition\'s surface and starts on the capture View', () => {
  const { state, runtime } = harness();
  assert.equal(runtime.surface.id ?? PHOTO_CAPTURE_DEFINITION.surfaceId, PHOTO_CAPTURE_DEFINITION.surfaceId);
  assert.equal(state().status, PHOTO_CAPTURE_VIEWS.capture);
  assert.equal(state().image, null);
});

test('capture persists the descriptor into a durable ImageAsset and lands on review', async () => {
  const persisted = [];
  const { dispatch, state } = harness({
    persistCapture: async (input) => { persisted.push(input); return image; },
  });

  await dispatch(GATHER_ACTION_IDS.capture, { capture: descriptor });

  // Component-owned acquisition: the raw descriptor comes from CameraView and
  // the controller — not a `camera.*` capability — materializes the asset.
  assert.deepEqual(persisted, [descriptor]);
  assert.equal(state().status, PHOTO_CAPTURE_VIEWS.review);
  assert.deepEqual(state().image, image);
});

test('the controller passes through the working View while persisting', async () => {
  let observed = null;
  let ref;
  ref = harness({
    persistCapture: async () => { observed = ref.state().status; return image; },
  });

  await ref.dispatch(GATHER_ACTION_IDS.capture, { capture: descriptor });

  assert.equal(observed, PHOTO_CAPTURE_VIEWS.persisting);
  assert.equal(ref.state().status, PHOTO_CAPTURE_VIEWS.review);
});

test('accept delivers the typed ImageAsset through the host completion seam', async () => {
  const { dispatch, state, accepted } = harness();
  await dispatch(GATHER_ACTION_IDS.capture, { capture: descriptor });

  await dispatch(GATHER_ACTION_IDS.accept);

  assert.equal(accepted.length, 1);
  assert.deepEqual(accepted[0], image, 'the composition completes with one ImageAsset');
  // Delivery does not itself move the flow — the embedder decides what happens
  // after completion.
  assert.equal(state().status, PHOTO_CAPTURE_VIEWS.review);
});

test('accept before a capture is an error, not a silent completion', async () => {
  const { dispatch, state, accepted } = harness();

  await dispatch(GATHER_ACTION_IDS.accept);

  assert.equal(accepted.length, 0);
  assert.equal(state().status, PHOTO_CAPTURE_VIEWS.error);
  assert.match(state().error, /Capture a photo/);
});

test('retake clears the photo and returns to capture', async () => {
  const { dispatch, state } = harness();
  await dispatch(GATHER_ACTION_IDS.capture, { capture: descriptor });

  await dispatch(GATHER_ACTION_IDS.retake);

  assert.equal(state().status, PHOTO_CAPTURE_VIEWS.capture);
  assert.equal(state().image, null);
});

test('a failed persist surfaces the error View, and retake recovers', async () => {
  const { dispatch, state } = harness({
    persistCapture: async () => { throw new Error('disk full'); },
  });

  await dispatch(GATHER_ACTION_IDS.capture, { capture: descriptor });
  assert.equal(state().status, PHOTO_CAPTURE_VIEWS.error);
  assert.equal(state().error, 'disk full');

  await dispatch(GATHER_ACTION_IDS.retake);
  assert.equal(state().status, PHOTO_CAPTURE_VIEWS.capture);
  assert.equal(state().error, null);
});

test('web previews may supply a fixture capture when the component sends none', async () => {
  const { dispatch, state } = harness({ capture: async () => descriptor });

  await dispatch(GATHER_ACTION_IDS.capture);

  assert.equal(state().status, PHOTO_CAPTURE_VIEWS.review);
  assert.deepEqual(state().image, image);
});

test('the host stays value-only — it never reshapes the surface', async () => {
  const { dispatch, runtime } = harness();
  const before = runtime.surface.componentsModel.get('root').properties.children.join(',');

  await dispatch(GATHER_ACTION_IDS.capture, { capture: descriptor });
  await dispatch(GATHER_ACTION_IDS.retake);

  const after = runtime.surface.componentsModel.get('root').properties.children.join(',');
  assert.equal(after, before, 'no updateComponents was sent');
  assert.equal(after, 'flow');
});

test('every view token the handler writes has a Flow View', () => {
  const flow = PHOTO_CAPTURE_DEFINITION.messages
    .find((message) => 'updateComponents' in message)
    .updateComponents.components.find((component) => component.component === 'Flow');

  for (const token of Object.values(PHOTO_CAPTURE_VIEWS)) {
    assert.ok(flow.views.some((entry) => entry.when === token), `no Flow View for '${token}'`);
  }
});
