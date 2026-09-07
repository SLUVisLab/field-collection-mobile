import { segment } from './image/segment/implementation.js';
import { classify } from './image/classify/implementation.js';
import { area, perimeter, boundingBox, centroid, color, sharpness } from './measure/implementation.js';
import { capabilityDefinitionsById } from './definitions.js';
import { CapabilityError } from './errors.js';

/**
 * Builds the executable capability registry by binding each portable capability
 * implementation to the app-provided platform engines. The engines
 * (`segmentExecute` / `classifyExecute` inference runners, `measurementAdapter`
 * geometry adapter) are injected by the app so the native runtime (ONNX / OpenCV)
 * stays outside this package — nothing native is imported here.
 *
 * ## The model boundary
 *
 * A model-backed capability's **public input carries a serialized `ModelRef`**,
 * which is the only model shape allowed to cross a wire or sit in an authored
 * composition. The inference engine needs something else entirely: the resolved
 * `ModelPackage` descriptor, with a device path for its bytes.
 *
 * ```text
 * serialized ModelRef  (or none, meaning "use the app's default")
 *        ↓  resolveModel — injected, app-owned
 * { model: ModelPackage descriptor, modelRef: ModelRef }
 *        ↓
 * capability implementation → execute → compute backend
 * ```
 *
 * That step used to be missing. `image.segment` was registered as an A2UI
 * function whose schema is `{ image, modelRef }`, and this registry passed that
 * object straight through — so `execute` received `model: undefined` and the
 * function could not run at all. Resolution belongs here, at the boundary
 * between a capability's public contract and its engine, and nowhere else: the
 * model executor stays ignorant of A2UI, and A2UI stays ignorant of models
 * beyond a `ModelRef` it already validates.
 *
 * `resolveModel` is injected rather than imported because *which* model answers
 * an absent ref is app policy, not capability semantics.
 *
 * @param {{
 *   segmentExecute?: (input: { image: object, model: object }) => Promise<object>,
 *   classifyExecute?: (input: { image: object, model: object }) => Promise<object>,
 *   measurementAdapter?: { maskMeasurements: Function, imageMeasurements: Function },
 *   resolveModel?: (input: {
 *     capabilityId: string,
 *     acceptedModelProfiles: string[],
 *     modelRef: object | null,
 *   }) => Promise<{ model: object, modelRef: object }>,
 * }} engines
 */
export const createCapabilityRuntime = ({
  segmentExecute,
  classifyExecute,
  measurementAdapter,
  resolveModel,
} = {}) => {
  const modelFor = async (capabilityId, input) => {
    const definition = capabilityDefinitionsById[capabilityId];
    if (typeof resolveModel !== 'function') {
      throw new CapabilityError(
        `${capabilityId} needs a model, and no model resolver is configured.`,
        { code: 'GATHER_CAPABILITY_NO_MODEL_RESOLVER' }
      );
    }
    const resolved = await resolveModel({
      capabilityId,
      acceptedModelProfiles: definition?.acceptedModelProfiles ?? [],
      modelRef: input?.modelRef ?? null,
    });
    if (!resolved?.model || !resolved?.modelRef) {
      throw new CapabilityError(`No model could be resolved for ${capabilityId}.`, {
        code: 'GATHER_CAPABILITY_MODEL_UNRESOLVED',
      });
    }
    return {
      ...input,
      model: resolved.model,
      modelRef: resolved.modelRef,
      acceptedModelProfiles: definition?.acceptedModelProfiles,
    };
  };

  return Object.freeze({
    'image.segment': async (input) =>
      segment({ ...(await modelFor('image.segment', input)), execute: segmentExecute }),
    'image.classify': async (input) =>
      classify({ ...(await modelFor('image.classify', input)), execute: classifyExecute }),
    'measure.area': (input) => area({ ...input, adapter: measurementAdapter }),
    'measure.perimeter': (input) => perimeter({ ...input, adapter: measurementAdapter }),
    'measure.boundingBox': (input) => boundingBox({ ...input, adapter: measurementAdapter }),
    'measure.centroid': (input) => centroid({ ...input, adapter: measurementAdapter }),
    'measure.color': (input) => color({ ...input, adapter: measurementAdapter }),
    'measure.sharpness': (input) => sharpness({ ...input, adapter: measurementAdapter }),
  });
};
