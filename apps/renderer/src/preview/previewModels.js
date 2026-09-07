/**
 * The web projection of the Gather Model Catalog, and the preview's resolver.
 *
 * Models remain a **distinct Gather concept** — not A2UI Components, not A2UI
 * Functions. This file consumes `public/models.json`, which
 * `scripts/generate-model-catalog.mjs` derives from the same
 * `buildModelCatalog` the app uses, so adding a model to `bundledModels` makes
 * it appear here with nobody editing a second list.
 *
 * The same file is served at `/models.json` for the Gather wrapper's Model
 * Browser. That needs no Composer patch, because the wrapper is ours.
 */
import catalog from '../../public/models.json' with { type: 'json' };

export const previewModels = Object.freeze(catalog.models);

/** Models whose task profile a capability accepts. */
export const modelsForProfiles = (acceptedModelProfiles = []) =>
  previewModels.filter((model) => acceptedModelProfiles.includes(model.taskProfile));

/** The catalog's declared default for a capability, if it has one. */
export const defaultModelFor = (capabilityId) =>
  previewModels.find((model) => (model.defaultFor ?? []).includes(capabilityId)) ?? null;

/**
 * Resolves the model a preview execution will use.
 *
 * Mirrors the app's contract — an omitted `modelRef` means "use the Gather
 * default" — but deliberately does **not** reimplement app model policy: the
 * default comes from `defaultFor`, which the generator copied out of the
 * app-owned `modelPolicy`. One source, projected.
 */
export const resolvePreviewModel = async ({ capabilityId, acceptedModelProfiles, modelRef }) => {
  if (modelRef) {
    const chosen = previewModels.find((model) => model.modelRef.revision === modelRef.revision);
    if (!chosen) {
      throw new Error(
        `No model in this distribution has revision ${modelRef.revision}. ` +
          'The preview can only run models the Gather Model Catalog declares.'
      );
    }
    return { model: chosen, modelRef: chosen.modelRef };
  }
  const fallback = defaultModelFor(capabilityId);
  if (!fallback) {
    throw new Error(
      `${capabilityId} has no default model in the Gather Model Catalog, so a modelRef is required.`
    );
  }
  if (
    Array.isArray(acceptedModelProfiles) &&
    acceptedModelProfiles.length > 0 &&
    !acceptedModelProfiles.includes(fallback.taskProfile)
  ) {
    throw new Error(
      `The default model for ${capabilityId} is ${fallback.taskProfile}, which it does not accept.`
    );
  }
  return { model: fallback, modelRef: fallback.modelRef };
};
