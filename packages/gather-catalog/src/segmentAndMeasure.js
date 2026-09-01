import { GATHER_ACTION_IDS, GATHER_CATALOG_ID, GATHER_COMPONENT_IDS } from './identifiers.js';

const SEGMENT_AND_MEASURE_OUTPUT_REVIEW = Object.freeze({
  title: 'Result accepted',
  description: 'Analysis is ready to include in this observation.',
  sections: [
    { id: 'measurements', label: 'Measurements', order: 1 },
    { id: 'classification', label: 'Classification', order: 2 },
    { id: 'assets', label: 'Assets', order: 3 },
  ],
  fields: [
    {
      path: 'measurements.area.value',
      label: 'Area',
      format: 'quantity',
      unitPath: 'measurements.area.unit',
      section: 'measurements',
      decimals: 2,
      order: 1,
    },
    {
      path: 'measurements.perimeter.value',
      label: 'Perimeter',
      format: 'quantity',
      unitPath: 'measurements.perimeter.unit',
      section: 'measurements',
      decimals: 2,
      order: 2,
    },
    {
      path: 'measurements.boundingBox.width',
      label: 'Bounds width',
      format: 'quantity',
      unitPath: 'measurements.boundingBox.unit',
      section: 'measurements',
      decimals: 2,
      order: 3,
    },
    {
      path: 'measurements.boundingBox.height',
      label: 'Bounds height',
      format: 'quantity',
      unitPath: 'measurements.boundingBox.unit',
      section: 'measurements',
      decimals: 2,
      order: 4,
    },
    {
      path: 'measurements.sharpness.score',
      label: 'Sharpness',
      format: 'number',
      section: 'measurements',
      decimals: 2,
      order: 5,
    },
    {
      path: 'classification.ranked',
      label: 'Top labels',
      format: 'array',
      section: 'classification',
      order: 1,
      maxItems: 3,
      itemLabelPath: 'label',
      itemValuePath: 'score',
      itemValueFormat: 'percentage',
      itemValueScale: 'fraction',
      itemValueDecimals: 1,
      emptyText: 'Classification not run',
    },
    {
      path: 'segmentation.model.id',
      label: 'Segmentation model',
      format: 'string',
      section: 'assets',
      order: 1,
      emptyText: 'Segmentation completed',
    },
    {
      path: 'image',
      label: 'Captured image',
      format: 'asset',
      section: 'assets',
      order: 2,
      emptyText: 'Image summary unavailable',
    },
    {
      path: 'segmentation.mask',
      label: 'Mask asset',
      format: 'asset',
      section: 'assets',
      order: 3,
      emptyText: 'Mask summary unavailable',
    },
  ],
});

/**
 * Segment & Measure is an in-instrument micro-flow: capture → working → review →
 * summary (plus error). It composes one general `Flow` component — a data-driven
 * view selector, the missing sibling of Basic Catalog `Tabs` — that renders the
 * view whose `when` matches `/gather/status`. Transitions are ordinary actions: a
 * button dispatches a capability action, the host writes the next `status`, and
 * `Flow` reflects it. The host is value-only; it never sends `updateComponents`.
 */
/**
 * The view tokens Segment & Measure moves through. The `Flow` table below maps
 * them onto Views (several working tokens share `processingView`), and the
 * host-side ToolFlowController writes exactly these values — sharing the
 * constant keeps the authored table and the controller from drifting apart.
 */
export const SEGMENT_AND_MEASURE_VIEWS = Object.freeze({
  capture: 'capture',
  persisting: 'persisting-capture',
  segmenting: 'segmenting',
  classifying: 'classifying',
  measuring: 'measuring',
  review: 'review-mask',
  accepted: 'accepted',
  error: 'error',
});

export const SEGMENT_AND_MEASURE_INSTRUMENT = Object.freeze({
  id: 'gather.segment-and-measure',
  revision: '0.1.0',
  catalogId: GATHER_CATALOG_ID,
  surfaceId: 'segment-and-measure',
  messages: Object.freeze([
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'segment-and-measure',
        catalogId: GATHER_CATALOG_ID,
        sendDataModel: true,
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'segment-and-measure',
        components: [
          { id: 'root', component: 'Column', children: ['flow'] },

          // The whole flow: one data-driven selector renders the view whose
          // `when` matches /gather/status. Several working statuses share one View.
          {
            id: 'flow',
            component: GATHER_COMPONENT_IDS.flow,
            current: { path: '/gather/status' },
            fallback: 'captureView',
            views: [
              { when: SEGMENT_AND_MEASURE_VIEWS.capture, view: 'captureView' },
              { when: SEGMENT_AND_MEASURE_VIEWS.persisting, view: 'processingView' },
              { when: SEGMENT_AND_MEASURE_VIEWS.segmenting, view: 'processingView' },
              { when: SEGMENT_AND_MEASURE_VIEWS.classifying, view: 'processingView' },
              { when: SEGMENT_AND_MEASURE_VIEWS.measuring, view: 'processingView' },
              { when: SEGMENT_AND_MEASURE_VIEWS.review, view: 'reviewView' },
              { when: SEGMENT_AND_MEASURE_VIEWS.accepted, view: 'summaryView' },
              { when: SEGMENT_AND_MEASURE_VIEWS.error, view: 'errorView' },
            ],
          },

          // View: capture — pure camera.
          { id: 'captureView', component: 'Column', children: ['capture'] },
          { id: 'capture', component: GATHER_COMPONENT_IDS.capture, statePath: '/gather' },

          // View: working — captured still + progress copy.
          { id: 'processingView', component: 'Column', children: ['processing'] },
          { id: 'processing', component: GATHER_COMPONENT_IDS.processingView, image: { path: '/gather/image' } },

          // View: review — image + proposed mask, then Accept Mask / Retake.
          {
            id: 'reviewView',
            component: 'Column',
            children: ['reviewTitle', 'reviewBody', 'imageOverlay', 'acceptMaskButton', 'reviewRetakeButton'],
          },
          { id: 'reviewTitle', component: 'Text', text: 'Review segmentation', variant: 'h3' },
          {
            id: 'reviewBody',
            component: 'Text',
            text: 'Confirm the overlay follows the specimen edge.',
            variant: 'caption',
          },
          {
            id: 'imageOverlay',
            component: GATHER_COMPONENT_IDS.imageOverlay,
            image: { path: '/gather/image' },
            segmentation: { path: '/gather/segmentation' },
          },
          {
            id: 'acceptMaskButton',
            component: 'Button',
            variant: 'primary',
            child: 'acceptMaskLabel',
            action: { event: { name: GATHER_ACTION_IDS.accept, context: { statePath: '/gather' } } },
          },
          { id: 'acceptMaskLabel', component: 'Text', text: 'Accept Mask', variant: 'body' },
          {
            id: 'reviewRetakeButton',
            component: 'Button',
            child: 'reviewRetakeLabel',
            action: { event: { name: GATHER_ACTION_IDS.retake, context: { statePath: '/gather' } } },
          },
          { id: 'reviewRetakeLabel', component: 'Text', text: 'Retake', variant: 'body' },

          // View: summary — typed result, then Done (commit) / Retake.
          {
            id: 'summaryView',
            component: 'Column',
            children: ['outputReview', 'submitButton', 'summaryRetakeButton'],
          },
          {
            id: 'outputReview',
            component: GATHER_COMPONENT_IDS.outputReview,
            data: { path: '/gather/result' },
            display: { path: '/gather/outputReview' },
          },
          {
            id: 'submitButton',
            component: 'Button',
            variant: 'primary',
            child: 'submitLabel',
            action: { event: { name: GATHER_ACTION_IDS.submit, context: { statePath: '/gather' } } },
          },
          { id: 'submitLabel', component: 'Text', text: 'Done', variant: 'body' },
          {
            id: 'summaryRetakeButton',
            component: 'Button',
            child: 'summaryRetakeLabel',
            action: { event: { name: GATHER_ACTION_IDS.retake, context: { statePath: '/gather' } } },
          },
          { id: 'summaryRetakeLabel', component: 'Text', text: 'Retake', variant: 'body' },

          // View: error — InstrumentError renders its own message + Retake.
          { id: 'errorView', component: 'Column', children: ['error'] },
          {
            id: 'error',
            component: GATHER_COMPONENT_IDS.instrumentError,
            error: { path: '/gather/error' },
            statePath: '/gather',
          },
        ],
      },
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: 'segment-and-measure',
        path: '/gather',
        value: {
          status: 'capture',
          image: null,
          segmentation: null,
          classification: null,
          result: null,
          outputReview: SEGMENT_AND_MEASURE_OUTPUT_REVIEW,
          error: null,
        },
      },
    },
  ]),
  hostActions: Object.freeze([
    GATHER_ACTION_IDS.capture,
    GATHER_ACTION_IDS.segment,
    GATHER_ACTION_IDS.classify,
    GATHER_ACTION_IDS.accept,
    GATHER_ACTION_IDS.retake,
    GATHER_ACTION_IDS.submit,
  ]),
});
