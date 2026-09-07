import { useEffect, useState } from 'react';

import { categoryForComponent } from 'gather-catalog';
import {
  CAPABILITY_AUTHORING_METADATA,
  CAPABILITY_DEFINITIONS,
  functionNameFor,
  HOST_FUNCTION_METADATA,
  usageExampleFor,
} from 'gather-capabilities';

import { applyRenderBatch } from './renderBatch.js';

const rendererReady = 'RENDERER_READY';
const renderA2ui = 'RENDER_A2UI';
const getCatalog = 'GET_CATALOG';
const catalog = 'A2UI_CATALOG';
const dataModelChange = 'DATA_MODEL_CHANGE';
const sendToServer = 'SEND_TO_SERVER';

/**
 * Adds Gather's own component taxonomy to the catalog payload.
 *
 * `generateInlineCatalog` builds each component entry from its Zod schema alone
 * and carries no metadata, so the category is attached here — in Gather's own
 * bridge adapter — rather than by patching `@a2ui/web_core`. An authoring host
 * that does not understand the annotation ignores it and keeps whatever
 * grouping it already did; nothing about rendering depends on it.
 *
 * `x-` prefixed keys are the JSON Schema convention for exactly this: an
 * annotation a validator must not treat as a constraint.
 */
/**
 * Components this renderer can render but does not offer authors.
 *
 * `GatherCapture` predates `CameraView`, its own API note says new Tools use
 * `CameraView`, and `gatherComponentApis` — "registerable by any Tool" —
 * already leaves it out. The Composer listed it anyway, beside the current one
 * under the same Capture heading, so an author had to guess.
 *
 * Withheld here rather than removed from the Catalog because rendering and
 * advertising are different questions: `SEGMENT_AND_MEASURE_INSTRUMENT` still
 * uses it, and a component that cannot render is a blank panel, not a tidier
 * menu.
 */
const UNADVERTISED_COMPONENTS = new Set(['GatherCapture']);

function withoutUnadvertised(payload) {
  const components = payload?.components;
  if (!components || typeof components !== 'object') return payload;
  for (const name of UNADVERTISED_COMPONENTS) delete components[name];
  return payload;
}

/**
 * Host metadata on the catalog payload: taxonomy, and how to call a Function.
 *
 * `generateInlineCatalog` builds each entry from its Zod schema alone and
 * carries no metadata, so this is attached here — in Gather's own bridge
 * adapter — rather than by patching `@a2ui/web_core`. A host that does not
 * understand the annotations ignores them; nothing about rendering depends on
 * them.
 *
 * The namespace is `x-host-`, not `x-gather-`. `x-` prefixed keys are the JSON
 * Schema convention for an annotation a validator must not treat as a
 * constraint, and the seam is meant to be generic — a Composer reading it
 * should not be reading a vendor's name.
 *
 * Two keys, deliberately, and no section or layout DSL: a host says *what* it
 * knows and the Composer decides how to show it.
 *
 * ```text
 * x-host-category   which group an entry belongs to
 * x-host-usage      a canonical, copyable invocation
 * ```
 *
 * Proven before anything was built on it: a probe annotation on every function
 * entry reached the editor intact, beside name/description/returnType/
 * parameters.
 */
const capabilityGroups = new Map(
  CAPABILITY_DEFINITIONS.map((definition) => [functionNameFor(definition.id), definition.group])
);

function withHostMetadata(payload) {
  const components = payload?.components;
  if (components && typeof components === 'object') {
    for (const [name, entry] of Object.entries(components)) {
      const category = categoryForComponent(name);
      if (category && entry && typeof entry === 'object') entry['x-host-category'] = category;
    }
  }

  for (const entry of payload?.functions ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    const metadata = CAPABILITY_AUTHORING_METADATA[entry.name] ?? HOST_FUNCTION_METADATA[entry.name];
    if (!metadata) continue;
    // A host function carries its own category; a Capability's comes from the
    // definition, which is the thing that actually knows.
    const category = metadata.category ?? capabilityGroups.get(entry.name);
    if (category) entry['x-host-category'] = category;
    const usage = usageExampleFor({ functionName: entry.name, metadata });
    if (usage) entry['x-host-usage'] = usage;
  }
  return payload;
}

function composerOrigin() {
  const candidate = new URLSearchParams(window.location.search).get('origin');
  return candidate && /^https?:\/\/[^/]+$/.test(candidate) ? candidate : window.location.origin;
}

function isComposerFrame() {
  return window.parent !== window;
}

function postToComposer(message) {
  if (isComposerFrame()) {
    window.parent.postMessage(message, composerOrigin());
  }
}

export function sendComposerAction(action) {
  postToComposer({
    type: sendToServer,
    payload: { version: 'v0.9', action },
  });
}

export function useComposerBridge(processor, gatherCatalog) {
  const [surfaces, setSurfaces] = useState(() => Array.from(processor.model.surfacesMap.values()));

  useEffect(() => {
    if (!isComposerFrame()) {
      return undefined;
    }

    const syncSurfaces = () => setSurfaces(Array.from(processor.model.surfacesMap.values()));
    const onMessage = (event) => {
      if (event.source !== window.parent || event.origin !== composerOrigin()) {
        return;
      }

      const message = event.data;
      if (!message || typeof message !== 'object') {
        return;
      }

      if (message.type === renderA2ui && Array.isArray(message.payload)) {
        // Composer re-sends full render batches that re-declare createSurface.
        // applyRenderBatch clears existing surfaces first so upstream does not
        // throw "Surface already exists" and abort rendering.
        try {
          applyRenderBatch(processor, message.payload);
        } catch (error) {
          console.error('Failed to process A2UI render batch.', error);
        }
        syncSurfaces();
      } else if (message.type === dataModelChange && message.payload?.updateDataModel) {
        processor.processMessages([{ version: 'v0.9', updateDataModel: message.payload.updateDataModel }]);
      } else if (message.type === getCatalog) {
        postToComposer({
          type: catalog,
          payload: withHostMetadata(withoutUnadvertised(processor.generateInlineCatalog(gatherCatalog))),
        });
      }
    };

    window.addEventListener('message', onMessage);
    postToComposer({ type: rendererReady });
    return () => window.removeEventListener('message', onMessage);
  }, [gatherCatalog, processor]);

  return surfaces;
}
