import { GATHER_ACTION_IDS, GATHER_CATALOG_ID, GATHER_COMPONENT_IDS } from '../../../packages/gather-catalog/src/index.js';

/**
 * Photo Capture — an A2UI definition used as a **runtime fixture**.
 *
 * This is deterministic test material, not a shipped product concept. It exists
 * to exercise the generic A2UI runtime (`createA2uiRuntime` / `A2UIHost`,
 * `Flow`, `FlowController`, the action seam) end to end without a device.
 *
 * Ordinary single-photo capture is **not** an architectural species: in
 * production a photo field uses the `CameraView` Component directly (see
 * `XFormsImageControl`). Nothing here should be read as canonizing "Photo
 * Capture" as a Tool.
 *
 * Structure:
 *
 * ```text
 * Flow
 * ├── View: capture      CameraView                    (Component owns acquisition)
 * ├── View: working      ProcessingView                (durable asset being written)
 * ├── View: review       Basic Image + Accept/Retake   (upstream vocabulary)
 * └── View: error        InstrumentError
 * ```
 *
 * Boundaries it demonstrates:
 *
 * - **No `camera.*` capability.** Acquisition is Component-owned (Phase 3);
 *   `CameraView` emits a plain local capture descriptor and the composition's
 *   handler turns it into a durable `ImageAsset`.
 * - **Review uses the upstream Basic Catalog `Image`**, not a Gather preview
 *   component — the mobile renderer implements upstream vocabulary rather than
 *   Gather inventing a substitute for it.
 * - **The host is value-only.** Transitions are ordinary button actions; the
 *   controller writes `status` and never sends `updateComponents`.
 *
 * The typed result is a single `ImageAsset`, delivered through the host's
 * completion seam on Accept.
 */

/** The view tokens this composition moves through; `Flow` maps them onto Views. */
export const PHOTO_CAPTURE_VIEWS = Object.freeze({
  capture: 'capture',
  persisting: 'persisting-capture',
  review: 'review',
  error: 'error',
});

const STATE_PATH = '/gather';
const SURFACE_ID = 'photo-capture';

export const PHOTO_CAPTURE_DEFINITION = Object.freeze({
  id: 'gather.photo-capture',
  revision: '0.1.0',
  title: 'Photo Capture',
  description: 'Capture a single photo, review it, and accept or retake.',
  catalogId: GATHER_CATALOG_ID,
  surfaceId: SURFACE_ID,
  statePath: STATE_PATH,
  /** The composition completes with one durable ImageAsset. */
  result: Object.freeze({ kind: 'ImageAsset' }),
  messages: Object.freeze([
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: SURFACE_ID,
        catalogId: GATHER_CATALOG_ID,
        sendDataModel: true,
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'root', component: 'Column', children: ['flow'] },

          {
            id: 'flow',
            component: GATHER_COMPONENT_IDS.flow,
            current: { path: '/gather/status' },
            fallback: 'captureView',
            views: [
              { when: PHOTO_CAPTURE_VIEWS.capture, view: 'captureView' },
              { when: PHOTO_CAPTURE_VIEWS.persisting, view: 'processingView' },
              { when: PHOTO_CAPTURE_VIEWS.review, view: 'reviewView' },
              { when: PHOTO_CAPTURE_VIEWS.error, view: 'errorView' },
            ],
          },

          // View: capture — the camera owns its own shutter and controls.
          { id: 'captureView', component: 'Column', children: ['camera'] },
          { id: 'camera', component: GATHER_COMPONENT_IDS.cameraView, statePath: STATE_PATH },

          // View: working — the capture is being written to durable storage.
          { id: 'processingView', component: 'Column', children: ['processing'] },
          { id: 'processing', component: GATHER_COMPONENT_IDS.processingView, image: { path: '/gather/image' } },

          // View: review — upstream Basic Catalog Image, then Accept / Retake.
          {
            id: 'reviewView',
            component: 'Column',
            children: ['reviewTitle', 'photo', 'acceptButton', 'retakeButton'],
          },
          { id: 'reviewTitle', component: 'Text', text: 'Review photo', variant: 'h3' },
          {
            id: 'photo',
            component: 'Image',
            url: { path: '/gather/image/uri' },
            description: 'The photo you just captured.',
            fit: 'contain',
          },
          {
            id: 'acceptButton',
            component: 'Button',
            variant: 'primary',
            child: 'acceptLabel',
            action: { event: { name: GATHER_ACTION_IDS.accept, context: { statePath: STATE_PATH } } },
          },
          { id: 'acceptLabel', component: 'Text', text: 'Use this photo', variant: 'body' },
          {
            id: 'retakeButton',
            component: 'Button',
            child: 'retakeLabel',
            action: { event: { name: GATHER_ACTION_IDS.retake, context: { statePath: STATE_PATH } } },
          },
          { id: 'retakeLabel', component: 'Text', text: 'Retake', variant: 'body' },

          // View: error — renders its own message and retake affordance.
          { id: 'errorView', component: 'Column', children: ['error'] },
          {
            id: 'error',
            component: GATHER_COMPONENT_IDS.instrumentError,
            error: { path: '/gather/error' },
            statePath: STATE_PATH,
          },
        ],
      },
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: SURFACE_ID,
        path: STATE_PATH,
        value: {
          status: PHOTO_CAPTURE_VIEWS.capture,
          image: null,
          error: null,
        },
      },
    },
  ]),
  hostActions: Object.freeze([
    GATHER_ACTION_IDS.capture,
    GATHER_ACTION_IDS.accept,
    GATHER_ACTION_IDS.retake,
  ]),
});
