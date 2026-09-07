import { useMemo } from 'react';

import { createA2uiRuntime } from '../a2uiRuntime.js';
import { A2uiInstrumentSurface } from './InstrumentSurface.js';

/**
 * Renders one A2UI surface on mobile.
 *
 * A thin React wrapper over `createA2uiRuntime` — it holds the runtime for the
 * lifetime of the mounted surface and refreshes the composition-specific action
 * handler as capabilities change. All hosting logic lives in the render-free
 * runtime; all behavior lives in `createActionHandler`.
 *
 * `onAcceptedResult` is the completion seam: the host **delivers** the typed
 * result, and the embedder decides what completion means (persist to an XForms
 * field, show it in a preview inspector, …). See
 * docs/components-capabilities-ownership.md §10.
 *
 * @param {{
 *   composition: { catalogId: string, surfaceId: string, messages: object[] },  // an A2UI definition
 *   componentApis: Array<object>,
 *   implementations: Record<string, { component: Function }>,
 *   createActionHandler: (deps: { processor: object, onAcceptedResult?: Function }) => Function,
 *   onAcceptedResult?: (result: unknown, context: object) => unknown,
 * }} props
 */
export function A2UIHost({
  composition,
  componentApis,
  functions,
  implementations,
  createActionHandler,
  onAcceptedResult,
}) {
  const runtime = useMemo(
    () => createA2uiRuntime({ composition, componentApis, functions }),
    [composition, componentApis, functions]
  );

  // Rebuilt each render so the handler closes over current capabilities; the
  // runtime keeps routing through one stable slot.
  runtime.setActionHandler(createActionHandler({ processor: runtime.processor, onAcceptedResult }));

  return <A2uiInstrumentSurface surface={runtime.surface} implementations={implementations} />;
}
