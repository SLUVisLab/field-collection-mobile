import { CommonSchemas } from '@a2ui/web_core/v0_9/common-schemas';
import { z } from 'zod';
import {
  InstrumentError,
  MaskReview,
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

export const maskReviewApi = {
  name: GATHER_COMPONENT_IDS.maskReview,
  schema: z.object({
    phase: CommonSchemas.DynamicString,
    image: CommonSchemas.DynamicValue.optional(),
    segmentation: CommonSchemas.DynamicValue.optional(),
    classification: CommonSchemas.DynamicValue.optional(),
    result: CommonSchemas.DynamicValue.optional(),
    outputReview: CommonSchemas.DynamicValue.optional(),
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
  [GATHER_COMPONENT_IDS.maskReview]: {
    component: bindInstrumentComponent(maskReviewApi.schema, ({ phase, image, segmentation, result, outputReview, error, statePath, context }) => {
      const retake = () => context.dispatchAction(action(GATHER_ACTION_IDS.retake, statePath));
      if (phase === 'error') return <InstrumentError message={error} onRetake={retake} />;
      if (image && isProcessingPhase(phase)) return <ProcessingView image={image} phase={phase} />;
      if (phase === 'review-mask' && image && segmentation) {
        return (
          <MaskReview
            image={image}
            segmentation={segmentation}
            onAccept={() => context.dispatchAction(action(GATHER_ACTION_IDS.accept, statePath))}
            onRetake={retake}
          />
        );
      }
      if (phase === 'accepted' && result) {
        const primaryLabel = outputReview?.primaryActionLabel ?? 'Accept';
        const secondaryLabel = outputReview?.secondaryActionLabel ?? 'Retake';
        return (
          <OutputReview
            data={result}
            display={outputReview}
            primaryAction={{
              label: primaryLabel,
              onPress: () => context.dispatchAction(action(GATHER_ACTION_IDS.accept, statePath)),
              testID: 'segment-measure-accept-result',
            }}
            secondaryAction={secondaryLabel ? { label: secondaryLabel, onPress: retake, testID: 'segment-measure-retake' } : null}
          />
        );
      }
      return null;
    }),
  },
};
