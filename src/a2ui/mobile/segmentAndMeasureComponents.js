import { CommonSchemas } from '@a2ui/web_core/v0_9/common-schemas';
import { z } from 'zod';
import {
  ImageOverlay,
  InstrumentError,
  OutputReview,
  ProcessingView,
} from 'gather-components';

import { SegmentAndMeasureCapture } from '../../components/scientific/SegmentAndMeasureViews.js';
import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS, resolveFlowView } from 'gather-catalog';

import { bindInstrumentComponent } from './InstrumentSurface.js';

// Flow: the data-driven View selector (the missing sibling of Basic Catalog
// `Tabs`). It renders the one child View whose `when` matches `current`.
// Presentation only — a host-side ToolFlowController decides which View is active.
export const flowApi = {
  name: GATHER_COMPONENT_IDS.flow,
  schema: z.object({
    current: CommonSchemas.DynamicString,
    views: z.array(z.object({ when: z.string(), view: z.string() }).strict()).min(1),
    fallback: z.string().optional(),
  }).strict(),
};

export const gatherCaptureApi = {
  name: GATHER_COMPONENT_IDS.capture,
  schema: z.object({ statePath: z.string() }).strict(),
};

export const imageOverlayApi = {
  name: GATHER_COMPONENT_IDS.imageOverlay,
  schema: z.object({
    image: CommonSchemas.DynamicValue.optional(),
    segmentation: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

export const outputReviewApi = {
  name: GATHER_COMPONENT_IDS.outputReview,
  schema: z.object({
    data: CommonSchemas.DynamicValue.optional(),
    display: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

export const processingViewApi = {
  name: GATHER_COMPONENT_IDS.processingView,
  schema: z.object({
    image: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

export const instrumentErrorApi = {
  name: GATHER_COMPONENT_IDS.instrumentError,
  schema: z.object({
    error: CommonSchemas.DynamicString.optional(),
    statePath: z.string(),
  }).strict(),
};

// Every Gather component API, for catalog registration.
export const gatherComponentApis = [
  flowApi,
  gatherCaptureApi,
  imageOverlayApi,
  outputReviewApi,
  processingViewApi,
  instrumentErrorApi,
];

const action = (name, statePath, context) => ({ event: { name, context: { statePath, ...context } } });

// Views are mounted only when `Flow` selects them, so the leaf components no
// longer self-hide by status — they render their content directly.
export const segmentAndMeasureImplementations = {
  [GATHER_COMPONENT_IDS.flow]: {
    component: bindInstrumentComponent(flowApi.schema, ({ current, views, fallback, buildChild }) => {
      const view = resolveFlowView({ current, views, fallback });
      return view ? buildChild(view) : null;
    }),
  },
  [GATHER_COMPONENT_IDS.capture]: {
    component: bindInstrumentComponent(gatherCaptureApi.schema, ({ statePath, context }) => (
      <SegmentAndMeasureCapture
        onCapture={(capture) =>
          context.dispatchAction({ event: { name: GATHER_ACTION_IDS.capture, context: { statePath, capture } } })
        }
      />
    )),
  },
  [GATHER_COMPONENT_IDS.imageOverlay]: {
    component: bindInstrumentComponent(imageOverlayApi.schema, ({ image, segmentation }) => {
      if (!image?.uri) return null;
      return <ImageOverlay image={image} overlay={segmentation?.mask ?? null} />;
    }),
  },
  [GATHER_COMPONENT_IDS.outputReview]: {
    component: bindInstrumentComponent(outputReviewApi.schema, ({ data, display }) => {
      if (!data) return null;
      return <OutputReview data={data} display={display} />;
    }),
  },
  [GATHER_COMPONENT_IDS.processingView]: {
    component: bindInstrumentComponent(processingViewApi.schema, ({ image }) => (
      <ProcessingView image={image} />
    )),
  },
  [GATHER_COMPONENT_IDS.instrumentError]: {
    component: bindInstrumentComponent(instrumentErrorApi.schema, ({ error, statePath, context }) => {
      const retake = () => context.dispatchAction(action(GATHER_ACTION_IDS.retake, statePath));
      return <InstrumentError message={error} onRetake={retake} />;
    }),
  },
};
