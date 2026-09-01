import { createComponentImplementation } from '@a2ui/react/v0_9';
import { CommonSchemas } from '@a2ui/web_core/v0_9';
import { z } from 'zod';
import {
  ImageOverlay,
  InstrumentError,
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

const PhaseViewApi = {
  name: GATHER_COMPONENT_IDS.phaseView,
  schema: z.object({
    phase: CommonSchemas.DynamicString.optional(),
    when: z.array(z.string()).min(1),
    child: CommonSchemas.ComponentId,
  }).strict(),
};

const ImageOverlayApi = {
  name: GATHER_COMPONENT_IDS.imageOverlay,
  schema: z.object({
    image: CommonSchemas.DynamicValue.optional(),
    segmentation: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

const OutputReviewApi = {
  name: GATHER_COMPONENT_IDS.outputReview,
  schema: z.object({
    data: CommonSchemas.DynamicValue.optional(),
    display: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

const ProcessingViewApi = {
  name: GATHER_COMPONENT_IDS.processingView,
  schema: z.object({
    phase: CommonSchemas.DynamicString.optional(),
    image: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

const InstrumentErrorApi = {
  name: GATHER_COMPONENT_IDS.instrumentError,
  schema: z.object({
    phase: CommonSchemas.DynamicString.optional(),
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

export const PhaseView = createComponentImplementation(PhaseViewApi, ({ props, buildChild }) => {
  const phase = props.phase || '';
  return props.when.includes(phase) ? buildChild(props.child) : null;
});

export const GatherImageOverlay = createComponentImplementation(ImageOverlayApi, ({ props }) => {
  if (!props.image?.uri) return null;
  return <ImageOverlay image={props.image} overlay={props.segmentation?.mask ?? null} />;
});

export const GatherOutputReview = createComponentImplementation(OutputReviewApi, ({ props }) => {
  if (!props.data) return null;
  return <OutputReview data={props.data} display={props.display} />;
});

export const GatherProcessingView = createComponentImplementation(ProcessingViewApi, ({ props }) => {
  const phase = props.phase || '';
  if (!props.image || !isProcessingPhase(phase)) return null;
  return <ProcessingView image={props.image} phase={phase} />;
});

export const GatherInstrumentError = createComponentImplementation(InstrumentErrorApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  const phase = props.phase || '';
  const retake = () => context.dispatchAction(action(GATHER_ACTION_IDS.retake, statePath));

  if (phase === 'error') return <InstrumentError message={props.error} onRetake={retake} />;
  return null;
});
