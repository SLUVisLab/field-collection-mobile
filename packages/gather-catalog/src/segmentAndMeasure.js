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
 * Phase presentation contract.
 *
 * The instrument renders ONE stable component tree; phases vary values, never
 * structure (see docs/a2ui-v1.0-migration-notes.md). A2UI has no conditional
 * rendering primitive in v0.9 or v1.0, so every phase must be expressible as
 * bound data: status copy, action labels, and action availability.
 *
 * `Button.action.event.name` is a static string in the A2UI schema, so the tree
 * declares one `advance` and one `back` action and the host resolves what they
 * mean from the current phase. Availability is expressed with `checks`, which
 * upstream `GenericBinder` turns into the `isValid` flag the Button binding maps
 * to its disabled state.
 */
export const SEGMENT_AND_MEASURE_PRESENTATION = Object.freeze({
  capture: {
    statusText: 'Frame the specimen, then tap the shutter.',
    primaryLabel: 'Accept Mask',
    secondaryLabel: 'Retake',
    canAdvance: false,
    canGoBack: false,
  },
  'persisting-capture': {
    statusText: 'Saving capture…',
    primaryLabel: 'Accept Mask',
    secondaryLabel: 'Retake',
    canAdvance: false,
    canGoBack: false,
  },
  segmenting: {
    statusText: 'Finding the specimen…',
    primaryLabel: 'Accept Mask',
    secondaryLabel: 'Retake',
    canAdvance: false,
    canGoBack: false,
  },
  classifying: {
    statusText: 'Classifying the specimen…',
    primaryLabel: 'Accept Mask',
    secondaryLabel: 'Retake',
    canAdvance: false,
    canGoBack: false,
  },
  measuring: {
    statusText: 'Measuring the accepted mask…',
    primaryLabel: 'Accept Mask',
    secondaryLabel: 'Retake',
    canAdvance: false,
    canGoBack: false,
  },
  'review-mask': {
    statusText: 'Confirm the overlay follows the specimen edge.',
    primaryLabel: 'Accept Mask',
    secondaryLabel: 'Retake',
    canAdvance: true,
    canGoBack: true,
  },
  accepted: {
    statusText: 'Analysis is ready to include in this observation.',
    primaryLabel: 'Done',
    secondaryLabel: 'Retake',
    canAdvance: true,
    canGoBack: true,
  },
  error: {
    statusText: 'The capability could not complete.',
    primaryLabel: 'Accept Mask',
    secondaryLabel: 'Retake',
    canAdvance: false,
    canGoBack: true,
  },
});

/** Resolves the bound presentation values for a phase, defaulting to `capture`. */
export const segmentAndMeasurePresentation = (phase) =>
  SEGMENT_AND_MEASURE_PRESENTATION[phase] ?? SEGMENT_AND_MEASURE_PRESENTATION.capture;

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
          {
            id: 'root',
            component: 'Column',
            children: [
              'title',
              'subtitle',
              'capture',
              'processing',
              'imageOverlay',
              'status',
              'error',
              'outputReview',
              'primaryAction',
              'secondaryAction',
            ],
          },
          { id: 'title', component: 'Text', text: 'Segment & Measure', variant: 'h2' },
          { id: 'subtitle', component: 'Text', text: 'Generic image measurements', variant: 'caption' },
          {
            id: 'capture',
            component: GATHER_COMPONENT_IDS.capture,
            phase: { path: '/gather/phase' },
            statePath: '/gather',
          },
          {
            id: 'processing',
            component: GATHER_COMPONENT_IDS.processingView,
            phase: { path: '/gather/phase' },
            image: { path: '/gather/image' },
          },
          {
            id: 'imageOverlay',
            component: GATHER_COMPONENT_IDS.imageOverlay,
            image: { path: '/gather/image' },
            segmentation: { path: '/gather/segmentation' },
          },
          { id: 'status', component: 'Text', text: { path: '/gather/statusText' }, variant: 'caption' },
          {
            id: 'error',
            component: GATHER_COMPONENT_IDS.instrumentError,
            phase: { path: '/gather/phase' },
            error: { path: '/gather/error' },
            statePath: '/gather',
          },
          {
            id: 'outputReview',
            component: GATHER_COMPONENT_IDS.outputReview,
            data: { path: '/gather/result' },
            display: { path: '/gather/outputReview' },
          },
          {
            id: 'primaryAction',
            component: 'Button',
            variant: 'primary',
            child: 'primaryActionLabel',
            action: { event: { name: GATHER_ACTION_IDS.advance, context: { statePath: '/gather' } } },
            checks: [{ condition: { path: '/gather/canAdvance' }, message: 'Not available in this phase.' }],
          },
          { id: 'primaryActionLabel', component: 'Text', text: { path: '/gather/primaryLabel' }, variant: 'body' },
          {
            id: 'secondaryAction',
            component: 'Button',
            child: 'secondaryActionLabel',
            action: { event: { name: GATHER_ACTION_IDS.back, context: { statePath: '/gather' } } },
            checks: [{ condition: { path: '/gather/canGoBack' }, message: 'Not available in this phase.' }],
          },
          { id: 'secondaryActionLabel', component: 'Text', text: { path: '/gather/secondaryLabel' }, variant: 'body' },
        ],
      },
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: 'segment-and-measure',
        path: '/gather',
        value: {
          phase: 'capture',
          image: null,
          segmentation: null,
          classification: null,
          result: null,
          outputReview: SEGMENT_AND_MEASURE_OUTPUT_REVIEW,
          error: null,
          ...SEGMENT_AND_MEASURE_PRESENTATION.capture,
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
    GATHER_ACTION_IDS.advance,
    GATHER_ACTION_IDS.back,
  ]),
});
