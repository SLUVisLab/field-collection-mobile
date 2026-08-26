/**
 * Projected state of a single form node.
 *
 * The two value fields are intentionally distinct and MUST NOT be conflated:
 *
 * - `value` — the engine's **typed runtime value**, projected to JSON. Its JS
 *   shape depends on `valueType`:
 *     - `string` / `int` / `boolean` -> `string`
 *       (`int` is the engine's `bigint` stringified, e.g. `"17"` — never `"17n"`)
 *     - `decimal` -> `number`
 *     - select (`select` / `select1`) -> `string[]`
 *       (the engine models even a `<select1>` as a set, so a single selection
 *       is `["apple"]`, not `"apple"`)
 *
 * - `instanceValue` — the **serialized XForms instance string**, exactly as the
 *   node's text would appear in submission XML. For the select above this is
 *   `"apple"` (i.e. `<choice>apple</choice>`).
 *
 * This is precisely why the host must not pretend runtime state equals instance
 * XML: `value = ["apple"]` (runtime, set-shaped) vs `instanceValue = "apple"`
 * (the serialized leaf `<choice>apple</choice>`).
 *
 * `valueType` and `instanceValue` are optional best-effort fields.
 *
 * @typedef {{
 *   reference: string,
 *   value: string | number | boolean | null | Array<string | number | boolean | null>,
 *   valueType?: string | null,
 *   instanceValue?: string | null,
 *   relevant: boolean | null,
 *   required: boolean | null,
 *   readonly: boolean | null,
 *   choices?: Array<{ label: string | number | boolean | null, value: string | number | boolean | null }>,
 *   constraintValid: boolean | null
 * }} FormSnapshotNode
 */

/**
 * A `FormSnapshot` is a flat, JSON-safe projection of the subset of engine node
 * state that must cross the host boundary, keyed by canonical node reference. It
 * is deliberately **not** a mirror of the ODK XForms engine model; anything
 * needing the full engine object graph must go through host methods.
 *
 * @typedef {{
 *   generatedAt: string,
 *   nodeCount: number,
 *   nodesByReference: Record<string, FormSnapshotNode>
 * }} FormSnapshot
 */

/**
 * @typedef {{
 *   type: 'stateChanged' | 'log' | 'lifecycle',
 *   payload: unknown
 * }} XFormsEvent
 */

export const XFORMS_EVENT_TYPES = Object.freeze({
  STATE_CHANGED: 'stateChanged',
  LOG: 'log',
  LIFECYCLE: 'lifecycle',
});

export class XFormsHostError extends Error {
  constructor(message, { details = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'XFormsHostError';
    this.details = details;
  }
}

/**
 * The rest of the app depends on this small boundary, not on WebView APIs.
 */
export class XFormsHost {
  async initialize() {
    throw new Error('Not implemented');
  }

  async loadForm(_xml) {
    throw new Error('Not implemented');
  }

  async getSnapshot() {
    throw new Error('Not implemented');
  }

  async setValue(_nodeId, _value) {
    throw new Error('Not implemented');
  }

  async addRepeat(_repeatId) {
    throw new Error('Not implemented');
  }

  async removeRepeat(_repeatId, _instanceId) {
    throw new Error('Not implemented');
  }

  async serialize() {
    throw new Error('Not implemented');
  }

  async inspectMediaSeam() {
    throw new Error('Not implemented');
  }

  subscribe(_listener) {
    throw new Error('Not implemented');
  }

  async dispose() {
    throw new Error('Not implemented');
  }
}
