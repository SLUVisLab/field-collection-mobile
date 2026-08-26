export const XFORMS_EVENT_TYPES = Object.freeze({
  STATE_CHANGED: 'stateChanged',
  LOG: 'log',
  LIFECYCLE: 'lifecycle',
});

export const XFORMS_HOST_ERROR_CODES = Object.freeze({
  GENERIC: 'XFORMS_HOST_ERROR',
  NOT_IMPLEMENTED: 'XFORMS_HOST_NOT_IMPLEMENTED',
});

export class XFormsHostError extends Error {
  constructor(message, { code = XFORMS_HOST_ERROR_CODES.GENERIC, details = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'XFormsHostError';
    this.code = code;
    this.details = details;
  }
}

export const createXFormsHostError = (message, options) => new XFormsHostError(message, options);

const notImplemented = (methodName) =>
  new XFormsHostError(`XFormsHost method "${methodName}" is not implemented`, {
    code: XFORMS_HOST_ERROR_CODES.NOT_IMPLEMENTED,
    details: { methodName },
  });

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
 * `valueType` lets a consumer interpret `value`'s shape without guessing from JS
 * types (e.g. distinguishing `int` from `decimal` from `string`). `valueType`
 * and `instanceValue` are optional: a host implementation may omit them when it
 * cannot cheaply derive them, and consumers must treat them as best-effort.
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
 * A `FormSnapshot` is a **flat, JSON-safe projection** of the subset of engine
 * node state that must cross the host boundary (e.g. the WebView RPC seam),
 * keyed by canonical node reference.
 *
 * It is deliberately **not** a mirror of the ODK XForms engine model. It carries
 * only the per-node fields consumers need; anything that requires the full
 * engine object graph (text ranges, validation messages, the live node API,
 * repeat instance identity, etc.) must go through {@link XFormsHost} methods
 * rather than being copied into the snapshot. Keep this type minimal: a new
 * field belongs here only when a snapshot consumer genuinely needs it and it can
 * be represented as plain JSON.
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

/**
 * Runtime-neutral form host boundary.
 */
export class XFormsHost {
  async initialize() {
    throw notImplemented('initialize');
  }

  async loadForm(_xml) {
    throw notImplemented('loadForm');
  }

  async getSnapshot() {
    throw notImplemented('getSnapshot');
  }

  async setValue(_nodeId, _value) {
    throw notImplemented('setValue');
  }

  async addRepeat(_repeatId) {
    throw notImplemented('addRepeat');
  }

  async removeRepeat(_repeatId, _instanceId) {
    throw notImplemented('removeRepeat');
  }

  async serialize() {
    throw notImplemented('serialize');
  }

  async inspectMediaSeam() {
    throw notImplemented('inspectMediaSeam');
  }

  subscribe(_listener) {
    throw notImplemented('subscribe');
  }

  async dispose() {
    throw notImplemented('dispose');
  }
}

const EVENT_TYPE_SET = new Set(Object.values(XFORMS_EVENT_TYPES));

export const isXFormsEventType = (value) => EVENT_TYPE_SET.has(value);

export const isXFormsEvent = (value) =>
  value != null &&
  typeof value === 'object' &&
  isXFormsEventType(value.type) &&
  Object.prototype.hasOwnProperty.call(value, 'payload');
