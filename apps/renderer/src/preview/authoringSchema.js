/**
 * The **authoring projection** of a model-backed Capability.
 *
 * The Composer's agent has to be able to fill `image_segment.modelRef`, and it
 * can only know what the catalog handshake tells it. But a Capability is a
 * portable semantic contract — `image.segment` accepts
 * `segmentation.binary.v1`, and which models a given Gather distribution
 * happens to ship is none of its business. So the enumeration is added **here**,
 * in the renderer's authoring adapter, and the canonical
 * `gather-capabilities` schema never acquires application-specific model lists.
 *
 * ```text
 * capability.acceptedModelProfiles  +  buildModelCatalog()
 *          ↓  (this file)
 * A2UI Function parameters  →  GET_CATALOG  →  Composer agent
 * ```
 *
 * **Omission is the default.** There is no `modelRef: "default"` sentinel and
 * no pseudo-`ModelRef` standing for one. `modelRef` absent means product
 * policy chooses; `modelRef` present means exactly this immutable revision.
 * Inventing a sentinel would put default-selection policy into an identity
 * type, which is the one thing `ModelRef` must not carry.
 *
 * The verified representation: A2UI serializes these Zod schemas to ordinary
 * JSON Schema in the catalog payload, and the Composer's consumer is a language
 * model. So `description` and `enum` are the richest things that reliably
 * survive and are reliably understood — no Composer patch, no upstream
 * assumption beyond "it forwards the schema it was given".
 */
import { z } from 'zod';

/** Models whose task profile the capability accepts. */
export const compatibleModelsFor = ({ definition, models }) => {
  const accepted = definition?.acceptedModelProfiles ?? [];
  if (accepted.length === 0) return [];
  return models.filter((model) => accepted.includes(model.taskProfile));
};

const describeChoices = (definition, compatible) => {
  const lines = compatible.map(
    (model) =>
      `  • ${model.displayName} — id "${model.modelRef.id}", version ` +
      `"${model.modelRef.version}", revision "${model.modelRef.revision}"` +
      (model.defaultFor?.includes(definition.id) ? ' (this capability’s default)' : '')
  );
  return [
    `Optional. Omit to use Gather’s default model for ${definition.id}.`,
    `Supply one only to pin an exact model revision. It must be one of the models this Gather distribution declares for ${definition.acceptedModelProfiles.join(', ')}:`,
    ...lines,
    'Copy one of these exactly; revisions are content digests and cannot be invented.',
  ].join('\n');
};

/**
 * Returns the input schema an authoring host should advertise for a
 * capability, or the canonical one unchanged when there is nothing to add.
 *
 * `revision` becomes an enum because the catalog *is* the set of resolvable
 * models — the preview resolver already refuses anything else, so the schema
 * states a constraint that exists rather than inventing one. It is derived from
 * the catalog on every build, so a model added to `bundledModels` widens it
 * automatically and a Tool-supplied model will widen it the same way once the
 * catalog knows about such things.
 */
export const authoringInputSchemaFor = ({ definition, models }) => {
  const canonical = definition?.input;
  if (!canonical || typeof canonical.extend !== 'function') return canonical;

  const shape = typeof canonical._def?.shape === 'function' ? canonical._def.shape() : null;
  const declared = shape?.modelRef;
  if (!declared) return canonical;

  const compatible = compatibleModelsFor({ definition, models });
  if (compatible.length === 0) return canonical;

  // Unwrap the optional so the enrichment lands on the object, then re-wrap:
  // optionality is the default-selection semantics and must survive.
  const inner = declared._def?.innerType ?? declared;
  if (typeof inner.extend !== 'function') return canonical;

  const revisions = compatible.map((model) => model.modelRef.revision);
  const enriched = inner
    .extend({ revision: z.enum([revisions[0], ...revisions.slice(1)]) })
    .describe(describeChoices(definition, compatible));

  return canonical.extend({ modelRef: enriched.optional() });
};
