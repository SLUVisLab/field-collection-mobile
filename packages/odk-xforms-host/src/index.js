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
 * A single node in a {@link FormRenderModel}: the engine-derived, presentational
 * metadata a native UI needs to *render* a form control, as distinct from the
 * per-node runtime *value* state carried by {@link FormSnapshotNode}.
 *
 * Every field here is projected directly from the ODK XForms engine's live node
 * tree — it is **not** parsed out of the XForm definition by the host. The host
 * never interprets XForms body/bind semantics itself; it only forwards what the
 * engine already computed. Keep this type to what the engine actually exposes.
 *
 * - `nodeType` is the engine's own control classification (`InstanceNodeType`),
 *   e.g. `'input' | 'select' | 'note' | 'trigger' | 'range' | 'rank' | 'upload'
 *   | 'group' | 'repeat-range:controlled' | 'repeat-range:uncontrolled'
 *   | 'repeat-instance' | 'model-value' | 'root'`. This is the "control type".
 * - `label` / `hint` are the engine `TextRange.asString` projections for the
 *   active language (or `null` when the node has none). `labelMedia` carries the
 *   `jr:` media URLs the engine resolved for the label, when present.
 * - `appearances` is the engine's parsed appearance token list, in source order.
 * - `selectType` is `'select' | 'select1'` for select controls, else `null`.
 * - `mediaType` / `mediaAccept` are the engine's parsed upload media options
 *   (for example, `'image'` / `'image/*'`), else `null`.
 * - `choices` mirrors the engine's `valueOptions` for select controls.
 * - `depth` and `parentReference` describe the node's place in the structural
 *   sequence; the containing `nodes` array is already in engine document order.
 * - `bodyBacked` is whether the node has a presentation control at all. A bind
 *   with no body element still produces a node, and that node is not a valid
 *   destination for anything another ODK client must be able to fill by hand.
 * - `gather` carries this form's Gather extension attributes, resolved from the
 *   live definition inside the engine host because the definition object graph
 *   cannot cross a serialization boundary.
 *
 * @typedef {{
 *   nodeId: string,
 *   reference: string,
 *   nodeType: string,
 *   label: string | null,
 *   hint: string | null,
 *   labelMedia?: { image?: string | null, audio?: string | null, video?: string | null } | null,
 *   appearances: string[],
 *   selectType?: string | null,
 *   valueType?: string | null,
 *   mediaType?: string | null,
 *   mediaAccept?: string | null,
 *   choices?: Array<{ label: string | number | boolean | null, value: string | number | boolean | null }>,
 *   readonly: boolean | null,
 *   required: boolean | null,
 *   bodyBacked?: boolean,
 *   gather?: { composition: string | null, output: string | null, retention: string | null },
 *   depth: number,
 *   parentReference: string | null,
 *   childCount: number | null
 * }} RenderNode
 */

/**
 * A `FormRenderModel` is an **engine-derived, ordered projection of render
 * metadata** for the currently loaded form instance. Where {@link FormSnapshot}
 * answers "what is each node's current value/relevance", the render model
 * answers "what controls exist, in what order, with what labels/hints/type/
 * appearance" — the structural + presentational information a native UI needs to
 * lay out the form without re-parsing XForms.
 *
 * `nodes` is a **flat list in engine document order** (depth-first pre-order over
 * the live node tree). That ordering *is* the structural sequence; `depth` and
 * `parentReference` let a consumer reconstruct the tree. The host derives all of
 * this from the engine's node objects and preserves engine authority: it does
 * not build an independent app-side schema of the form.
 *
 * @typedef {{
 *   generatedAt: string,
 *   activeLanguage?: string | null,
 *   languages?: string[],
 *   nodeCount: number,
 *   nodes: RenderNode[]
 * }} FormRenderModel
 */

/**
 * @typedef {{
 *   type: 'stateChanged' | 'log' | 'lifecycle',
 *   payload: unknown
 * }} XFormsEvent
 */

/**
 * A generic external form resource, referenced by a form via a `jr:` URL and
 * keyed here by `filename` (the URL's trailing segment). Provide `text` for
 * UTF-8 resources (e.g. an Entity List / CSV, XML) or `base64` for binary media.
 * This is intentionally protocol-neutral — the host makes resources available to
 * the engine without knowing anything about Entities or Central.
 *
 * @typedef {{
 *   filename: string,
 *   contentType?: string,
 *   text?: string,
 *   base64?: string
 * }} XFormsResourceAttachment
 */

/**
 * A resolved XForms Entity action. This is an engine projection, not an
 * application Entity model: the engine has already evaluated XPath,
 * calculations, relevance, and repeat-instance context before this crosses the
 * host boundary.
 *
 * `properties` contains only currently relevant `entities:saveto` bindings for
 * this Entity declaration. `reference` identifies the declaration instance and
 * therefore distinguishes effects emitted by separate repeat instances.
 *
 * @typedef {{
 *   reference: string | null,
 *   dataset: string | null,
 *   action: 'create' | 'update',
 *   entityId: string | null,
 *   label: string | null,
 *   properties: Record<string, string | null>,
 *   baseVersion: string | null,
 *   trunkVersion: string | null,
 *   branchId: string | null
 * }} EntityEffect
 */

/**
 * Runtime-neutral form host boundary.
 */
export class XFormsHost {
  async initialize() {
    throw notImplemented('initialize');
  }

  /**
   * @param {string} _xml
   * @param {XFormsResourceAttachment[]} [_attachments]
   */
  async loadForm(_xml, _attachments) {
    throw notImplemented('loadForm');
  }

  /**
   * Loads a form definition **and restores a previously serialized instance**
   * into it, returning the engine to the exact state captured in `_instanceXml`.
   *
   * This is the correct way to resume/open a saved submission: it delegates to
   * the engine's `restoreInstance` entrypoint (an `odk-instance-load` /
   * "subsequent load"), which replays the serialized primary-instance XML
   * through the engine's own model. It is deliberately **not** implemented by
   * replaying a sequence of {@link setValue} calls — doing so would re-run
   * first-load computations, fire spurious state changes, and cannot faithfully
   * reproduce engine-managed state (repeats, calculates, metadata, ordering).
   *
   * @param {string} _xml the XForm definition
   * @param {string} _instanceXml the serialized primary-instance XML previously
   *   produced by {@link serialize} (the `xml_submission_file` contents)
   * @param {XFormsResourceAttachment[]} [_attachments] form attachments the
   *   definition references via `jr:` URLs
   */
  async loadInstance(_xml, _instanceXml, _attachments) {
    throw notImplemented('loadInstance');
  }

  async getSnapshot() {
    throw notImplemented('getSnapshot');
  }

  /**
   * Returns the engine-derived {@link FormRenderModel} for the loaded form: an
   * ordered projection of render metadata (labels, hints, control type,
   * appearance, structural sequence) taken directly from the engine's live node
   * tree. Hosts must not synthesize this from their own XForms parsing.
   */
  async getRenderModel() {
    throw notImplemented('getRenderModel');
  }

  /**
   * Returns the active Entity create/update effects resolved by the XForms
   * engine. Hosts must not independently parse `entities:saveto` bindings or
   * evaluate their XPath expressions.
   *
   * @returns {Promise<EntityEffect[]>}
   */
  async getEntityEffects() {
    throw notImplemented('getEntityEffects');
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
