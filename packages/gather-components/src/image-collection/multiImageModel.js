/**
 * Render-free logic for `MultiImageCapture`.
 *
 * Split out so the cardinality and collection rules are directly testable under
 * `node --test`, mirroring the `mediaModel.js` convention.
 *
 * Cardinality lives here because it affects *interaction* (a full collection
 * disables capture; an unmet minimum disables completion). Ownership of the
 * underlying rule belongs to the host — a composition's config, or XForms
 * constraint/repeat semantics via an adapter — so there is one source of truth.
 * See docs/components-capabilities-ownership.md §12.
 */

const count = (items) => (Array.isArray(items) ? items.length : 0);

/** A bounded maximum, or `null` for unbounded. */
const boundOf = (maxItems) =>
  typeof maxItems === 'number' && Number.isFinite(maxItems) && maxItems > 0 ? Math.floor(maxItems) : null;

/** Capture stays available until the collection is full. */
export const canCapture = ({ items, maxItems = null } = {}) => {
  const bound = boundOf(maxItems);
  return bound === null || count(items) < bound;
};

/** Completion unlocks once the minimum is met. */
export const canComplete = ({ items, minItems = 0 } = {}) => {
  const floor = typeof minItems === 'number' && Number.isFinite(minItems) && minItems > 0 ? Math.floor(minItems) : 0;
  return count(items) >= floor;
};

/** Removes one item by index, returning the same array when nothing changes. */
export const removeItemAt = (items, index) => {
  if (!Array.isArray(items)) return [];
  if (!Number.isInteger(index) || index < 0 || index >= items.length) return items;
  return [...items.slice(0, index), ...items.slice(index + 1)];
};

/** Appends one item; a nullish item is ignored so a failed capture is a no-op. */
export const appendItem = (items, item) => {
  const list = Array.isArray(items) ? items : [];
  return item == null ? list : [...list, item];
};

/**
 * Progress text for the camera accessory: `"2 of 4"` when bounded, `"2"` when
 * not, and `null` when nothing has been captured and no minimum is required.
 */
export const captureCountLabel = ({ items, minItems = 0, maxItems = null } = {}) => {
  const total = count(items);
  const bound = boundOf(maxItems);
  if (bound !== null) return `${total} of ${bound}`;
  const floor = typeof minItems === 'number' && minItems > 0 ? Math.floor(minItems) : 0;
  if (total === 0 && floor === 0) return null;
  if (floor > 0 && total < floor) return `${total} of ${floor}`;
  return String(total);
};
