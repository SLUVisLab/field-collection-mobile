/**
 * Native-free capability definitions aggregate.
 *
 * This module is the Composer agent's source of truth for *what operations exist*
 * and *what they accept/return*. It imports only definitions (metadata + zod io
 * schemas) and MUST NOT import any native/device runtime (VisionCamera,
 * onnxruntime, OpenCV, DOM camera APIs) — importing it must be safe in a plain
 * Node/Composer context.
 *
 * Only capabilities with a working implementation wired in `runtime.js` are listed
 * here, so the agent never advertises an operation the runtime cannot perform.
 */
import { segmentDefinition } from './image/segment/definition.js';
import { classifyDefinition } from './image/classify/definition.js';
import { measureDefinitions } from './measure/definitions.js';

export const CAPABILITY_DEFINITIONS = Object.freeze([
  segmentDefinition,
  classifyDefinition,
  ...measureDefinitions,
]);

/** Definitions keyed by capability id. */
export const capabilityDefinitionsById = Object.freeze(
  Object.fromEntries(CAPABILITY_DEFINITIONS.map((definition) => [definition.id, definition])),
);

/** Composer-safe descriptors (metadata only, no zod/functions). */
export const describeCapabilities = () => CAPABILITY_DEFINITIONS.map((definition) => definition.describe());

export const capabilityIds = () => CAPABILITY_DEFINITIONS.map((definition) => definition.id);
