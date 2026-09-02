import { z } from 'zod';

/**
 * `defineCapability` — the portable, native-free contract for one Composer-visible
 * capability. A definition describes *what* an operation is (id, io schemas,
 * metadata) without importing any device/native runtime (VisionCamera, ONNX,
 * OpenCV, DOM). The executable implementation is wired separately in `runtime.js`.
 *
 * This split is the whole point: the Composer agent can load `definitions.js` to
 * learn the available operations and their io contracts without pulling native
 * dependencies.
 *
 * @param {{
 *   id: string,              // stable dotted id, `domain.operation` (e.g. 'image.segment')
 *   version?: number,        // integer contract version
 *   title: string,
 *   description: string,
 *   group?: string,          // Composer grouping, e.g. 'Image'
 *   subcategory?: string,    // e.g. 'Analysis' | 'Processing' | 'Acquisition'
 *   kind?: string,           // 'inference' | 'processing' | 'heuristic' | 'device'
 *   input?: import('zod').ZodTypeAny,
 *   output?: import('zod').ZodTypeAny,
 *   platforms?: string[],    // e.g. ['android','ios','web']
 *   requiresUserActivation?: boolean,
 *   requiresContext?: string,
 *   recommendedComponent?: string,
 *   examples?: unknown[],
 * }} spec
 */
export const defineCapability = (spec) => {
  if (!spec || typeof spec.id !== 'string' || !/^[a-z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/.test(spec.id)) {
    throw new Error(`defineCapability requires a 'domain.operation' id, got: ${spec?.id}`);
  }
  if (typeof spec.title !== 'string' || typeof spec.description !== 'string') {
    throw new Error(`Capability '${spec.id}' requires a title and description.`);
  }
  const input = spec.input ?? z.unknown();
  const output = spec.output ?? z.unknown();
  return Object.freeze({
    id: spec.id,
    version: spec.version ?? 1,
    title: spec.title,
    description: spec.description,
    group: spec.group ?? null,
    subcategory: spec.subcategory ?? null,
    kind: spec.kind ?? null,
    input,
    output,
    platforms: Object.freeze([...(spec.platforms ?? ['android', 'ios', 'web'])]),
    requiresUserActivation: spec.requiresUserActivation ?? false,
    requiresContext: spec.requiresContext ?? null,
    recommendedComponent: spec.recommendedComponent ?? null,
    examples: Object.freeze([...(spec.examples ?? [])]),
    /** Composer-safe descriptor: metadata + JSON-ish io shape, no functions. */
    describe() {
      return {
        id: this.id,
        version: this.version,
        title: this.title,
        description: this.description,
        group: this.group,
        subcategory: this.subcategory,
        kind: this.kind,
        platforms: this.platforms,
        requiresUserActivation: this.requiresUserActivation,
        requiresContext: this.requiresContext,
        recommendedComponent: this.recommendedComponent,
      };
    },
  });
};
