/**
 * Optional, app-shipped **behaviour handlers**, keyed by composition identity.
 *
 * This registry is **not** where compositions come from. Composition *structure*
 * is form data: the definition travels as a version-pinned form attachment and
 * is loaded by `../definitionLoader.js`. Gather registers executable
 * primitives — Components, Capabilities, host Functions — and **forms supply
 * compositions**.
 *
 * What lives here is the optional escape hatch: a composition whose behaviour
 * cannot yet be expressed with authored actions may ship bespoke JS in the app
 * and register it under its id. A composition with **no** handler is a
 * completely valid handler-free composition, not an unavailable one.
 *
 * Keeping definitions out of here matters: if the registry could supply them,
 * Composer portability would silently depend on app registration, and a test
 * could "pass" while proving nothing.
 */

const entries = new Map();

/**
 * @param {string} id the composition id an appearance token names
 * @param {{ createActionHandler: Function }} entry
 */
export const registerCompositionHandler = (id, entry) => {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('A composition needs a non-empty id to register under.');
  }
  if (typeof entry?.createActionHandler !== 'function') {
    throw new Error(`Composition handler '${id}' needs a createActionHandler.`);
  }
  if (entry.definition) {
    // Definitions come from the form, never from app registration.
    throw new Error(
      `Composition handler '${id}' must not carry a definition — compositions are supplied by forms.`
    );
  }
  entries.set(id, entry);
  return entry;
};

/** The app-shipped handler for an id, or `null` when the composition is handler-free. */
export const compositionHandlerFor = (id) => entries.get(id) ?? null;

/** Test seam: forget everything registered. */
export const resetCompositionHandlers = () => {
  entries.clear();
};

/** The ids with app-shipped behaviour, for diagnostics. */
export const registeredHandlerIds = () => [...entries.keys()];
