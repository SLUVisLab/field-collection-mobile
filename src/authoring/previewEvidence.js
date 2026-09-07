/**
 * Identity for a Model Lab result, and what a preview of a *default* selection
 * means.
 *
 * Evidence is **session-only**. A successful browser run is a fact about one
 * execution — this model, this sample, this backend — not durable truth about
 * the Tool, so nothing here is written to the A2UI document, the draft, the
 * Library or a future `.gather`. If researchers later want a history of test
 * runs, that is a product to design, not something to arrive at by accident.
 */

/**
 * A key precise enough that evidence cannot attach to the wrong subject.
 *
 * The backend belongs in it because an ORT-Web upgrade can change what a model
 * does; evidence that outlived the backend that produced it would be quietly
 * wrong. Preprocessing and postprocessing do **not** appear separately — the
 * ModelPackage revision already commits them, and repeating them would invite
 * the two to disagree.
 */
export const previewEvidenceKey = ({ capabilityId, modelRef, sampleDigest, backend } = {}) => {
  const missing = [
    ['capabilityId', capabilityId],
    ['modelRef.revision', modelRef?.revision],
    ['sampleDigest', sampleDigest],
    ['backend.id', backend?.id],
    ['backend.version', backend?.version],
  ]
    .filter(([, value]) => typeof value !== 'string' || value.length === 0)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `Preview evidence needs ${missing.join(', ')} — a key that omits any of them could attach ` +
        'a result to an execution that never happened.'
    );
  }
  return [capabilityId, modelRef.revision, sampleDigest, `${backend.id}@${backend.version}`].join('|');
};

/**
 * Which exact model a preview should run for a given call.
 *
 * A `default` selection is still runnable: the Lab resolves the distribution's
 * current default and executes **that exact revision**, so the evidence names a
 * model rather than the abstract word "default".
 *
 * ```text
 * Tool selection     Gather default
 * Preview executed   U²-Net salient segmentation  sha256:…
 * ```
 *
 * It does not make the Tool explicit and it does not change dependency
 * certainty — the Tool stays `unresolved` until publication freezes it. Reading
 * the default from the Model Catalog's own `defaultFor` is what keeps this from
 * becoming a second default policy in the wrapper.
 */
export const previewSubjectFor = ({ call, models = [] } = {}) => {
  if (!call?.model) {
    return { runnable: false, reason: 'This call takes no model.', modelRef: null };
  }
  if (call.model.mode === 'explicit') {
    return { runnable: true, modelRef: call.model.modelRef, resolvedFrom: 'explicit' };
  }
  if (call.model.mode === 'bound') {
    return call.model.resolution?.kind === 'static'
      ? { runnable: true, modelRef: call.model.resolution.modelRef, resolvedFrom: 'binding' }
      : {
          runnable: false,
          modelRef: null,
          reason:
            call.model.resolution?.reason ??
            'This call chooses its model from Tool state, so there is no one model to preview.',
        };
  }
  const fallback = models.find((model) => (model.defaultFor ?? []).includes(call.capabilityId));
  if (!fallback) {
    return {
      runnable: false,
      modelRef: null,
      reason: `This distribution declares no default model for ${call.capabilityId}.`,
    };
  }
  return { runnable: true, modelRef: fallback.modelRef, resolvedFrom: 'default' };
};
