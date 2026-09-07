import { createModelRef } from 'gather-models';

import { BUNDLED_MODELS } from './bundledModels.js';
import { DEFAULT_MODELS_BY_CAPABILITY } from './modelPolicy.js';

/**
 * The **Gather Model Catalog** — a third kind of authoring thing, beside
 * Components and Capabilities.
 *
 * ```text
 * Gather Composer
 * ├── Component Catalog
 * ├── Capability Catalog
 * └── Model Catalog        ← here
 * ```
 *
 * Models are **not** A2UI Components and **not** A2UI Functions. A2UI already
 * accepts a serialized `ModelRef` inside a capability's input schema, which is
 * all it ever needs to know about them; discovery is Gather's own concern. That
 * separation is what lets a future plugin authoring environment consume the
 * same catalog without A2UI in the picture.
 *
 * The catalog derives from **what this distribution declares it can provide**,
 * not from what happens to be installed. Models install lazily, so an installed
 * list would hide a model an author may legitimately choose. `installed` is an
 * annotation on an entry, never the reason an entry exists.
 *
 * Entries project existing `ModelPackage` fields rather than restating them, so
 * there is no second model schema to drift.
 */

/** One catalog entry: enough for an agent or picker to choose, and no more. */
const entryFor = (declared, { installedRevisions, defaultForCapabilities }) => {
  const modelPackage = declared.modelPackage;
  const modelRef = createModelRef(modelPackage);
  return {
    // identity — the only shape that may cross a wire or sit in a composition
    modelRef,
    id: modelRef.id,
    version: modelRef.version,
    revision: modelRef.revision,

    // display
    name: declared.name,
    displayName: declared.displayName ?? modelRef.id,

    // compatibility — matched against a capability's acceptedModelProfiles
    taskProfile: modelRef.taskProfile,

    // provenance of the model itself, straight from the package
    upstream: modelPackage.upstream ?? null,
    tensor: modelPackage.tensor ?? null,
    requiresLabels: Boolean(modelPackage.labels),

    // availability
    source: 'app',
    installed: installedRevisions.has(modelRef.revision),
    defaultFor: defaultForCapabilities,
  };
};

/**
 * Builds the catalog.
 *
 * @param {{ installed?: Array<{ modelRef?: { revision?: string } }> }} input
 *   `installed` is optional device state from `modelStore.listInstalled()`. Its
 *   absence changes which models are *annotated* as present, never which are
 *   offered.
 */
export const buildModelCatalog = ({ installed = [] } = {}) => {
  const installedRevisions = new Set(
    (installed ?? []).map((entry) => entry?.modelRef?.revision).filter(Boolean)
  );
  const defaultsByName = new Map();
  for (const [capabilityId, name] of Object.entries(DEFAULT_MODELS_BY_CAPABILITY)) {
    defaultsByName.set(name, [...(defaultsByName.get(name) ?? []), capabilityId]);
  }
  return BUNDLED_MODELS.map((declared) =>
    entryFor(declared, {
      installedRevisions,
      defaultForCapabilities: Object.freeze([...(defaultsByName.get(declared.name) ?? [])]),
    })
  );
};

/**
 * The models that satisfy a capability, which is the question the Composer
 * actually asks:
 *
 * ```text
 * image.segment → acceptedModelProfiles → compatible Gather models → ModelRef
 * ```
 */
export const modelsForCapability = (catalog, capabilityDefinition) => {
  const accepted = capabilityDefinition?.acceptedModelProfiles ?? [];
  if (accepted.length === 0) return [];
  return (catalog ?? []).filter((entry) => accepted.includes(entry.taskProfile));
};
