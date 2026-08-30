import React, { useState } from 'react';
import { A2uiSurface, basicCatalog } from '@a2ui/react/v0_9';
import { Catalog, MessageProcessor } from '@a2ui/web_core/v0_9';

import { GATHER_CATALOG_ID, SEGMENT_AND_MEASURE_INSTRUMENT } from 'gather-catalog';

import { sendComposerAction, useComposerBridge } from './composerBridge.js';
import { createCapabilityActionHandler } from '../../../src/a2ui/capabilityActionAdapter.js';
import { fixtureCapabilities } from './fixtureCapabilities.js';
import { GatherCapture, MaskReview } from './gatherComponents.jsx';
import './app.css';

const gatherCatalog = new Catalog(
  GATHER_CATALOG_ID,
  [...basicCatalog.components.values(), GatherCapture, MaskReview],
  [...basicCatalog.functions.values()]
);

export function App() {
  const [lastAction, setLastAction] = useState(null);
  let handleAction;
  const [processor] = useState(() => {
    const next = new MessageProcessor([gatherCatalog], (action) => {
      setLastAction(action);
      sendComposerAction(action);
      return handleAction?.(action);
    });
    if (window.parent === window) {
      next.processMessages(SEGMENT_AND_MEASURE_INSTRUMENT.messages);
    }
    return next;
  });
  handleAction = createCapabilityActionHandler({ processor, capabilities: fixtureCapabilities });
  const surfaces = useComposerBridge(processor, gatherCatalog);

  return (
    <main className="renderer-shell">
      {surfaces.map((surface) => <A2uiSurface key={surface.id} surface={surface} />)}
      {lastAction ? <output data-testid="last-action">{lastAction.name}</output> : null}
    </main>
  );
}
