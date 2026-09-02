/**
 * Render-free logic for **authored composition fields**.
 *
 * A composition field is recognized by an appearance token on a group, and the
 * mapping from its typed result into XForms fields comes from a **form binding
 * manifest** shipped as a form attachment:
 *
 * ```text
 * composition artifact          form binding manifest
 *   output: petalCount    →       petalCount → /data/flower_analysis/petal_count
 * ```
 *
 * The composition artifact carries **no XPaths** — the same composition has to
 * be reusable across forms, so paths are the form's concern. And the runtime
 * contract never guesses paths: an unmapped output is an error, not a
 * convention. Conventions in docs/b-custom-composition-conventions.md §1.
 *
 * Nothing here touches the engine, storage or React. Bindings come out in the
 * `{ reference, path }` shape `createResultFieldWriter` already consumes, so
 * there is no translation layer.
 */

export const COMPOSITION_APPEARANCE_PREFIX = 'gather-composition:';

/** The form attachment a binding manifest travels as. */
export const BINDING_MANIFEST_FILENAME = 'gather-bindings.json';

/** Manifest versions this runtime understands. */
export const SUPPORTED_MANIFEST_VERSIONS = Object.freeze([1]);

export class CompositionFieldError extends Error {
  constructor(message, { code = 'GATHER_COMPOSITION_FIELD_ERROR', details = null } = {}) {
    super(message);
    this.name = 'CompositionFieldError';
    this.code = code;
    this.details = details;
  }
}

const fail = (message, code, details) => {
  throw new CompositionFieldError(message, { code, details });
};

const nonEmptyString = (value) => typeof value === 'string' && value.length > 0;

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

/** True when `reference` is at or below `groupReference`. */
const isWithinGroup = (reference, groupReference) =>
  reference === groupReference || reference.startsWith(`${groupReference}/`);

const assertBinding = (binding, { fieldReference, index }) => {
  const where = { field: fieldReference, index };
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    fail('Each binding must be an object.', 'GATHER_COMPOSITION_BINDING_INVALID', where);
  }
  if (!nonEmptyString(binding.path)) {
    fail(
      'Each binding needs a `path` into the composition result.',
      'GATHER_COMPOSITION_BINDING_NO_PATH',
      where
    );
  }
  if (!nonEmptyString(binding.reference)) {
    fail(
      'Each binding needs an XForms `reference` to write.',
      'GATHER_COMPOSITION_BINDING_NO_REFERENCE',
      where
    );
  }
  // A composition owns its own subtree and nothing else. Writing outside it
  // would land in fields Gather does not hide (B-custom §5), so the researcher
  // would see values appear with no explanation of where they came from.
  if (!isWithinGroup(binding.reference, fieldReference)) {
    fail(
      `A composition may only write inside its own group: ${binding.reference} is outside ${fieldReference}.`,
      'GATHER_COMPOSITION_BINDING_OUT_OF_SCOPE',
      { ...where, reference: binding.reference }
    );
  }
  return {
    path: binding.path,
    reference: binding.reference,
    required: binding.required === true,
  };
};

const assertField = (field, index) => {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    fail('Each manifest field must be an object.', 'GATHER_COMPOSITION_FIELD_INVALID', { index });
  }
  if (!nonEmptyString(field.reference)) {
    fail(
      'Each manifest field needs the `reference` of the group it configures.',
      'GATHER_COMPOSITION_FIELD_NO_REFERENCE',
      { index }
    );
  }
  if (!nonEmptyString(field.composition)) {
    fail(
      `Manifest field ${field.reference} needs a \`composition\` id.`,
      'GATHER_COMPOSITION_FIELD_NO_ID',
      { index, reference: field.reference }
    );
  }
  if (!Array.isArray(field.bindings) || field.bindings.length === 0) {
    fail(
      `Manifest field ${field.reference} needs at least one binding.`,
      'GATHER_COMPOSITION_FIELD_NO_BINDINGS',
      { reference: field.reference }
    );
  }
  const bindings = field.bindings.map((binding, bindingIndex) =>
    assertBinding(binding, { fieldReference: field.reference, index: bindingIndex })
  );
  // Two outputs writing one field would make the last one silently win.
  const seen = new Set();
  for (const binding of bindings) {
    if (seen.has(binding.reference)) {
      fail(
        `Manifest field ${field.reference} binds ${binding.reference} more than once.`,
        'GATHER_COMPOSITION_BINDING_DUPLICATE',
        { reference: binding.reference }
      );
    }
    seen.add(binding.reference);
  }
  // The same output feeding two fields is legitimate, so `path` may repeat.
  return { reference: field.reference, composition: field.composition, bindings };
};

/**
 * Parses and validates a binding manifest.
 *
 * Accepts the JSON text or an already-parsed object. Throws rather than
 * returning a partial manifest: a mis-authored mapping must fail loudly at load
 * rather than silently projecting nothing, which is how three earlier defects
 * in this area behaved.
 *
 * @param {string|object} source
 * @returns {{ version: number, fields: Array<{reference: string, composition: string, bindings: Array<{path: string, reference: string, required: boolean}>}> }}
 */
export const parseBindingManifest = (source) => {
  let raw = source;
  if (typeof source === 'string') {
    try {
      raw = JSON.parse(source);
    } catch (error) {
      fail(`The binding manifest is not valid JSON: ${error?.message ?? error}`, 'GATHER_COMPOSITION_MANIFEST_INVALID_JSON');
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('A binding manifest must be an object.', 'GATHER_COMPOSITION_MANIFEST_INVALID');
  }
  if (!SUPPORTED_MANIFEST_VERSIONS.includes(raw.version)) {
    fail(
      `Unsupported binding manifest version: ${JSON.stringify(raw.version)}.`,
      'GATHER_COMPOSITION_MANIFEST_VERSION',
      { supported: [...SUPPORTED_MANIFEST_VERSIONS] }
    );
  }
  if (!Array.isArray(raw.fields)) {
    fail('A binding manifest needs a `fields` array.', 'GATHER_COMPOSITION_MANIFEST_NO_FIELDS');
  }
  const fields = raw.fields.map((field, index) => assertField(field, index));
  const seen = new Set();
  for (const field of fields) {
    if (seen.has(field.reference)) {
      fail(
        `The manifest configures ${field.reference} more than once.`,
        'GATHER_COMPOSITION_FIELD_DUPLICATE',
        { reference: field.reference }
      );
    }
    seen.add(field.reference);
  }
  return { version: raw.version, fields };
};

/**
 * Finds the binding manifest among a form version's attachments.
 *
 * Returns `null` when the form ships none — a form with no composition fields
 * legitimately has no manifest.
 *
 * @param {Array<{filename?: string, text?: string}>} attachments
 */
export const bindingManifestFrom = (attachments) => {
  const found = (attachments ?? []).find((entry) => entry?.filename === BINDING_MANIFEST_FILENAME);
  if (!found) return null;
  if (!nonEmptyString(found.text)) {
    fail(
      `${BINDING_MANIFEST_FILENAME} is present but empty.`,
      'GATHER_COMPOSITION_MANIFEST_EMPTY'
    );
  }
  return parseBindingManifest(found.text);
};

const isGroupNode = (node) => node?.nodeType === 'group';

/**
 * Matches the form's composition groups against the manifest.
 *
 * Returns resolved fields plus **`problems`**, because every mismatch here is a
 * silent-empty risk of the kind that has bitten this area repeatedly: a group
 * declaring a composition with no manifest entry would otherwise render an
 * empty field and write nothing at all.
 *
 * @param {{ renderModel?: {nodes?: Array<object>}, manifest?: {fields?: Array<object>}|null }} input
 * @returns {{ fields: Array<{reference: string, compositionId: string, bindings: Array<{path: string, reference: string, required: boolean}>}>, problems: Array<{code: string, reference: string, message: string}> }}
 */
export const resolveCompositionFields = ({ renderModel, manifest } = {}) => {
  const nodes = renderModel?.nodes ?? [];
  const byReference = new Map(
    (manifest?.fields ?? []).map((field) => [field.reference, field])
  );
  const fields = [];
  const problems = [];
  const claimed = new Set();

  for (const node of nodes) {
    const config = compositionConfigFrom(node?.appearances);
    if (!config.enabled) continue;
    const reference = node?.reference;
    if (!nonEmptyString(reference)) continue;

    if (!isGroupNode(node)) {
      problems.push({
        code: 'GATHER_COMPOSITION_NOT_A_GROUP',
        reference,
        message: `${reference} carries a composition appearance but is a ${node?.nodeType ?? 'unknown'}, not a group.`,
      });
      continue;
    }

    const entry = byReference.get(reference);
    if (!entry) {
      problems.push({
        code: 'GATHER_COMPOSITION_NO_MANIFEST_ENTRY',
        reference,
        message: `${reference} declares composition "${config.compositionId}" but the binding manifest has no entry for it.`,
      });
      continue;
    }
    claimed.add(reference);
    if (entry.composition !== config.compositionId) {
      problems.push({
        code: 'GATHER_COMPOSITION_ID_MISMATCH',
        reference,
        message: `${reference} declares composition "${config.compositionId}" but the manifest binds "${entry.composition}".`,
      });
      continue;
    }
    fields.push({
      reference,
      compositionId: config.compositionId,
      bindings: entry.bindings,
    });
  }

  // A manifest entry for a group that does not declare a composition is dead
  // configuration — most likely a renamed group, and worth surfacing.
  for (const field of manifest?.fields ?? []) {
    if (claimed.has(field.reference)) continue;
    problems.push({
      code: 'GATHER_COMPOSITION_UNUSED_MANIFEST_ENTRY',
      reference: field.reference,
      message: `The binding manifest configures ${field.reference}, but no group there declares a composition.`,
    });
  }

  return { fields, problems };
};

/** The `{ reference, path }` bindings `createResultFieldWriter` consumes. */
export const writerBindingsFor = (field) =>
  (field?.bindings ?? []).map(({ reference, path }) => ({ reference, path }));
