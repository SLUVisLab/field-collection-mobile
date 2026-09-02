/**
 * The compositions this build can run.
 *
 * Composition **structure** is data and travels as a form attachment (§6), but
 * composition **behaviour** is still code: each needs its own action handler,
 * the known limitation recorded in
 * docs/components-capabilities-ownership.md §10. So a form may legitimately
 * declare a composition this build cannot run, and the control says so rather
 * than rendering an empty group.
 *
 * That makes §6's publishing model **half-achievable today**: the definition
 * ships with the form, the handler does not. Closing it would need either a
 * declarative behaviour vocabulary or shipping executable code with a form —
 * a decision, not an oversight.
 *
 * Empty in the shipped app. It is a **registry rather than a constant** so a
 * harness can register what it drives and then exercise the real `FormRunner`
 * path: testing *around* the screen instead of through it is what let three
 * earlier defects survive (docs/components-capabilities-ownership.md §25).
 */

const entries = new Map();

/**
 * @param {string} id the composition id an appearance token names
 * @param {{ definition: object, createActionHandler: Function }} entry
 */
export const registerComposition = (id, entry) => {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('A composition needs a non-empty id to register under.');
  }
  if (!entry?.definition || typeof entry.createActionHandler !== 'function') {
    throw new Error(`Composition '${id}' needs a definition and a createActionHandler.`);
  }
  entries.set(id, entry);
  return entry;
};

/** The runnable composition for an id, or `null` when this build has none. */
export const compositionEntryFor = (id) => entries.get(id) ?? null;

/** Test seam: forget everything registered. */
export const resetCompositionRegistry = () => {
  entries.clear();
};

/** The ids this build can run, for diagnostics. */
export const registeredCompositionIds = () => [...entries.keys()];
