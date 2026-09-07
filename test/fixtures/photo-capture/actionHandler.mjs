import { GATHER_ACTION_IDS } from '../../../packages/gather-catalog/src/index.js';

import { PHOTO_CAPTURE_VIEWS } from './definition.mjs';

import { createFlowController } from '../../../src/a2ui/flowController.js';

const DEFAULT_STATE_PATH = '/gather';

const actionErrorMessage = (error, fallback) =>
  error instanceof Error && error.message ? error.message : fallback;

const statePathFor = (context) =>
  typeof context?.statePath === 'string' && context.statePath.startsWith('/')
    ? context.statePath
    : DEFAULT_STATE_PATH;

const requireValue = (value, message) => {
  if (!value) throw new Error(message);
  return value;
};

/**
 * The Photo Capture fixture's action handler.
 *
 * Fixture-only code: it travels with the definition rather than living in
 * `src/`, because ordinary photo capture is not a production runtime species.
 *
 * It is also the concrete illustration of a known limitation: composition
 * *structure* is data, but composition *behavior* still needs a
 * composition-specific handler like this one. See
 * docs/components-capabilities-ownership.md §10.
 *
 * `A2UIHost` owns hosting; this owns what `capture` / `accept` / `retake` mean
 * for this composition; `FlowController` owns only which View is active.
 *
 * Acquisition is Component-owned: `CameraView` hands over a plain local capture
 * descriptor, and this controller is what turns it into a durable `ImageAsset`
 * via the injected `persistCapture`. There is deliberately no `camera.*`
 * capability.
 *
 * Curried so the capabilities bind once and the result matches the
 * `createActionHandler({ processor, onAcceptedResult })` shape `A2UIHost` calls.
 *
 * @param {{ capabilities: { persistCapture: Function, capture?: Function } }} deps
 */
export const createPhotoCaptureActionHandler = ({ capabilities } = {}) => {
  const persistCapture = capabilities?.persistCapture;
  if (typeof persistCapture !== 'function') {
    throw new Error('Photo Capture requires a persistCapture capability.');
  }

  return ({ processor, onAcceptedResult } = {}) => {
    if (!processor?.model?.getSurface) {
      throw new Error('Photo Capture requires a MessageProcessor.');
    }

    return async ({ name, surfaceId, context = {} } = {}) => {
      const surface = processor.model.getSurface(surfaceId);
      if (!surface) throw new Error(`A2UI surface '${surfaceId}' is unavailable.`);
      const statePath = statePathFor(context);

      const state = () => surface.dataModel.get(statePath) ?? {};
      const setData = (patch) => {
        const next = { ...state(), ...patch };
        surface.dataModel.set(statePath, next);
        return next;
      };

      const controller = createFlowController({
        initialView: PHOTO_CAPTURE_VIEWS.capture,
        startView: state().status,
        onViewChange: (view) => {
          surface.dataModel.set(statePath, { ...state(), status: view });
        },
        handlers: {
          [GATHER_ACTION_IDS.capture]: async ({ context: eventContext }, flow) => {
            const capture = requireValue(
              eventContext.capture ?? await capabilities.capture?.(),
              'The camera did not produce a photo.'
            );
            setData({ image: null, error: null });
            flow.setView(PHOTO_CAPTURE_VIEWS.persisting);
            const image = await persistCapture(capture);
            setData({ image });
            flow.setView(PHOTO_CAPTURE_VIEWS.review);
            return state();
          },

          // Accept completes the Tool. Delivery is the host's seam; what
          // completion *means* (an XForms attachment, a preview inspector) is
          // the embedder's decision, not this controller's.
          [GATHER_ACTION_IDS.accept]: async () => {
            const image = requireValue(state().image, 'Capture a photo before accepting it.');
            await onAcceptedResult?.(image, { surfaceId, statePath });
            return image;
          },

          [GATHER_ACTION_IDS.retake]: async (_payload, flow) => {
            setData({ image: null, error: null });
            flow.reset();
            return state();
          },
        },
      });

      try {
        return await controller.dispatch(name, { context, surfaceId, statePath });
      } catch (error) {
        setData({ error: actionErrorMessage(error, 'The photo could not be captured.') });
        controller.setView(PHOTO_CAPTURE_VIEWS.error);
        console.error('Gather Photo Capture action failed.', { name, surfaceId, error });
        return state();
      }
    };
  };
};
