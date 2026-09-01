import { createSegmentAndMeasureResult } from '../scientific/workflows/segmentAndMeasure.js';

import { GATHER_ACTION_IDS, segmentAndMeasurePresentation } from 'gather-catalog';

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

/**
 * Writes instrument state, deriving the bound presentation values for the phase
 * being written. The instrument renders one stable tree, so status copy, action
 * labels, and action availability must exist in the data model for every phase —
 * they are what varies instead of the component tree.
 */
const setState = (surface, path, value) => {
  const next = { ...value, ...segmentAndMeasurePresentation(value?.phase) };
  surface.dataModel.set(path, next);
  return next;
};

const currentState = (surface, path) => surface.dataModel.get(path) ?? {};

const requireValue = (value, message) => {
  if (!value) throw new Error(message);
  return value;
};

/**
 * Handles long-running Gather capabilities from ordinary A2UI event actions.
 * It preserves A2UI as the protocol/state engine and writes only serializable
 * capability results to the surface data model.
 */
export const createCapabilityActionHandler = ({
  processor,
  capabilities,
  onAcceptedResult,
} = {}) => {
  if (!processor?.model?.getSurface || !capabilities) {
    throw new Error('A2UI capability actions require a MessageProcessor and capabilities.');
  }

  const acceptMask = async (surface, statePath, surfaceId) => {
    const state = currentState(surface, statePath);
    if (state.phase === 'accepted' && state.result) return state.result;
    const image = requireValue(state.image, 'Capture an image before accepting a mask.');
    const segmentation = requireValue(state.segmentation, 'Segment an image before accepting a mask.');
    setState(surface, statePath, { ...state, phase: 'measuring', error: null });
    const classificationPromise = state.classification
      ? Promise.resolve(state.classification)
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
    setState(surface, statePath, { ...currentState(surface, statePath), phase: 'accepted', classification, result });
    await onAcceptedResult?.(result, { surfaceId, statePath });
    return result;
  };

  const resetToCapture = (surface, statePath) =>
    setState(surface, statePath, {
      ...currentState(surface, statePath),
      phase: 'capture',
      image: null,
      segmentation: null,
      classification: null,
      result: null,
      error: null,
    });

  const handle = async ({ name, surfaceId, context = {} } = {}) => {
    const surface = surfaceFor(processor, surfaceId);
    const statePath = statePathFor(context);

    try {
      switch (name) {
        case GATHER_ACTION_IDS.capture: {
          const state = currentState(surface, statePath);
          const capture = requireValue(
            context.capture ?? await capabilities.capture?.(),
            'Camera capture did not produce a local image.'
          );
          setState(surface, statePath, { ...state, phase: 'persisting-capture', image: null, segmentation: null, classification: null, result: null, error: null });
          const image = await capabilities.persistScientificCapture(capture);
          setState(surface, statePath, { ...currentState(surface, statePath), phase: 'segmenting', image });
          const segmentation = await capabilities.segmentScientificImage({ image });
          return setState(surface, statePath, { ...currentState(surface, statePath), phase: 'review-mask', segmentation });
        }

        case GATHER_ACTION_IDS.segment: {
          const image = requireValue(context.image ?? currentState(surface, statePath).image, 'Capture an image before segmenting.');
          setState(surface, statePath, { ...currentState(surface, statePath), phase: 'segmenting', error: null });
          const segmentation = await capabilities.segmentScientificImage({ image });
          return setState(surface, statePath, { ...currentState(surface, statePath), phase: 'review-mask', segmentation });
        }

        case GATHER_ACTION_IDS.classify: {
          const image = requireValue(context.image ?? currentState(surface, statePath).image, 'Capture an image before classifying.');
          setState(surface, statePath, { ...currentState(surface, statePath), phase: 'classifying', error: null });
          const classification = await capabilities.classifyScientificImage({ image });
          return setState(surface, statePath, { ...currentState(surface, statePath), phase: 'review-mask', classification });
        }

        case GATHER_ACTION_IDS.accept:
          return acceptMask(surface, statePath, surfaceId);

        case GATHER_ACTION_IDS.retake:
          return resetToCapture(surface, statePath);

        // The instrument declares one stable primary/secondary action pair.
        // A2UI action names are static strings, so intent is resolved here from
        // the current phase rather than by rendering a different tree per phase.
        case GATHER_ACTION_IDS.advance: {
          const { phase } = currentState(surface, statePath);
          if (phase === 'review-mask' || phase === 'accepted') {
            return acceptMask(surface, statePath, surfaceId);
          }
          return undefined;
        }

        case GATHER_ACTION_IDS.back:
          return resetToCapture(surface, statePath);

        default:
          return undefined;
      }
    } catch (error) {
      setState(surface, statePath, {
        ...currentState(surface, statePath),
        phase: 'error',
        error: actionErrorMessage(error, 'The requested capability could not complete.'),
      });
      console.error('Gather A2UI capability action failed.', { name, surfaceId, error });
      return currentState(surface, statePath);
    }
  };

  return handle;
};
