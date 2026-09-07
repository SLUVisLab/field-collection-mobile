/**
 * The seam that carries a composition's computed result into XForms field
 * values — the general mechanism by which any derived value reaches a form.
 *
 * ```text
 * CameraView → descriptor → image.segment / measure.area
 *                                 ↓  typed result
 *                          result binding
 *                                 ↓  form.setValue(reference, "12.4")
 *                          XML only, no attachment
 * ```
 *
 * This is deliberately *not* the media path. `attachImageMedia` is what creates
 * instance-media rows, and those rows are the sole source of submission
 * attachments — so a workflow that writes values through here and never calls
 * it submits XML with zero image bytes. That is the point: an ODK image slot is
 * needed only when the pixels themselves are the datum. See
 * docs/components-capabilities-ownership.md §15.
 *
 * The structural guard below is load-bearing: an object or array can never
 * become a field value, so an `ImageAsset` cannot be stringified into a text
 * field by a mis-authored binding. Bind a scalar path *within* a result, or use
 * the attachment path.
 */

export class ResultBindingError extends Error {
  constructor(message, { code = 'GATHER_RESULT_BINDING_ERROR' } = {}) {
    super(message);
    this.name = 'ResultBindingError';
    this.code = code;
  }
}

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === '[object Object]';

/**
 * Reads a dot-separated path out of a result (`measurements.area.value`).
 * Returns `undefined` when any segment is missing — an absent optional value is
 * a legitimate outcome, not an error.
 */
export const readResultValue = (result, path) => {
  if (typeof path !== 'string' || path.length === 0) {
    throw new ResultBindingError('A result binding needs a non-empty value path.', {
      code: 'GATHER_RESULT_BINDING_INVALID_PATH',
    });
  }
  let current = result;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) return undefined;
    if (!isPlainObject(current) && !Array.isArray(current)) return undefined;
    current = current[segment];
  }
  return current;
};

/**
 * Coerces a computed value to the string an XForms field holds.
 *
 * Absent values clear the field rather than throwing, so an optional
 * measurement (a classification that was not run) is expressible. Structured
 * values are refused outright.
 */
export const toXFormsValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ResultBindingError('A non-finite number cannot be a form value.', {
        code: 'GATHER_RESULT_BINDING_NOT_FINITE',
      });
    }
    return String(value);
  }
  throw new ResultBindingError(
    'Only scalar values can be written to a form field. Bind a path within the result, or use the attachment path for media.',
    { code: 'GATHER_RESULT_BINDING_NOT_SCALAR' },
  );
};

const assertBindings = (bindings) => {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new ResultBindingError('A result writer needs at least one field binding.', {
      code: 'GATHER_RESULT_BINDING_EMPTY',
    });
  }
  for (const binding of bindings) {
    if (!binding || typeof binding.reference !== 'string' || binding.reference.length === 0) {
      throw new ResultBindingError('Each result binding needs an XForms reference.', {
        code: 'GATHER_RESULT_BINDING_INVALID_REFERENCE',
      });
    }
    if (typeof binding.path !== 'string' || binding.path.length === 0) {
      throw new ResultBindingError(`Binding for '${binding.reference}' needs a value path.`, {
        code: 'GATHER_RESULT_BINDING_INVALID_PATH',
      });
    }
  }
  return bindings;
};

/**
 * Builds a completion handler that writes a result into form fields.
 *
 * The returned function matches the host's `onAcceptedResult(result, context)`
 * shape, so it can be handed straight to `A2UIHost` — the host **delivers** the
 * typed result and this decides what completion means for an XForms field.
 *
 * @param {{
 *   form: { setValue: (reference: string, value: string) => Promise<unknown> },
 *   bindings: Array<{ reference: string, path: string }>,
 * }} options
 * @returns {(result: unknown) => Promise<Array<{ reference: string, path: string, value: string, present: boolean }>>}
 */
export const createResultFieldWriter = ({ form, bindings } = {}) => {
  if (typeof form?.setValue !== 'function') {
    throw new ResultBindingError('A result writer needs a form with setValue.', {
      code: 'GATHER_RESULT_BINDING_NO_FORM',
    });
  }
  const resolved = assertBindings(bindings);

  return async (result) => {
    // Coerce every binding before writing any of them, so a mis-authored
    // binding cannot leave the instance half-populated.
    const writes = resolved.map(({ reference, path }) => {
      const raw = readResultValue(result, path);
      return { reference, path, value: toXFormsValue(raw), present: raw !== undefined };
    });

    for (const write of writes) {
      await form.setValue(write.reference, write.value);
    }
    return writes;
  };
};
