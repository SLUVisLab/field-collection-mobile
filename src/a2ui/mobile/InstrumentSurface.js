import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ComponentContext, GenericBinder } from '@a2ui/web_core/v0_9/bindings';

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

export function bindInstrumentComponent(schema, Component) {
  return function BoundInstrumentComponent({ context, buildChild }) {
    const props = useBoundProps(context, schema);
    return <Component {...props} context={context} buildChild={buildChild} />;
  };
}

export function A2uiInstrumentSurface({ surface, implementations }) {
  return <InstrumentNode surface={surface} componentId="root" implementations={implementations} />;
}
