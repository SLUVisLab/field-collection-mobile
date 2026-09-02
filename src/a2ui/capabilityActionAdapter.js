import { createSegmentAndMeasureResult } from '../scientific/workflows/segmentAndMeasure.js';

import { GATHER_ACTION_IDS, SEGMENT_AND_MEASURE_VIEWS } from 'gather-catalog';

import { createFlowController } from './flowController.js';

const DEFAULT_STATE_PATH = '/gather';

const actionErrorMessage = (error, fallback) =>
  error instanceof Error && error.message ? error.message : fallback;

const surfaceFor = (processor, surfaceId) => {
  const surface = processor?.model?.getSurface(surfaceId);
  if (!surface) throw new Error(`A2UI surface '${surfaceId}' is unavailable.`);
  return surface;
};

const statePathFor = (context) =>
  typeof context?.statePath === 'string' && context.statePath.startsWith('/')
    ? context.statePath
    : DEFAULT_STATE_PATH;

const requireValue = (value, message) => {
  if (!value) throw new Error(message);
  return value;
};

/**
 * Builds the Segment & Measure flow controller bound to one surface/state path.
 *
 * The handlers below are the *only* place view transitions are decided.
 * Capabilities perform operations and return results; the controller decides
 * what is shown next and writes the active view token to `<statePath>/status`,
 * which the instrument's `Flow` binds. Presentation components never transition.
 *
 * The controller is created per dispatch and seeded from the durable status,
 * because a `Flow`-bound token has to live in the surface data model — that
 * makes the data model the store and the controller the decider, with no cached
 * copy to drift.
 */
const createSegmentAndMeasureFlow = ({ surface, statePath, surfaceId, capabilities, onAcceptedResult }) => {
  const state = () => surface.dataModel.get(statePath) ?? {};

  /** Merges capability results into the data model without touching `status`. */
  const setData = (patch) => {
    const next = { ...state(), ...patch };
    surface.dataModel.set(statePath, next);
    return next;
  };

  const controller = createFlowController({
    initialView: SEGMENT_AND_MEASURE_VIEWS.capture,
    startView: state().status,
    onViewChange: (view) => {
      surface.dataModel.set(statePath, { ...state(), status: view });
    },
    handlers: {
      [GATHER_ACTION_IDS.capture]: async ({ context }, flow) => {
        const capture = requireValue(
          context.capture ?? await capabilities.capture?.(),
          'Camera capture did not produce a local image.'
        );
        setData({ image: null, segmentation: null, classification: null, result: null, error: null });
        flow.setView(SEGMENT_AND_MEASURE_VIEWS.persisting);
        const image = await capabilities.persistScientificCapture(capture);
        setData({ image });
        flow.setView(SEGMENT_AND_MEASURE_VIEWS.segmenting);
        const segmentation = await capabilities.segmentScientificImage({ image });
        setData({ segmentation });
        flow.setView(SEGMENT_AND_MEASURE_VIEWS.review);
        return state();
      },

      [GATHER_ACTION_IDS.segment]: async ({ context }, flow) => {
        const image = requireValue(context.image ?? state().image, 'Capture an image before segmenting.');
        setData({ error: null });
        flow.setView(SEGMENT_AND_MEASURE_VIEWS.segmenting);
        const segmentation = await capabilities.segmentScientificImage({ image });
        setData({ segmentation });
        flow.setView(SEGMENT_AND_MEASURE_VIEWS.review);
        return state();
      },

      [GATHER_ACTION_IDS.classify]: async ({ context }, flow) => {
        const image = requireValue(context.image ?? state().image, 'Capture an image before classifying.');
        setData({ error: null });
        flow.setView(SEGMENT_AND_MEASURE_VIEWS.classifying);
        const classification = await capabilities.classifyScientificImage({ image });
        setData({ classification });
        flow.setView(SEGMENT_AND_MEASURE_VIEWS.review);
        return state();
      },

      [GATHER_ACTION_IDS.accept]: async (_payload, flow) => {
        const current = state();
        if (current.status === SEGMENT_AND_MEASURE_VIEWS.accepted && current.result) return current.result;
        const image = requireValue(current.image, 'Capture an image before accepting a mask.');
        const segmentation = requireValue(current.segmentation, 'Segment an image before accepting a mask.');
        setData({ error: null });
        flow.setView(SEGMENT_AND_MEASURE_VIEWS.measuring);
        const classificationPromise = current.classification
          ? Promise.resolve(current.classification)
          : capabilities.classifyScientificImage({ image });
        const [maskMeasurements, imageMeasurements, classification] = await Promise.all([
          capabilities.measureScientificMask({ mask: segmentation.mask }),
          capabilities.measureScientificImage({ image, mask: segmentation.mask }),
          classificationPromise,
        ]);
        const result = createSegmentAndMeasureResult({
          image,
          segmentation,
          maskMeasurements,
          imageMeasurements,
          classification,
        });
        setData({ classification, result });
        flow.setView(SEGMENT_AND_MEASURE_VIEWS.accepted);
        return result;
      },

      [GATHER_ACTION_IDS.retake]: async (_payload, flow) => {
        setData({ image: null, segmentation: null, classification: null, result: null, error: null });
        flow.reset();
        return state();
      },

      // Summary-view commit. The typed result is delivered here — the explicit
      // user gesture — rather than on entering `accepted`, so a caller-provided
      // `onAcceptedResult` is the seam for future instance/XForms persistence.
      [GATHER_ACTION_IDS.submit]: async () => {
        const current = state();
        if (current.status === SEGMENT_AND_MEASURE_VIEWS.accepted && current.result) {
          await onAcceptedResult?.(current.result, { surfaceId, statePath });
          return current.result;
        }
        return undefined;
      },
    },
  });

  return { controller, state, setData };
};

/**
 * Handles long-running Gather capabilities from ordinary A2UI event actions.
 * A2UI stays the protocol/state engine; only serializable capability state
 * reaches the surface data model.
 *
 * The host is value-only: it writes `<statePath>/status` and never sends
 * `updateComponents`. Advancing the flow is a data write, and the instrument's
 * `Flow` renders the matching View.
 */
export const createCapabilityActionHandler = ({
  processor,
  capabilities,
  onAcceptedResult,
} = {}) => {
  if (!processor?.model?.getSurface || !capabilities) {
    throw new Error('A2UI capability actions require a MessageProcessor and capabilities.');
  }

  return async ({ name, surfaceId, context = {} } = {}) => {
    const surface = surfaceFor(processor, surfaceId);
    const statePath = statePathFor(context);
    const { controller, state, setData } = createSegmentAndMeasureFlow({
      surface,
      statePath,
      surfaceId,
      capabilities,
      onAcceptedResult,
    });

    try {
      return await controller.dispatch(name, { context, surfaceId, statePath });
    } catch (error) {
      setData({ error: actionErrorMessage(error, 'The requested capability could not complete.') });
      controller.setView(SEGMENT_AND_MEASURE_VIEWS.error);
      console.error('Gather A2UI capability action failed.', { name, surfaceId, error });
      return state();
    }
  };
};
