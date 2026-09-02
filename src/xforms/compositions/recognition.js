/**
 * Recognition: is this group a composition field, and which one?
 *
 * The id rides an appearance token on the group:
 *
 * ```text
 * <group ref="/data/flower_analysis" appearance="gather-composition:flower_v1">
 * ```
 *
 * That is all this module answers. Where the composition's outputs *go* is the
 * form binding manifest's job (`./manifest.js`), and what it means to run one
 * is the handler registry's (`./handlers/`). Conventions in
 * docs/b-custom-composition-conventions.md §1.
 *
 * Nothing here touches the engine, storage or React.
 */

export const COMPOSITION_APPEARANCE_PREFIX = 'gather-composition:';

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
    if (!token.startsWith(COMPOSITION_APPEARANCE_PREFIX)) continue;
    const compositionId = token.slice(COMPOSITION_APPEARANCE_PREFIX.length);
    // A bare `gather-composition:` names nothing, so it is not a composition
    // field — better inert than bound to an empty id.
    if (!nonEmptyString(compositionId)) return { enabled: false, compositionId: null };
    return { enabled: true, compositionId };
  }
  return { enabled: false, compositionId: null };
};

