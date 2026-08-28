import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

import { XFormsStore, XFORMS_REACT_PHASES, areNodeStatesEqual } from './XFormsStore.js';

const XFormsStoreContext = createContext(null);

const isSameValue = Object.is;

const selectSnapshot = (state) => state.snapshot;
const selectPhase = (state) => state.phase;
const selectError = (state) => state.error;
const selectLastEvent = (state) => state.lastEvent;

const useStore = () => {
  const store = useContext(XFormsStoreContext);
  if (store == null) {
    throw new Error('XFormsProvider is required');
  }
  return store;
};

export const XFormsProvider = ({ host, children }) => {
  const store = useMemo(() => new XFormsStore({ host }), [host]);
  useEffect(() => {
    store.start();
    return () => {
      store.dispose().catch((error) => {
        console.error('Failed to dispose XFormsStore', error);
      });
    };
  }, [store]);
  return createElement(XFormsStoreContext.Provider, { value: store }, children);
};

export const useXFormSelector = (selector, isEqual = isSameValue) => {
  const store = useStore();
  const subscribe = useCallback(
    (notify) => store.subscribeToSelection(selector, isEqual, notify),
    [store, selector, isEqual]
  );
  const getSnapshot = useCallback(() => store.getSelection(selector), [store, selector]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export const useXForm = () => {
  const store = useStore();
  const phase = useXFormSelector(selectPhase);
  const snapshot = useXFormSelector(selectSnapshot);
  const error = useXFormSelector(selectError);
  const lastEvent = useXFormSelector(selectLastEvent);

  const actions = useMemo(
    () => ({
      initialize: () => store.initialize(),
      loadForm: (xml, attachments = null) => store.loadForm(xml, attachments),
      refreshSnapshot: (reason) => store.refreshSnapshot(reason),
      setValue: (reference, value) => store.setValue(reference, value),
      addRepeat: (reference) => store.addRepeat(reference),
      removeRepeat: (reference, instanceId = null) => store.removeRepeat(reference, instanceId),
      serialize: () => store.serialize(),
      inspectMediaSeam: () => store.inspectMediaSeam(),
    }),
    [store]
  );

  return {
    phase,
    snapshot,
    error,
    lastEvent,
    ready: phase === XFORMS_REACT_PHASES.READY,
    loading: phase === XFORMS_REACT_PHASES.LOADING,
    ...actions,
  };
};

export const useXFormsNode = (reference) => {
  const store = useStore();
  const selector = useCallback(
    (state) => state.snapshot?.nodesByReference?.[reference] ?? null,
    [reference]
  );
  const node = useXFormSelector(selector, areNodeStatesEqual);
  const setValue = useCallback((value) => store.setValue(reference, value), [store, reference]);
  return {
    reference,
    node,
    setValue,
  };
};

export const useXFormsQuestion = (reference) => {
  const { node, setValue } = useXFormsNode(reference);
  return useMemo(
    () => ({
      reference,
      value: node?.value ?? null,
      valueType: node?.valueType ?? null,
      instanceValue: node?.instanceValue ?? null,
      relevant: node?.relevant ?? null,
      required: node?.required ?? null,
      readonly: node?.readonly ?? null,
      valid: node?.constraintValid == null ? null : Boolean(node.constraintValid),
      constraintValid: node?.constraintValid ?? null,
      setValue,
    }),
    [node, reference, setValue]
  );
};

export const useXFormsChoices = (reference) => {
  const { node, setValue } = useXFormsNode(reference);
  return useMemo(
    () => ({
      reference,
      value: node?.value ?? null,
      valueType: node?.valueType ?? null,
      instanceValue: node?.instanceValue ?? null,
      choices: Array.isArray(node?.choices) ? node.choices : [],
      setValue,
    }),
    [node, reference, setValue]
  );
};

const createRepeatInstanceReferenceMatcher = (reference) =>
  new RegExp(`^${reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[\\d+\\]$`);

export const useXFormsRepeat = (reference) => {
  const store = useStore();
  const snapshot = useXFormSelector(selectSnapshot);
  const node = snapshot?.nodesByReference?.[reference] ?? null;
  const matcher = useMemo(() => createRepeatInstanceReferenceMatcher(reference), [reference]);

  const instanceReferences = useMemo(() => {
    const keys = Object.keys(snapshot?.nodesByReference ?? {});
    return keys.filter((key) => matcher.test(key));
  }, [matcher, snapshot]);

  const add = useCallback(() => store.addRepeat(reference), [store, reference]);
  const remove = useCallback(
    (instanceId = null) => store.removeRepeat(reference, instanceId),
    [store, reference]
  );

  return {
    reference,
    node,
    instances: instanceReferences,
    add,
    remove,
  };
};

export { XFormsStore, XFORMS_REACT_PHASES };
