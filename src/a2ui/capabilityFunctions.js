import { z } from 'zod';
import { createFunctionImplementation } from '@a2ui/web_core/v0_9/catalog';

/**
 * Exposes Gather Capabilities to A2UI as **registered renderer Functions**.
 *
 * There is deliberately no second invocation API. A2UI v0.9.1 already ships the
 * whole mechanism — a catalog function registry, argument validation and
 * coercion, loud failure on unknown names, and lazy interaction-time execution
 * of `action.functionCall`. Gather simply never passed functions to
 * `new Catalog(...)`. See docs/a2ui-functioncall-gap.md.
 *
 * ```text
 * capability definition (portable, native-free)   →  A2UI FunctionDefinition
 * capability runtime entry (executable)           →  A2UI execute()
 * ```
 *
 * The Capability knows nothing about A2UI: it takes its serializable input and
 * returns its serializable output. Placing that output into composition state
 * is the renderer's job, not the Capability's — which is what keeps
 * `gather-capabilities` free of surface/data-model concepts.
 */

/**
 * Semantic Capability ids are dotted (`image.segment`); A2UI function
 * identifiers follow UAX #31 variable-name rules, where `.` is not appropriate.
 *
 * The mapping is `.` → `_`, which is **deterministic and reversible** because
 * `defineCapability` forbids underscores in ids
 * (`^[a-z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$`). Capabilities keep their
 * semantic ids; only the wire name is aliased.
 */
export const a2uiFunctionId = (capabilityId) => {
  if (typeof capabilityId !== 'string' || !capabilityId.includes('.')) {
    throw new Error(`Not a dotted capability id: ${capabilityId}`);
  }
  if (capabilityId.includes('_')) {
    // Would break reversibility, so refuse rather than alias ambiguously.
    throw new Error(`Capability id must not contain '_': ${capabilityId}`);
  }
  return capabilityId.replace(/\./g, '_');
};

/** The inverse of {@link a2uiFunctionId}. */
export const capabilityIdFor = (functionId) => {
  if (typeof functionId !== 'string' || !functionId.includes('_')) {
    throw new Error(`Not an A2UI capability function id: ${functionId}`);
  }
  return functionId.replace(/_/g, '.');
};

const RETURN_TYPES = Object.freeze({
  ZodString: 'string',
  ZodNumber: 'number',
  ZodBoolean: 'boolean',
  ZodArray: 'array',
  ZodObject: 'object',
  ZodVoid: 'void',
  ZodUndefined: 'void',
});

/**
 * A2UI's `returnType` vocabulary, derived from the capability's output schema.
 *
 * Unknown or union-shaped outputs degrade to `'any'` rather than guessing —
 * `returnType` is advisory metadata for authors, not a runtime coercion.
 */
export const returnTypeFor = (output) => {
  let current = output;
  while (current?._def?.typeName === 'ZodOptional' || current?._def?.typeName === 'ZodNullable') {
    current = current._def.innerType;
  }
  return RETURN_TYPES[current?._def?.typeName] ?? 'any';
};

/**
 * Builds A2UI function implementations from capability definitions plus an
 * executable runtime map.
 *
 * Only capabilities with **both** a definition and an implementation are
 * registered: advertising a function the runtime cannot execute would make the
 * catalog lie to the Composer agent, and `catalog.invoker` would fail at press
 * time rather than at build time.
 *
 * @param {{
 *   definitions: Array<{ id: string, input: import('zod').ZodTypeAny, output: import('zod').ZodTypeAny }>,
 *   runtime: Record<string, (input: unknown) => unknown>,
 * }} input
 * @returns {Array<{ name: string, returnType: string, schema: object, execute: Function }>}
 */
export const capabilityFunctions = ({ definitions = [], runtime = {} } = {}) =>
  definitions
    .filter((definition) => typeof runtime?.[definition?.id] === 'function')
    .map((definition) =>
      createFunctionImplementation(
        {
          name: a2uiFunctionId(definition.id),
          returnType: returnTypeFor(definition.output),
          // `catalog.invoker` calls `schema.parse(rawArgs)` before execute, so
          // the capability's own input contract becomes the wire validation —
          // no second schema to drift.
          schema: definition.input ?? z.unknown(),
        },
        (args) => runtime[definition.id](args)
      )
    );

/** The registered function ids, for diagnostics and Composer exposure. */
export const registeredCapabilityFunctionIds = (functions) =>
  (functions ?? []).map((fn) => fn.name);
