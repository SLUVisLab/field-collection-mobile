import { segment } from './image/segment/implementation.js';
import { classify } from './image/classify/implementation.js';
import { area, perimeter, boundingBox, centroid, color, sharpness } from './measure/implementation.js';

/**
 * Builds the executable capability registry by binding each portable capability
 * implementation to the app-provided platform engines. The engines
 * (`segmentExecute` / `classifyExecute` inference runners, `measurementAdapter`
 * geometry adapter) are injected by the app so the native runtime (ONNX / OpenCV)
 * stays outside this package — nothing native is imported here.
 *
 * Returns a map keyed by capability id: `{ 'image.segment': fn, 'measure.area': fn, ... }`.
 * Each entry accepts the capability's serializable input (the injected engine is
 * already bound).
 *
 * @param {{
 *   segmentExecute?: (input: { image: object, model: object }) => Promise<object>,
 *   classifyExecute?: (input: { image: object, model: object }) => Promise<object>,
 *   measurementAdapter?: { maskMeasurements: Function, imageMeasurements: Function },
 * }} engines
 */
export const createCapabilityRuntime = ({ segmentExecute, classifyExecute, measurementAdapter } = {}) =>
  Object.freeze({
    'image.segment': (input) => segment({ ...input, execute: segmentExecute }),
    'image.classify': (input) => classify({ ...input, execute: classifyExecute }),
    'measure.area': (input) => area({ ...input, adapter: measurementAdapter }),
    'measure.perimeter': (input) => perimeter({ ...input, adapter: measurementAdapter }),
    'measure.boundingBox': (input) => boundingBox({ ...input, adapter: measurementAdapter }),
    'measure.centroid': (input) => centroid({ ...input, adapter: measurementAdapter }),
    'measure.color': (input) => color({ ...input, adapter: measurementAdapter }),
    'measure.sharpness': (input) => sharpness({ ...input, adapter: measurementAdapter }),
  });
