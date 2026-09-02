// gather-capabilities — reusable Gather operations (Capabilities).
//
// Public surface:
//   - `defineCapability` and the portable, native-free capability *definitions*
//     (also aggregated at `gather-capabilities/definitions`), which the Composer
//     agent can load without pulling any native runtime;
//   - the portable capability *implementations* (image.*, measure.*), which take
//     app-injected platform engines and never import native/device modules;
//   - `createCapabilityRuntime` (also at `gather-capabilities/runtime`), which
//     binds implementations to injected engines into an executable registry.
//
// The native engines themselves (ONNX / OpenCV / VisionCamera) are provided by the
// app and injected; they are not owned here (camera acquisition + the shared
// CameraSession seam land in a later phase).

export { defineCapability } from './defineCapability.js';
export { CapabilityError, capabilityError } from './errors.js';
export {
  IMAGE_TASK_PROFILES,
  ImageAssetSchema,
  MaskAssetSchema,
  VideoAssetSchema,
  ModelRefSchema,
  QuantitySchema,
} from './contracts.js';

export { segment, segmentDefinition, SegmentInputSchema, SegmentationResultSchema } from './image/segment/index.js';
export { classify, classifyDefinition, ClassifyInputSchema, ClassificationResultSchema } from './image/classify/index.js';
export {
  measureMask,
  measureImage,
  area,
  perimeter,
  boundingBox,
  centroid,
  color,
  sharpness,
  measureDefinitions,
} from './measure/index.js';

export {
  CAPABILITY_DEFINITIONS,
  capabilityDefinitionsById,
  describeCapabilities,
  capabilityIds,
} from './definitions.js';
export { createCapabilityRuntime } from './runtime.js';
