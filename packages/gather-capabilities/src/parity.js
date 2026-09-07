/**
 * Runtime parity: a Capability is authorable only if **both** hosts execute it.
 *
 * ```text
 * CAPABILITY_DEFINITIONS
 *         ↓
 * assert native implementation
 * assert browser implementation
 *         ↓
 * catalog advertisement
 * ```
 *
 * The order matters. Advertisement used to come first and the browser's
 * capacity second, via a hand-written allowlist — which quietly redefined the
 * authoring vocabulary as "whatever the browser happens to support" and left
 * five of eight Capabilities executable on the device but unauthorable in the
 * Composer. Nothing said so, because nothing checked.
 *
 * Both hosts call this where they build their runtime, so a definition added
 * without an implementation fails at construction rather than disappearing from
 * the catalog. That is the whole point: the failure should be loud and on the
 * side that is missing something, not silent and on the author's side.
 *
 * ## What this does and does not prove
 *
 * It proves **both hosts have an implementation** for every declared Capability.
 * It cannot prove they *mean the same thing* — that is what the cross-runtime
 * fixtures are for, which is why they pin OpenCV's own numbers (a 6×6 hole adds
 * 20 + 4√2, not the 28 an intuitive reading of the geometry suggests) rather
 * than numbers that merely look reasonable.
 */
import { CAPABILITY_DEFINITIONS } from './definitions.js';

export class CapabilityParityError extends Error {
  constructor(message, { host, missing }) {
    super(message);
    this.name = 'CapabilityParityError';
    this.code = 'GATHER_CAPABILITY_PARITY';
    this.host = host;
    this.missing = missing;
  }
}

/**
 * @param {{ runtime: Record<string, Function>, host: string,
 *           definitions?: Array<{ id: string }> }} input
 * @returns {string[]} the capability ids this runtime covers
 */
export const assertRuntimeCovers = ({ runtime, host, definitions = CAPABILITY_DEFINITIONS }) => {
  const missing = definitions
    .map((definition) => definition.id)
    .filter((id) => typeof runtime?.[id] !== 'function');

  if (missing.length > 0) {
    throw new CapabilityParityError(
      `The ${host} runtime cannot execute ${missing.join(', ')}. A Capability is authorable only ` +
        'when both runtimes implement it — implement it here, or remove it from ' +
        'CAPABILITY_DEFINITIONS. Do not hide it from the Composer: a Capability the device runs ' +
        'and the Composer will not offer is the gap this check exists to close.',
      { host, missing }
    );
  }
  return definitions.map((definition) => definition.id);
};
