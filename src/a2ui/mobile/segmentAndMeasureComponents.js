import { CommonSchemas } from '@a2ui/web_core/v0_9/common-schemas';
import { z } from 'zod';
import {
  ImageOverlay,
  InstrumentError,
  OutputReview,
  ProcessingView,
  isProcessingPhase,
} from 'gather-components';

import { SegmentAndMeasureCapture } from '../../components/scientific/SegmentAndMeasureViews.js';
import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS } from 'gather-catalog';

import { bindInstrumentComponent } from './InstrumentSurface.js';

export const gatherCaptureApi = {
  name: GATHER_COMPONENT_IDS.capture,
  schema: z.object({ phase: CommonSchemas.DynamicString, statePath: z.string() }).strict(),
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
    phase: CommonSchemas.DynamicString.optional(),
    image: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

export const instrumentErrorApi = {
  name: GATHER_COMPONENT_IDS.instrumentError,
  schema: z.object({
    phase: CommonSchemas.DynamicString.optional(),
    error: CommonSchemas.DynamicString.optional(),
    statePath: z.string(),
  }).strict(),
};

const action = (name, statePath, context) => ({ event: { name, context: { statePath, ...context } } });

export const segmentAndMeasureImplementations = {
  [GATHER_COMPONENT_IDS.capture]: {
    component: bindInstrumentComponent(gatherCaptureApi.schema, ({ phase, statePath, context }) => {
      if (phase !== 'capture') return null;
      return (
        <SegmentAndMeasureCapture
          onCapture={(capture) =>
            context.dispatchAction({ event: { name: GATHER_ACTION_IDS.capture, context: { statePath, capture } } })
          }
        />
      );
    }),
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
    component: bindInstrumentComponent(processingViewApi.schema, ({ phase, image }) => {
      if (!image || !isProcessingPhase(phase)) return null;
      return <ProcessingView image={image} phase={phase} />;
    }),
  },
  [GATHER_COMPONENT_IDS.instrumentError]: {
    component: bindInstrumentComponent(instrumentErrorApi.schema, ({ phase, error, statePath, context }) => {
      if (phase !== 'error') return null;
      const retake = () => context.dispatchAction(action(GATHER_ACTION_IDS.retake, statePath));
      return <InstrumentError message={error} onRetake={retake} />;
    }),
  },
};
