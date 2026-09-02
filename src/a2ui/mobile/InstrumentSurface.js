import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ComponentContext, GenericBinder } from '@a2ui/web_core/v0_9/bindings';

import { createFunctionCallHandler, isFunctionCallAction } from '../actionAdapter.js';

// Surface + binding machinery only. The mobile implementations of the upstream
// A2UI Basic Catalog live in `basicCatalog.js`.

const useBoundProps = (context, schema) => {
  const binderRef = useRef(null);
  if (!binderRef.current || binderRef.current.context !== context) {
    binderRef.current?.dispose();
    binderRef.current = new GenericBinder(context, schema);
  }
  const binder = binderRef.current;
  const subscribe = useCallback((notify) => {
    const subscription = binder.subscribe(notify);
    return () => subscription.unsubscribe();
  }, [binder]);
  const getSnapshot = useCallback(() => binder.snapshot, [binder]);
  useEffect(() => () => binder.dispose(), [binder]);
  return useSyncExternalStore(subscribe, getSnapshot);
};

function InstrumentNode({ surface, componentId, implementations, basePath = '/' }) {
  const store = useMemo(() => {
    let version = 0;
    return {
      subscribe(notify) {
        const created = surface.componentsModel.onCreated.subscribe(() => { version += 1; notify(); });
        const deleted = surface.componentsModel.onDeleted.subscribe(() => { version += 1; notify(); });
        return () => { created.unsubscribe(); deleted.unsubscribe(); };
      },
      getSnapshot() {
        const model = surface.componentsModel.get(componentId);
        return model ? `${model.type}-${version}` : `missing-${version}`;
      },
    };
  }, [surface, componentId]);
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  const model = surface.componentsModel.get(componentId);
  const implementation = model ? implementations[model.type] : null;
  const context = useMemo(
    () => model && implementation ? new ComponentContext(surface, componentId, basePath) : null,
    [surface, componentId, basePath, model, implementation]
  );
  if (!model || !implementation || !context) return null;
  return <implementation.component context={context} buildChild={(id, path) => <InstrumentNode surface={surface} componentId={id} implementations={implementations} basePath={path ?? basePath} />} />;
}

/**
 * Replaces action props that are **action-position FunctionCalls** with a
 * Gather-owned callable.
 *
 * Deliberately narrow: anything that is not a `functionCall` — `event` actions
 * above all — keeps whatever `GenericBinder` produced, so upstream still owns
 * ordinary bindings, value-position FunctionCalls and event dispatch. See
 * `src/a2ui/actionAdapter.js`.
 */
const useFunctionCallActions = (context, props) => {
  // The authored properties, before binding — `resultPath` survives message
  // processing because component properties are stored raw.
  const raw = context?.componentModel?.properties ?? null;
  return useMemo(() => {
    if (!raw) return props;
    let overrides = null;
    for (const [key, value] of Object.entries(raw)) {
      if (!isFunctionCallAction(value)) continue;
      const handler = createFunctionCallHandler({
        rawAction: value,
        resolveDynamicValue: (input) => context.dataContext.resolveDynamicValue(input),
        invoke: (name, args) =>
          context.dataContext.functionInvoker(name, args, context.dataContext, undefined),
        // The context's own setter, so path semantics match every other write.
        writeResult: (path, result) => context.dataContext.set(path, result),
        onError: (error) => context.dataContext.dispatchExpressionError(error, value.functionCall?.call),
      });
      overrides = { ...(overrides ?? {}), [key]: handler };
    }
    return overrides ? { ...props, ...overrides } : props;
    // `raw` identity changes when the component model updates, which is the
    // only time a handler needs rebuilding.
  }, [context, props, raw]);
};

export function bindInstrumentComponent(schema, Component) {
  return function BoundInstrumentComponent({ context, buildChild }) {
    const bound = useBoundProps(context, schema);
    const props = useFunctionCallActions(context, bound);
    return <Component {...props} context={context} buildChild={buildChild} />;
  };
}

export function A2uiInstrumentSurface({ surface, implementations }) {
  return <InstrumentNode surface={surface} componentId="root" implementations={implementations} />;
}
