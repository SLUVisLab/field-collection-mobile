import { Catalog } from '@a2ui/web_core/v0_9/catalog';
import { MessageProcessor } from '@a2ui/web_core/v0_9/processor';

/**
 * Render-free machinery for executing one A2UI surface.
 *
 * Generic hosting only — it builds the catalog, replays the definition's
 * messages, routes dispatched actions to a handler, and exposes the surface. It
 * says nothing about what the hosted definition *is*: an A2UI definition is not
 * automatically a "Tool".
 *
 * ```text
 * A2UIHost / createA2uiRuntime      A2UI execution machinery   (generic)
 *         ↓
 * composition-specific handler      what this composition's events mean
 *         ↓
 * FlowController                    which View is active
 * ```
 *
 * Composition *structure* is data; composition *behavior* is still partly code
 * (see docs/components-capabilities-ownership.md §10). This module must not grow
 * a declarative transition model until a second production composition shows
 * what the common model actually is.
 *
 * Kept free of JSX so the wiring is directly testable under `node --test`; the
 * React surface is the thin `A2UIHost` wrapper.
 *
 * @param {{
 *   tool: { catalogId: string, surfaceId: string, messages: object[] },  // an A2UI definition
 *   componentApis: Array<{ name: string, schema: unknown }>,
 * }} options
 */
export const createA2uiRuntime = ({ tool, componentApis } = {}) => {
  if (!tool || typeof tool.catalogId !== 'string' || typeof tool.surfaceId !== 'string') {
    throw new Error('An A2UI runtime requires a definition with a catalogId and surfaceId.');
  }
  if (!Array.isArray(tool.messages) || tool.messages.length === 0) {
    throw new Error(`Definition '${tool.surfaceId}' has no messages to render.`);
  }
  if (!Array.isArray(componentApis) || componentApis.length === 0) {
    throw new Error(`Definition '${tool.surfaceId}' requires the component APIs to register.`);
  }

  // The processor needs an action callback at construction, and the handler
  // needs the processor — so dispatch is routed through a slot the host can
  // refresh as its capabilities change.
  let actionHandler = null;

  const catalog = new Catalog(tool.catalogId, componentApis);
  const processor = new MessageProcessor([catalog], (action) => actionHandler?.(action));
  processor.processMessages(tool.messages);

  const surface = processor.model.getSurface(tool.surfaceId);
  if (!surface) {
    throw new Error(`Definition '${tool.surfaceId}' did not create its surface.`);
  }

  return {
    processor,
    surface,
    /** Installs (or replaces) the composition-specific action handler. */
    setActionHandler(handler) {
      actionHandler = typeof handler === 'function' ? handler : null;
      return actionHandler;
    },
    /** Current working state at `statePath` (default `/gather`). */
    state(statePath = '/gather') {
      return surface.dataModel.get(statePath) ?? {};
    },
  };
};
