/**
 * FlowController — owns **only** active View selection for an A2UI `Flow`.
 *
 * ```text
 * Components                render UI
 * Capabilities              perform operations
 * Flow                      renders one of several authored Views
 * FlowController            decides which View is active
 * ```
 *
 * It owns the active view token and routes events to composition-supplied
 * handlers; it owns no data, no results, and no capability invocation. It is not
 * a workflow engine, a composition engine, or a "Tool" controller — there are no
 * guards, nested states, entry/exit actions, timers, or transition schema.
 *
 * The active view token is the value a `Flow` matches its `views[].when`
 * against. Several tokens may map to one View, so a token is not necessarily a
 * View component id.
 *
 * See docs/components-capabilities-ownership.md §10 for why orchestration stays
 * deferred until a second production composition shows what to extract.
 */
export const createFlowController = ({ initialView, startView, onViewChange, handlers = {} } = {}) => {
  if (typeof initialView !== 'string' || !initialView) {
    throw new Error('A flow controller requires an initial view.');
  }

  let activeView = typeof startView === 'string' && startView ? startView : initialView;

  const setView = (view) => {
    if (typeof view !== 'string' || !view) {
      throw new Error('A flow view must be a non-empty string.');
    }
    const previous = activeView;
    activeView = view;
    onViewChange?.(view, previous);
    return activeView;
  };

  const reset = () => setView(initialView);

  const controller = {
    get activeView() {
      return activeView;
    },
    setView,
    reset,
    /**
     * Routes a Tool event to its handler. Unknown events are inert, so a surface
     * may declare actions this controller does not implement.
     */
    dispatch: async (event, payload) => {
      const handler = handlers[event];
      if (typeof handler !== 'function') return undefined;
      return handler(payload, controller);
    },
  };

  return controller;
};
