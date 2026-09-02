/**
 * Gather's **narrow** divergence from upstream action handling.
 *
 * ```text
 * raw component action
 *         │
 *   no ───┴──→ upstream GenericBinder ACTION path, untouched
 *  (event)     │
 *             yes (functionCall)
 *              ↓
 *        Gather action adapter
 *              ↓  resolve args with the existing A2UI context
 *              ↓  catalog.invoker(...)
 *              ↓  await
 *              ↓  validate serializable
 *              ↓  write resultPath, if declared
 * ```
 *
 * Gather owns execution of **action-position** FunctionCalls. `web_core`
 * continues to own ordinary bindings, **value-position** FunctionCalls, and
 * event dispatch. That split is the whole point: value-position calls are
 * reactive derivations that may re-evaluate as bindings change, while
 * action-position calls are imperative, user-triggered, expensive, and produce
 * state several later things consume.
 *
 * This is not a workaround. `state/surface-model.js` deliberately ignores
 * `{ functionCall }` and comments that local function calls are "handled by the
 * renderer or binder" — this is the renderer responsibility Gather's binding
 * layer previously omitted. See docs/a2ui-functioncall-gap.md.
 *
 * **`resultPath` is the one Gather wire extension.** Upstream defines no result
 * destination for a local action FunctionCall, so a user-triggered capability's
 * return value has nowhere to go. It is optional: without it the call executes
 * for its lifecycle effect and the return value is discarded.
 *
 * Deliberately *not* here: sequencing. One gesture → one FunctionCall → one
 * awaited result → optional write. No call/set/branch chains.
 */

/** The Gather extension key, a sibling of `functionCall` inside an action. */
export const RESULT_PATH_KEY = 'resultPath';

/**
 * Validates the Gather extension itself.
 *
 * Upstream deliberately preserves unknown action properties rather than
 * validating them, so nothing but this will catch a typo — and without it a
 * mis-authored `resultPath` becomes a late runtime failure at press time. This
 * runs when the handler is built, before any invocation or write.
 */
export const assertResultPath = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new A2uiActionError(`${RESULT_PATH_KEY} must be a non-empty string.`, {
      code: 'GATHER_A2UI_ACTION_INVALID',
    });
  }
  if (!value.startsWith('/')) {
    throw new A2uiActionError(
      `${RESULT_PATH_KEY} must be an absolute data-model path, got: ${value}`,
      { code: 'GATHER_A2UI_ACTION_INVALID' }
    );
  }
  if (value !== '/' && value.endsWith('/')) {
    throw new A2uiActionError(`${RESULT_PATH_KEY} must not end with '/': ${value}`, {
      code: 'GATHER_A2UI_ACTION_INVALID',
    });
  }
  if (value.includes('//')) {
    throw new A2uiActionError(`${RESULT_PATH_KEY} has an empty path segment: ${value}`, {
      code: 'GATHER_A2UI_ACTION_INVALID',
    });
  }
  return value;
};

export class A2uiActionError extends Error {
  constructor(message, { code = 'GATHER_A2UI_ACTION_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'A2uiActionError';
    this.code = code;
    this.cause = cause;
  }
}

/** True when this raw action is an action-position FunctionCall. */
export const isFunctionCallAction = (rawAction) =>
  Boolean(rawAction) &&
  typeof rawAction === 'object' &&
  !Array.isArray(rawAction) &&
  'functionCall' in rawAction;

/**
 * Rejects anything that must not reach the A2UI data model.
 *
 * A capability returns serializable Gather contracts. A Promise, function,
 * native handle or cycle here means something leaked, and writing it would
 * corrupt composition state in a way that is very hard to trace back.
 */
export const assertSerializableResult = (value, path = 'result', seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    if (type === 'number' && !Number.isFinite(value)) {
      throw new A2uiActionError(`${path} is not a finite number.`, {
        code: 'GATHER_A2UI_ACTION_NOT_SERIALIZABLE',
      });
    }
    return value;
  }
  if (type === 'function' || type === 'symbol' || type === 'bigint') {
    throw new A2uiActionError(`${path} is a ${type}, which cannot enter the data model.`, {
      code: 'GATHER_A2UI_ACTION_NOT_SERIALIZABLE',
    });
  }
  if (typeof value?.then === 'function') {
    throw new A2uiActionError(`${path} is a Promise — it must be awaited before it is stored.`, {
      code: 'GATHER_A2UI_ACTION_NOT_SERIALIZABLE',
    });
  }
  if (seen.has(value)) {
    throw new A2uiActionError(`${path} is cyclic.`, {
      code: 'GATHER_A2UI_ACTION_NOT_SERIALIZABLE',
    });
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSerializableResult(entry, `${path}[${index}]`, seen));
    return value;
  }
  // A class instance is a native handle as far as the data model is concerned.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new A2uiActionError(
      `${path} is a ${value.constructor?.name ?? 'non-plain'} instance, which cannot enter the data model.`,
      { code: 'GATHER_A2UI_ACTION_NOT_SERIALIZABLE' }
    );
  }
  for (const [key, entry] of Object.entries(value)) {
    assertSerializableResult(entry, `${path}.${key}`, seen);
  }
  return value;
};

/**
 * Builds the callable for an action-position FunctionCall.
 *
 * Always async, so a synchronous capability works through the same path.
 * **A failure writes nothing**: argument resolution, execution and result
 * validation all happen before `resultPath` is touched.
 *
 * @param {{
 *   rawAction: object,
 *   resolveDynamicValue: (value: unknown) => unknown,
 *   invoke: (name: string, args: object) => unknown,
 *   writeResult: (path: string, value: unknown) => void,
 *   onError?: (error: Error) => void,
 * }} deps
 */
export const createFunctionCallHandler = ({
  rawAction,
  resolveDynamicValue,
  invoke,
  writeResult,
  onError,
} = {}) => {
  if (!isFunctionCallAction(rawAction)) {
    throw new A2uiActionError('Not a functionCall action.', { code: 'GATHER_A2UI_ACTION_INVALID' });
  }
  if (typeof resolveDynamicValue !== 'function' || typeof invoke !== 'function') {
    throw new A2uiActionError('A functionCall handler needs argument resolution and an invoker.', {
      code: 'GATHER_A2UI_ACTION_INVALID',
    });
  }
  const call = rawAction.functionCall;
  const resultPath = rawAction[RESULT_PATH_KEY] ?? null;
  if (resultPath !== null) assertResultPath(resultPath);
  if (typeof call?.call !== 'string' || call.call.length === 0) {
    throw new A2uiActionError('A functionCall needs a function name.', {
      code: 'GATHER_A2UI_ACTION_INVALID',
    });
  }

  return async () => {
    try {
      // Upstream's own resolution, so path/literal semantics cannot drift from
      // what value-position calls do.
      const args = {};
      for (const [key, value] of Object.entries(call.args ?? {})) {
        args[key] = resolveDynamicValue(value);
      }
      const result = await invoke(call.call, args);
      if (resultPath === null) return result;
      assertSerializableResult(result, `${call.call} result`);
      writeResult(resultPath, result);
      return result;
    } catch (error) {
      const wrapped =
        error instanceof A2uiActionError
          ? error
          : new A2uiActionError(error?.message ?? String(error), {
              code: 'GATHER_A2UI_ACTION_FAILED',
              cause: error,
            });
      // Surfaced, never swallowed — and `resultPath` is untouched.
      if (typeof onError === 'function') onError(wrapped);
      else throw wrapped;
      return undefined;
    }
  };
};
