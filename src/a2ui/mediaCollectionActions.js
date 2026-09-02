import { GATHER_ACTION_IDS } from 'gather-catalog';

/**
 * The collection-mutation handlers that ship with `MultiImageCapture` /
 * `MediaGallery`.
 *
 * A Component's action semantics are fixed and ship *with* the Component, so
 * these are written once here rather than reinvented per composition — the
 * handler gap that affects authored compositions does not apply. See
 * docs/components-capabilities-ownership.md §11.
 *
 * Scope is deliberately mutation only: `mediaCaptured` (persist and append) and
 * `mediaChanged` (remove / reorder / set). Selection, `mediaBack` and
 * `mediaDone` are navigation and completion, which belong to the composition
 * that embeds the collection, not to the collection itself.
 *
 * `persistCapture` is environment injection — the host materializes the durable
 * asset, so no Component touches storage.
 *
 * @param {{
 *   persistCapture: (capture: object) => Promise<object>,
 *   itemsKey?: string,
 * }} deps
 */
export const createMediaCollectionHandlers = ({ persistCapture, itemsKey = 'items' } = {}) => {
  if (typeof persistCapture !== 'function') {
    throw new Error('A media collection requires a persistCapture capability.');
  }

  const read = (surface, statePath) => surface.dataModel.get(statePath) ?? {};
  const items = (surface, statePath) => {
    const value = read(surface, statePath)[itemsKey];
    return Array.isArray(value) ? value : [];
  };
  const write = (surface, statePath, next) => {
    surface.dataModel.set(statePath, { ...read(surface, statePath), [itemsKey]: next });
    return next;
  };

  return {
    /** Persist the plain descriptor the Component handed over, then append it. */
    [GATHER_ACTION_IDS.mediaCaptured]: async ({ surface, statePath, context }) => {
      const capture = context?.capture;
      if (!capture) throw new Error('The camera did not produce a photo.');
      const asset = await persistCapture(capture);
      if (!asset) throw new Error('The photo could not be saved.');
      return write(surface, statePath, [...items(surface, statePath), asset]);
    },

    /**
     * Apply a collection edit. `remove` carries an index rather than an array so
     * a stale client list cannot silently replace newer state; `reorder`/`set`
     * carry the already-computed array.
     */
    [GATHER_ACTION_IDS.mediaChanged]: async ({ surface, statePath, context }) => {
      const current = items(surface, statePath);
      if (context?.change === 'remove') {
        const index = Number(context.index);
        if (!Number.isInteger(index) || index < 0 || index >= current.length) return current;
        return write(surface, statePath, [...current.slice(0, index), ...current.slice(index + 1)]);
      }
      if (!Array.isArray(context?.items)) return current;
      return write(surface, statePath, [...context.items]);
    },
  };
};
