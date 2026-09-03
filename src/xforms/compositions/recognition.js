/**
 * Recognition: is this group a composition field, and which one?
 *
 * The marker rides an appearance token on the group:
 *
 * ```text
 * <group ref="/data/flower_analysis" appearance="gather-composition"
 *        gather:composition="flower_v1.gather">
 * ```
 *
 * The token has **two distinct meanings**, and the difference is deliberate
 * rather than one form being an incomplete version of the other:
 *
 * ```text
 * appearance="gather-composition"          "execute the attached composition"
 *   + gather:composition="foo.gather"      the artifact owns its identity
 *                                          no form-level id comparison
 *
 * appearance="gather-composition:quadrat"  "this form requires composition X"
 *                                          registered-handler lookup allowed
 *                                          a loaded artifact must agree with X
 * ```
 *
 * Treating the bare form as a missing id is what made every handler-free
 * composition — the normal case — report a mismatch against `"null"`, found on
 * device. A composition id is a *claim the form chooses to make*, not a field
 * the form failed to fill in.
 *
 * That is all this module answers. Where the composition's outputs *go* is
 * `./compositionBinding.js`'s job — derived from the group's own children — and
 * what it means to run one is the handler registry's (`./handlers/`).
 * Conventions in docs/b-custom-composition-conventions.md §1.
 *
 * Nothing here touches the engine, storage or React.
 */

export const COMPOSITION_APPEARANCE = 'gather-composition';
export const COMPOSITION_APPEARANCE_PREFIX = `${COMPOSITION_APPEARANCE}:`;

export class CompositionFieldError extends Error {
  constructor(message, { code = 'GATHER_COMPOSITION_FIELD_ERROR', details = null } = {}) {
    super(message);
    this.name = 'CompositionFieldError';
    this.code = code;
    this.details = details;
  }
}

export const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;

/**
 * Reads the composition configuration off a group node's appearances.
 *
 * The id is carried after a colon, which the engine keeps verbatim — verified
 * in experiments/composition-appearance/, so no escaping is needed.
 *
 * @param {string[]|Iterable<string>} appearances
 * @returns {{ enabled: boolean, compositionId: string|null }}
 */
export const compositionConfigFrom = (appearances) => {
  const tokens = appearances == null ? [] : Array.from(appearances, (token) => String(token));
  for (const token of tokens) {
    // The canonical form. Which composition it is comes from
    // `body::gather:composition`, and the artifact is the authority on its own
    // id — so the appearance says only "render a composition here", which is
    // what an appearance is for.
    if (token === COMPOSITION_APPEARANCE) return { enabled: true, compositionId: null };
    if (!token.startsWith(COMPOSITION_APPEARANCE_PREFIX)) continue;
    // The id-bearing form still resolves, for a composition this build
    // registered rather than one the form supplies.
    const compositionId = token.slice(COMPOSITION_APPEARANCE_PREFIX.length);
    // A trailing colon naming nothing is inert rather than bound to an empty id.
    if (!nonEmptyString(compositionId)) return { enabled: false, compositionId: null };
    return { enabled: true, compositionId };
  }
  return { enabled: false, compositionId: null };
};

