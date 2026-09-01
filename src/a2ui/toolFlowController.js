/**
 * ToolFlowController — the orchestration seam for a Tool.
 *
 * Ownership boundary:
 *
 * ```text
 * Components          render UI
 * Capabilities        perform operations
 * Flow                renders one of several Views
 * ToolFlowController  decides which View is active
 * ```
 *
 * The controller owns the active view token and routes Tool events to bespoke
 * handlers. Presentation components never transition the flow, and capabilities
 * never decide what to show next — they return results, and the controller
 * decides.
 *
 * **This is deliberately not a statechart.** There are no guards, nested states,
 * entry/exit actions, timers, parallel states, or declarative transition tables.
 * The seam exists so that orchestration has one obvious home; a generic
 * declarative driver can replace the bespoke handler bodies later without
 * touching the `Flow`/`View` presentation abstraction. See
 * `docs/a2ui-v1.0-migration-notes.md` — "Tool orchestration: establish the seam
 * now, build the engine later".
 *
 * The active view token is the value a `Flow` matches its `views[].when`
 * against. Several tokens may resolve to one View, so a token is not
 * necessarily a View component id.
 *
 * `initialView` is the reset target. `startView` seeds the current view when the
 * flow is resumed from durable state — a `Flow`-bound token necessarily lives in
 * the surface data model, so the controller is seeded from it rather than
 * assuming a fresh start.
 *
 * @param {{
 *   initialView: string,
 *   startView?: string,
 *   onViewChange?: (view: string, previous: string) => void,
 *   handlers?: Record<string, (payload: any, controller: object) => any>,
 * }} options
 */
export const createToolFlowController = ({ initialView, startView, onViewChange, handlers = {} } = {}) => {
  if (typeof initialView !== 'string' || !initialView) {
    throw new Error('A tool flow controller requires an initial view.');
  }

  let activeView = typeof startView === 'string' && startView ? startView : initialView;

  const setView = (view) => {
    if (typeof view !== 'string' || !view) {
      throw new Error('A tool flow view must be a non-empty string.');
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
