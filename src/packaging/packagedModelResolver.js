/**
 * Model resolution for a Tool that arrived in a package.
 *
 * A published Tool keeps its author's composition byte for byte, so a `default`
 * selection still *looks* unresolved when it executes. If the ordinary resolver
 * handled it, the Tool would run whatever this distribution's default happens to
 * be today — and a package published in September would silently change
 * behaviour after a December release. The manifest's frozen resolution is what
 * stops that, and it only stops it if execution consults it.
 *
 * ```text
 * explicit ModelRef in the composition      → use it
 * statically bound ModelRef                 → use it
 * omitted, running from a package           → the package's frozen resolution
 * omitted, running from an editable draft   → current app modelPolicy
 * ```
 *
 * Same document, two contexts. The difference is entirely in who is asking,
 * which is why this wraps a resolver rather than replacing one.
 */

export class PackagedResolutionError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = 'PackagedResolutionError';
    this.code = code;
  }
}

/**
 * @param {{
 *   manifest: { modelResolutions?: Array<{ capability: string, modelRef: object }> },
 *   resolve: (input: object) => Promise<{ model: unknown, modelRef: object }>,
 * }} input the underlying resolver, which still loads and validates the model
 */
export const createPackagedModelResolver = ({ manifest, resolve } = {}) => {
  if (typeof resolve !== 'function') {
    throw new PackagedResolutionError('A packaged resolver wraps a real one.', {
      code: 'GATHER_PACKAGED_RESOLVER_INVALID',
    });
  }
  const frozen = new Map(
    (manifest?.modelResolutions ?? []).map((entry) => [entry.capability, entry.modelRef])
  );

  return async (input) => {
    // An explicit or bound ref is already exact; nothing to substitute.
    if (input?.modelRef) return resolve(input);

    const pinned = frozen.get(input?.capabilityId);
    if (!pinned) {
      // A package that omits a model *and* froze no resolution for it cannot
      // be executed reproducibly. Falling through to app policy here is exactly
      // the silent drift this file exists to prevent.
      throw new PackagedResolutionError(
        `This package does not say which model ${input?.capabilityId} should use. It was built ` +
          'without freezing that default, so what it would run is not knowable.',
        { code: 'GATHER_PACKAGED_RESOLUTION_MISSING' }
      );
    }
    return resolve({ ...input, modelRef: pinned });
  };
};
