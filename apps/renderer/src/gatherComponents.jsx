import { createComponentImplementation } from '@a2ui/react/v0_9';
import { CommonSchemas } from '@a2ui/web_core/v0_9';
import { z } from 'zod';
import {
  ImageOverlay,
  InstrumentError,
  OutputReview,
  ProcessingView,
} from 'gather-components';

import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS, resolveFlowView } from 'gather-catalog';
import { CameraSurfaceWeb } from './CameraSurface.web.jsx';

const FlowApi = {
  name: GATHER_COMPONENT_IDS.flow,
  schema: z.object({
    current: CommonSchemas.DynamicString.optional(),
    views: z.array(z.object({ when: z.string(), view: z.string() }).strict()).min(1),
    fallback: z.string().optional(),
  }).strict(),
};

const GatherCaptureApi = {
  name: GATHER_COMPONENT_IDS.capture,
  schema: z.object({
    statePath: z.string().optional(),
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
    image: CommonSchemas.DynamicValue.optional(),
  }).strict(),
};

const InstrumentErrorApi = {
  name: GATHER_COMPONENT_IDS.instrumentError,
  schema: z.object({
    error: CommonSchemas.DynamicString.optional(),
    statePath: z.string().optional(),
  }).strict(),
};

const action = (name, statePath, extra) => ({ event: { name, context: { statePath, ...extra } } });

const DEFAULT_STATE_PATH = '/gather';

// Flow: renders the one child View whose `when` matches `current`. The data-driven
// sibling of Basic Catalog `Tabs`. Presentation only — the active View is chosen
// by a host-side ToolFlowController.
export const Flow = createComponentImplementation(FlowApi, ({ props, buildChild }) => {
  const view = resolveFlowView(props);
  return view ? buildChild(view) : null;
});

// The A2UI binding wrapper is the only web-specific part: it resolves bound data
// and dispatches actions, then delegates all rendering to the shared components.
export const GatherCapture = createComponentImplementation(GatherCaptureApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  return (
    <CameraSurfaceWeb
      onCapture={(capture) => context.dispatchAction(action(GATHER_ACTION_IDS.capture, statePath, capture ? { capture } : undefined))}
    />
  );
});

export const GatherImageOverlay = createComponentImplementation(ImageOverlayApi, ({ props }) => {
  if (!props.image?.uri) return null;
  return <ImageOverlay image={props.image} overlay={props.segmentation?.mask ?? null} />;
});

export const GatherOutputReview = createComponentImplementation(OutputReviewApi, ({ props }) => {
  if (!props.data) return null;
  return <OutputReview data={props.data} display={props.display} />;
});

export const GatherProcessingView = createComponentImplementation(ProcessingViewApi, ({ props }) => (
  <ProcessingView image={props.image} />
));

export const GatherInstrumentError = createComponentImplementation(InstrumentErrorApi, ({ props, context }) => {
  const statePath = props.statePath || DEFAULT_STATE_PATH;
  const retake = () => context.dispatchAction(action(GATHER_ACTION_IDS.retake, statePath));
  return <InstrumentError message={props.error} onRetake={retake} />;
});
