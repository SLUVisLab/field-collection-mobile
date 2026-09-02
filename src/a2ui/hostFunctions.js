import { z } from 'zod';
import { createFunctionImplementation } from '@a2ui/web_core/v0_9/catalog';

/**
 * Gather **host** functions — the lifecycle seams an authored composition needs
 * but no Capability can own.
 *
 * ```text
 * measure_area, image_segment …   → gather-capabilities   (application-independent)
 * gather_persistAsset             → Gather media lifecycle   (instance-specific)
 * gather_completeComposition      → Gather/XForms lifecycle  (instance-specific)
 * ```
 *
 * Both kinds enter the same `Catalog.functions`, so an authored composition sees
 * one uniform mechanism — but implementation ownership stays distinct, which is
 * why these live beside `capabilityFunctions.js` rather than inside it.
 *
 * Capability implementations are mostly application-independent. These are not:
 * they need the live instance, its media store and ledger, the composition's
 * declared outputs, the form binding manifest, and the Accept lifecycle. So the
 * implementations are **injected by whoever holds that context** — the
 * composition control — never imported as module singletons.
 */

export const HOST_FUNCTION_IDS = Object.freeze({
  persistAsset: 'gather_persistAsset',
  completeComposition: 'gather_completeComposition',
});

/**
 * `gather_persistAsset` — a local capture descriptor becomes a durable asset.
 *
 * Deliberately boring: capture in, `ImageAsset` out. The implementation owns
 * writing bytes, the ledger row and its declared disposition; the function
 * knows nothing about what happens to the asset afterwards. An authored
 * composition decides that with `resultPath`.
 */
const PersistAssetArgs = z
  .object({
    // The plain descriptor a Component emits. `passthrough` because the
    // descriptor's shape belongs to the Component, not to this seam.
    capture: z.object({ uri: z.string().min(1) }).passthrough(),
    // Optional authored disposition, per b-custom §4 — persistence is explicit
    // authoring policy, never inferred.
    retention: z.enum(['keep', 'discard']).optional(),
  })
  .strict();

/**
 * `gather_completeComposition` — the terminal lifecycle seam.
 *
 * Takes only the composition's **declared output values**, resolved from
 * composition state. It deliberately cannot be told where they go: the form's
 * binding manifest owns that mapping, so an authored action naming arbitrary
 * XForms references is structurally impossible. `.strict()` makes an attempt to
 * pass one a loud failure rather than a silently ignored key.
 */
const CompleteCompositionArgs = z
  .object({
    outputs: z.record(z.unknown()),
  })
  .strict();

/**
 * Builds the host function implementations.
 *
 * @param {{
 *   persistAsset: (input: { capture: object, retention?: string }) => Promise<object>,
 *   completeComposition: (input: { outputs: object }) => Promise<object>,
 * }} implementations bound to the live instance by the caller
 */
export const createHostFunctions = ({ persistAsset, completeComposition } = {}) => {
  const functions = [];
  if (typeof persistAsset === 'function') {
    functions.push(
      createFunctionImplementation(
        { name: HOST_FUNCTION_IDS.persistAsset, returnType: 'object', schema: PersistAssetArgs },
        (args) => persistAsset(args)
      )
    );
  }
  if (typeof completeComposition === 'function') {
    functions.push(
      createFunctionImplementation(
        {
          name: HOST_FUNCTION_IDS.completeComposition,
          returnType: 'object',
          schema: CompleteCompositionArgs,
        },
        (args) => completeComposition(args)
      )
    );
  }
  return functions;
};

/** Merges capability and host functions into one catalog registration. */
export const mergeFunctions = (...groups) => {
  const byName = new Map();
  for (const group of groups) {
    for (const fn of group ?? []) {
      if (byName.has(fn.name)) {
        // A silent overwrite would mean an authored call resolves to something
        // other than what the catalog advertised.
        throw new Error(`Duplicate A2UI function registration: ${fn.name}`);
      }
      byName.set(fn.name, fn);
    }
  }
  return [...byName.values()];
};
