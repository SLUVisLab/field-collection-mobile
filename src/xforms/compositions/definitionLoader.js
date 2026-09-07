/**
 * Loads an authored composition **from the form**, not from the app.
 *
 * ```text
 * XForm group appearance  gather-composition
 *         ↓
 * body::gather:composition  names the resource
 *         ↓
 * version-pinned form attachment
 *         ↓
 * parse + validate
 *         ↓
 * generic A2UIHost
 * ```
 *
 * This is what makes composition portability real rather than accidental: a
 * composition unknown when the installed binary was built arrives with the form
 * and runs. Gather registers executable primitives — Components, Capabilities,
 * host Functions — and **forms supply compositions**.
 *
 * Deliberately no new resource system: the definition rides the same
 * download/cache/fingerprint path as every other form resource, so it is pinned
 * to the form version exactly like the XForm itself, and a resumed draft gets
 * the composition it was started with.
 */

import { CompositionFieldError } from './recognition.js';

const fail = (message, code, details) => {
  throw new CompositionFieldError(message, { code, details });
};

/** UTF-8 text of a form resource, whether the catalog cached it as text or bytes. */
export const compositionSourceText = (attachment) => {
  if (typeof attachment?.text === 'string') return attachment.text;
  if (typeof attachment?.base64 !== 'string' || attachment.base64.length === 0) return '';
  const binary = globalThis.atob(attachment.base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** Messages a composition definition must carry to be renderable at all. */
const assertRenderable = (definition, { reference, filename }) => {
  const where = { reference, filename };
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    fail(`${filename} is not a composition definition object.`, 'GATHER_COMPOSITION_DEFINITION_INVALID', where);
  }
  for (const key of ['id', 'catalogId', 'surfaceId']) {
    if (typeof definition[key] !== 'string' || definition[key].length === 0) {
      fail(
        `${filename} is missing '${key}'.`,
        'GATHER_COMPOSITION_DEFINITION_INVALID',
        { ...where, missing: key }
      );
    }
  }
  if (!Array.isArray(definition.messages) || definition.messages.length === 0) {
    fail(`${filename} has no messages to render.`, 'GATHER_COMPOSITION_DEFINITION_INVALID', where);
  }
  return definition;
};

/**
 * Resolves the definition for one composition field.
 *
 * @param {{
 *   field: { reference: string, compositionId?: string|null, definitionResource?: string|null },
 *   attachments?: Array<{ filename?: string, text?: string }>,
 * }} input
 * @returns {object} the validated A2UI composition definition
 */
export const resolveCompositionDefinition = ({ field, attachments = [] } = {}) => {
  if (!field?.reference) {
    fail('A composition field is required.', 'GATHER_COMPOSITION_DEFINITION_NO_FIELD');
  }
  const filename = field.definitionResource;
  if (typeof filename !== 'string' || filename.length === 0) {
    fail(
      `${field.reference} does not name a composition resource. Set gather:composition on the group.`,
      'GATHER_COMPOSITION_DEFINITION_NOT_DECLARED',
      { reference: field.reference }
    );
  }

  const found = (attachments ?? []).find((entry) => entry?.filename === filename);
  if (!found) {
    // The form declares it; the download did not produce it. That is a form
    // packaging problem, and saying so beats "composition unavailable".
    fail(
      `${filename} is declared for ${field.reference} but is not among this form version's resources.`,
      'GATHER_COMPOSITION_DEFINITION_MISSING',
      { reference: field.reference, filename }
    );
  }
  // A composition resource arrives as text or as bytes, and which one is not
  // the form's choice: Central classifies anything declared through an itext
  // media value as `image` and serves it `application/octet-stream`, so the
  // catalog caches it as base64. An opaque bundle extension does the same.
  // Decoding here is what makes the artifact's *name* free of the transport's
  // opinion about it.
  const source = compositionSourceText(found);
  if (source.length === 0) {
    fail(
      `${filename} is present but empty.`,
      'GATHER_COMPOSITION_DEFINITION_EMPTY',
      { reference: field.reference, filename }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    fail(
      `${filename} is not valid JSON: ${error?.message ?? error}`,
      'GATHER_COMPOSITION_DEFINITION_INVALID_JSON',
      { reference: field.reference, filename }
    );
  }
  assertRenderable(parsed, { reference: field.reference, filename });

  // The group only names an id when it points at a composition this build
  // registered; the canonical `gather-composition` appearance names none,
  // because the artifact is the authority on its own identity. So this compares
  // two claims only when there are two — and a mismatch then means the form
  // points at a different composition than the group declares, which is worse
  // to render silently than to refuse.
  if (field.compositionId != null && parsed.id !== field.compositionId) {
    fail(
      `${filename} declares composition "${parsed.id}" but ${field.reference} names "${field.compositionId}".`,
      'GATHER_COMPOSITION_DEFINITION_ID_MISMATCH',
      { reference: field.reference, filename, declared: field.compositionId, found: parsed.id }
    );
  }
  return parsed;
};

/**
 * Resolves every composition field's definition, collecting failures instead of
 * throwing so one bad attachment cannot blank the whole form.
 *
 * @returns {{ definitions: Map<string, object>, problems: Array<{code: string, reference: string, message: string}> }}
 */
export const resolveCompositionDefinitions = ({ fields = [], attachments = [] } = {}) => {
  const definitions = new Map();
  const problems = [];
  for (const field of fields) {
    try {
      definitions.set(field.reference, resolveCompositionDefinition({ field, attachments }));
    } catch (error) {
      problems.push({
        code: error?.code ?? 'GATHER_COMPOSITION_DEFINITION_INVALID',
        reference: field.reference,
        message: error?.message ?? String(error),
      });
    }
  }
  return { definitions, problems };
};
