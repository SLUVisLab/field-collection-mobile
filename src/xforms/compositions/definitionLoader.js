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
  if (typeof found.text !== 'string' || found.text.length === 0) {
    fail(
      `${filename} is present but empty.`,
      'GATHER_COMPOSITION_DEFINITION_EMPTY',
      { reference: field.reference, filename }
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(found.text);
  } catch (error) {
    fail(
      `${filename} is not valid JSON: ${error?.message ?? error}`,
      'GATHER_COMPOSITION_DEFINITION_INVALID_JSON',
      { reference: field.reference, filename }
    );
  }
  assertRenderable(parsed, { reference: field.reference, filename });

  if (parsed.id !== field.compositionId) {
    // A mismatch means the form points at a different composition than the
    // group declares — silently rendering the attachment would be worse.
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
