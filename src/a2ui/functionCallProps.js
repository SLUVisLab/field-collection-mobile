/**
 * Action-position `functionCall` props, for any host that binds A2UI components.
 *
 * Upstream A2UI resolves a **value-position** `functionCall` reactively — it is
 * an expression, evaluated when its inputs change. An **action-position** one
 * is different: it runs when a user presses something, it may be slow, and its
 * result usually has somewhere to go. Upstream has no notion of that
 * destination, so `resultPath` is Gather's:
 *
 * ```text
 * value-position    upstream reactive evaluation
 * action-position   lazy, user-triggered, awaited, optional resultPath write
 * ```
 *
 * Both the mobile binder and the web renderer need identical behaviour here —
 * an authored Tool chains `gather_persistAsset` → `image_segment` →
 * `measure_area` purely through `resultPath`, and a host that ignores it runs
 * every call successfully while nothing reaches the next one. That failure is
 * silent, which is why this lives in one place rather than two.
 *
 * Deliberately not a hook, so a host may memoize it however it likes.
 */
import { createFunctionCallHandler, isFunctionCallAction } from './actionAdapter.js';

/**
 * Replaces every action-position `functionCall` property with a callable.
 *
 * Reads the **raw** component properties rather than the bound ones, because
 * `resultPath` is Gather metadata that no schema declares — binding would drop
 * it, which is exactly what happened in the renderer before this existed.
 *
 * @param {{ context: object, props: object }} input
 * @returns {object} the props, with handlers substituted where one applies
 */
export const withFunctionCallActions = ({ context, props }) => {
  const raw = context?.componentModel?.properties ?? null;
  if (!raw) return props;

  let overrides = null;
  for (const [key, value] of Object.entries(raw)) {
    if (!isFunctionCallAction(value)) continue;
    const handler = createFunctionCallHandler({
      rawAction: value,
      resolveDynamicValue: (input) => context.dataContext.resolveDynamicValue(input),
      invoke: (name, args) => context.dataContext.functionInvoker(name, args, context.dataContext, undefined),
      // The context's own setter, so path semantics match every other write.
      writeResult: (path, result) => context.dataContext.set(path, result),
      onError: (error) => context.dataContext.dispatchExpressionError?.(error, value.functionCall?.call),
    });
    overrides = { ...(overrides ?? {}), [key]: handler };
  }
  return overrides ? { ...props, ...overrides } : props;
};
