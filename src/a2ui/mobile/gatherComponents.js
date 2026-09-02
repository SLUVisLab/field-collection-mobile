import {
  CameraView,
  ImageOverlay,
  MediaGallery,
  MultiImageCapture,
  InstrumentError,
  OutputReview,
  ProcessingView,
} from 'gather-components';

import { GATHER_ACTION_IDS, GATHER_COMPONENT_IDS, resolveFlowView } from 'gather-catalog';

import { bindInstrumentComponent } from './InstrumentSurface.js';
import {
  cameraViewApi,
  flowApi,
  mediaGalleryApi,
  multiImageCaptureApi,
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
  [GATHER_COMPONENT_IDS.mediaGallery]: {
    component: bindInstrumentComponent(mediaGalleryApi.schema, ({ items, statePath, allowSelect, allowRemove, allowReorder, columns, context }) => (
      <MediaGallery
        items={Array.isArray(items) ? items : []}
        allowSelect={allowSelect ?? false}
        allowRemove={allowRemove ?? false}
        allowReorder={allowReorder ?? false}
        columns={columns ?? 3}
        onRemove={(_item, index) =>
          context.dispatchAction(action(GATHER_ACTION_IDS.mediaChanged, statePath, { index, change: 'remove' }))
        }
        onReorder={(next) => context.dispatchAction(action(GATHER_ACTION_IDS.mediaChanged, statePath, { items: next, change: 'reorder' }))}
        onSelect={(item, index) => context.dispatchAction(action(GATHER_ACTION_IDS.mediaSelected, statePath, { index }))}
        onBack={() => context.dispatchAction(action(GATHER_ACTION_IDS.mediaBack, statePath))}
        onDone={() => context.dispatchAction(action(GATHER_ACTION_IDS.mediaDone, statePath))}
      />
    )),
  },
  [GATHER_COMPONENT_IDS.multiImageCapture]: {
    component: bindInstrumentComponent(multiImageCaptureApi.schema, ({ value, statePath, minItems, maxItems, allowRemove, allowReorder, context }) => (
      <MultiImageCapture
        value={Array.isArray(value) ? value : []}
        minItems={minItems ?? 0}
        maxItems={maxItems ?? null}
        allowRemove={allowRemove ?? true}
        allowReorder={allowReorder ?? false}
        // The component never persists: it hands over the plain descriptor and
        // the host materializes the ImageAsset and appends it.
        onCapture={(capture) => context.dispatchAction(action(GATHER_ACTION_IDS.mediaCaptured, statePath, { capture }))}
        onChange={(next) => context.dispatchAction(action(GATHER_ACTION_IDS.mediaChanged, statePath, { items: next, change: 'set' }))}
        onDone={() => context.dispatchAction(action(GATHER_ACTION_IDS.mediaDone, statePath))}
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
