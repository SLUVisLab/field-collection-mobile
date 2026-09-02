import {
  CameraView,
  ImageOverlay,
  InstrumentError,
  OutputReview,
  ProcessingView,
} from 'gather-components';

import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS, resolveFlowView } from 'gather-catalog';

import { bindInstrumentComponent } from './InstrumentSurface.js';
import {
  cameraViewApi,
  flowApi,
  imageOverlayApi,
  instrumentErrorApi,
  outputReviewApi,
  processingViewApi,
} from './componentApis.js';

/**
 * Mobile renderer implementations of the **Gather** Composer-visible components.
 *
 * These are the Gather-defined vocabulary (package-owned presentation in
 * `gather-components`, declared in `gather-catalog`); the upstream A2UI Basic
 * Catalog lives in `basicCatalog.js`. Any Tool can register these — nothing here
 * is specific to one Tool.
 */

const action = (name, statePath, context) => ({ event: { name, context: { statePath, ...context } } });

export const gatherComponentImplementations = {
  [GATHER_COMPONENT_IDS.flow]: {
    component: bindInstrumentComponent(flowApi.schema, ({ current, views, fallback, buildChild }) => {
      const view = resolveFlowView({ current, views, fallback });
      return view ? buildChild(view) : null;
    }),
  },
  [GATHER_COMPONENT_IDS.cameraView]: {
    component: bindInstrumentComponent(cameraViewApi.schema, ({ statePath, context }) => (
      <CameraView
        onCapture={(capture) =>
          context.dispatchAction(action(GATHER_ACTION_IDS.capture, statePath, { capture }))
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
