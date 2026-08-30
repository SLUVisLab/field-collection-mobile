import React, { useState } from 'react';
import { A2uiSurface, basicCatalog, MarkdownContext } from '@a2ui/react/v0_9';
import { Catalog, MessageProcessor } from '@a2ui/web_core/v0_9';
import { MockFrame } from 'react-mockframe';
import 'react-mockframe/styles/mockframe-android.css';

import {
  GATHER_CATALOG_ID,
  SEGMENT_AND_MEASURE_INSTRUMENT,
} from 'gather-catalog';
import { GATHER_LAYOUT_TOKENS, GATHER_PALETTE } from 'gather-components';

import { sendComposerAction, useComposerBridge } from './composerBridge.js';
import { createCapabilityActionHandler } from '../../../src/a2ui/capabilityActionAdapter.js';
import { fixtureCapabilities } from './fixtureCapabilities.js';
import { GatherCapture, MaskReview } from './gatherComponents.jsx';
import { renderMarkdown } from './markdownRenderer.js';
import './app.css';

const gatherCatalog = new Catalog(
  GATHER_CATALOG_ID,
  [...basicCatalog.components.values(), GatherCapture, MaskReview],
  [...basicCatalog.functions.values()]
);

const { field, neutral, primary } = GATHER_PALETTE;
const { radii, spacing, typography, interaction } = GATHER_LAYOUT_TOKENS;
const presentationVariables = Object.freeze({
  '--gather-background': neutral.white,
  '--gather-surface': neutral[50],
  '--gather-text': neutral[900],
  '--gather-muted': neutral[600],
  '--gather-border': neutral[200],
  '--gather-border-strong': neutral[400],
  '--gather-primary': primary[600],
  '--gather-primary-pressed': primary[800],
  '--gather-secondary': field[600],
  '--gather-secondary-pressed': field[700],
  '--gather-space-xs': `${spacing.xs}px`,
  '--gather-space-sm': `${spacing.sm}px`,
  '--gather-space-md': `${spacing.md}px`,
  '--gather-space-lg': `${spacing.lg}px`,
  '--gather-space-xl': `${spacing.xl}px`,
  '--gather-radius-sm': `${radii.sm}px`,
  '--gather-radius-md': `${radii.md}px`,
  '--gather-radius-lg': `${radii.lg}px`,
  '--gather-font-helper': `${typography.helper}px`,
  '--gather-font-body': `${typography.body}px`,
  '--gather-font-heading': `${typography.heading}px`,
  '--gather-font-title': `${typography.title}px`,
  '--gather-touch-secondary': `${interaction.preferredTouchTarget}px`,
  '--gather-touch-primary': `${interaction.primaryActionHeight}px`,
  // Map the upstream Basic Catalog variables to the same Gather primitives.
  '--a2ui-color-background': neutral.white,
  '--a2ui-color-on-background': neutral[900],
  '--a2ui-color-surface': neutral[50],
  '--a2ui-color-on-surface': neutral[900],
  '--a2ui-color-primary': primary[600],
  '--a2ui-color-primary-hover': primary[800],
  '--a2ui-color-on-primary': neutral.white,
  '--a2ui-color-secondary': field[600],
  '--a2ui-color-on-secondary': neutral.white,
  '--a2ui-color-border': neutral[200],
  '--a2ui-border-radius': `${radii.md}px`,
  '--a2ui-grid-base': `${spacing.xs}px`,
  '--a2ui-font-size': `${typography.heading}px`,
  '--a2ui-font-scale': '1',
});

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
      <MockFrame device="Pixel 10" color="mint" width={360} height={760} zoom={0.72}>
        <MarkdownContext.Provider value={renderMarkdown}>
          <div className="gather-screen" style={presentationVariables}>
            <header className="gather-app-bar">
              <span className="gather-app-name">Segment &amp; Measure</span>
              <span className="gather-app-mode">Generic image measurements</span>
            </header>
            <section className="gather-instrument-content">
              {surfaces.map((surface) => <A2uiSurface key={surface.id} surface={surface} />)}
            </section>
            {lastAction ? <output className="gather-action-status" data-testid="last-action">{lastAction.name}</output> : null}
          </div>
        </MarkdownContext.Provider>
      </MockFrame>
    </main>
  );
}
