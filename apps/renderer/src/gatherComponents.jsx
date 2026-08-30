import { createComponentImplementation } from '@a2ui/react/v0_9';
import { CommonSchemas } from '@a2ui/web_core/v0_9';
import { z } from 'zod';
import {
  InstrumentError,
  MaskReview as SharedMaskReview,
  OutputReview,
  ProcessingView,
  isProcessingPhase,
} from 'gather-components';

import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS } from 'gather-catalog';
import { CameraSurfaceWeb } from './CameraSurface.web.jsx';

const GatherCaptureApi = {
  name: GATHER_COMPONENT_IDS.capture,
  schema: z.object({
    phase: CommonSchemas.DynamicString.optional(),
    statePath: z.string().optional(),
  }).strict(),
};

const MaskReviewApi = {
  name: GATHER_COMPONENT_IDS.maskReview,
  schema: z.object({
    phase: CommonSchemas.DynamicString.optional(),
    image: CommonSchemas.DynamicValue.optional(),
    segmentation: CommonSchemas.DynamicValue.optional(),
    classification: CommonSchemas.DynamicValue.optional(),
    result: CommonSchemas.DynamicValue.optional(),
    outputReview: CommonSchemas.DynamicValue.optional(),
    error: CommonSchemas.DynamicString.optional(),
    statePath: z.string().optional(),
  }).strict(),
};

const action = (name, statePath, extra) => ({ event: { name, context: { statePath, ...extra } } });

const DEFAULT_STATE_PATH = '/gather';

// The A2UI binding wrapper is the only web-specific part: it resolves bound data
// and dispatches actions, then delegates all rendering to the shared components.
export const GatherCapture = createComponentImplementation(GatherCaptureApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  // Treat an unbound/empty phase (Composer authoring) as capture-ready so the
  // component is always visible; hide once a later phase is active.
  const phase = props.phase || 'capture';
  if (phase !== 'capture') return null;
  return (
    <CameraSurfaceWeb
      onCapture={(capture) => context.dispatchAction(action(GATHER_ACTION_IDS.capture, statePath, capture ? { capture } : undefined))}
    />
  );
});

export const MaskReview = createComponentImplementation(MaskReviewApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  const phase = props.phase || '';
  const retake = () => context.dispatchAction(action(GATHER_ACTION_IDS.retake, statePath));

  if (phase === 'error') return <InstrumentError message={props.error} onRetake={retake} />;
  if (props.image && isProcessingPhase(phase)) return <ProcessingView image={props.image} phase={phase} />;
  if (phase === 'review-mask' && props.image && props.segmentation) {
    return (
      <SharedMaskReview
        image={props.image}
        segmentation={props.segmentation}
        onAccept={() => context.dispatchAction(action(GATHER_ACTION_IDS.accept, statePath))}
        onRetake={retake}
      />
    );
  }
  if (phase === 'accepted' && props.result) {
    const primaryLabel = props.outputReview?.primaryActionLabel ?? 'Accept';
    const secondaryLabel = props.outputReview?.secondaryActionLabel ?? 'Retake';
    return (
      <OutputReview
        data={props.result}
        display={props.outputReview}
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
});
