/**
 * What a Tool needs frozen before it can be published.
 *
 * Reads `inspectComposition`'s report and resolves the one thing that is still open at
 * authoring time — a `default` model selection — into an exact `ModelRef`,
 * **without touching the composition**. The plan is what packaging writes into
 * the manifest.
 *
 * ```text
 * explicit          exact              → allowed
 * bound + static    exact              → allowed
 * default           unresolved → exact → allowed, and the resolution is frozen
 * bound + dynamic   indeterminate      → refused
 * ```
 *
 * A package claiming "requires A" for a Tool that may select B at run time
 * would be a lie the format tells on the author's behalf, so the last case is
 * refused rather than approximated. A future version could accept it alongside
 * an explicitly closed model set; that is a feature, not a default.
 */

export class PublicationError extends Error {
  constructor(message, { code, occurrenceId = null } = {}) {
    super(message);
    this.name = 'PublicationError';
    this.code = code;
    this.occurrenceId = occurrenceId;
  }
}

/** Host functions are requirements of the runtime, never packaged dependencies. */
const HOST_FUNCTIONS = new Set(['gather_persistAsset', 'gather_completeComposition']);

/**
 * @param {{
 *   analysis: object,                       from inspectComposition()
 *   resolveDefault: (input: { capabilityId: string, acceptedModelProfiles: string[] }) => object|null,
 * }} input
 */
export const planPublication = ({ analysis, resolveDefault } = {}) => {
  if (!analysis) throw new PublicationError('Publication needs a Tool analysis.', { code: 'GATHER_PUBLISH_NO_ANALYSIS' });

  // An analysis problem is a publication problem: a Tool that does not hold
  // together is not one to freeze.
  if (analysis.issues?.length > 0) {
    const [first] = analysis.issues;
    throw new PublicationError(`This Tool cannot be published: ${first.message}`, {
      code: 'GATHER_PUBLISH_TOOL_INVALID',
    });
  }

  const models = new Map();
  const resolutions = [];

  for (const call of analysis.modelCalls ?? []) {
    if (call.dependency.certainty === 'indeterminate') {
      throw new PublicationError(
        `${call.capabilityId} chooses its model from Tool state (${call.model.binding}), so this ` +
          'Tool has no fixed set of models. A published Tool must name exactly what it runs.',
        { code: 'GATHER_PUBLISH_INDETERMINATE_MODEL', occurrenceId: call.occurrenceId }
      );
    }

    let modelRef = call.dependency.modelRef;
    if (call.dependency.certainty === 'unresolved') {
      // The one thing publication decides. Resolved through the caller's
      // policy — the app's own — never a second mapping here.
      modelRef = resolveDefault?.({
        capabilityId: call.capabilityId,
        acceptedModelProfiles: call.acceptedModelProfiles,
      });
      if (!modelRef?.revision) {
        throw new PublicationError(
          `${call.capabilityId} uses the Gather default, and this distribution declares none to ` +
            'freeze. Pin a model on that call, or publish from a distribution that has a default.',
          { code: 'GATHER_PUBLISH_NO_DEFAULT', occurrenceId: call.occurrenceId }
        );
      }
      // Recorded so the packaged Tool resolves to this and not to whatever the
      // default becomes later. Without this the package is not frozen.
      resolutions.push({
        capability: call.capabilityId,
        selection: 'default',
        occurrenceId: call.occurrenceId,
        modelRef,
      });
    }

    const existing = models.get(modelRef.revision);
    const usage = { capabilityId: call.capabilityId, selection: call.model.mode };
    if (existing) existing.for.push(usage);
    else models.set(modelRef.revision, { modelRef, for: [usage] });
  }

  return {
    capabilities: analysis.capabilities ?? [],
    // Derived from the composition, reported so a host can be checked — and
    // deliberately not a packaged dependency.
    hostFunctions: [
      ...new Set((analysis.calls ?? []).map((call) => call.functionName).filter((n) => HOST_FUNCTIONS.has(n))),
    ],
    outputs: analysis.outputs ?? [],
    models: [...models.values()],
    modelResolutions: resolutions,
  };
};
