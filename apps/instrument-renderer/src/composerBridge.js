import { useEffect, useState } from 'react';

const rendererReady = 'RENDERER_READY';
const renderA2ui = 'RENDER_A2UI';
const getCatalog = 'GET_CATALOG';
const catalog = 'A2UI_CATALOG';
const dataModelChange = 'DATA_MODEL_CHANGE';
const sendToServer = 'SEND_TO_SERVER';

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
        processor.processMessages(message.payload);
        syncSurfaces();
      } else if (message.type === dataModelChange && message.payload?.updateDataModel) {
        processor.processMessages([{ version: 'v0.9', updateDataModel: message.payload.updateDataModel }]);
      } else if (message.type === getCatalog) {
        postToComposer({
          type: catalog,
          payload: processor.generateInlineCatalog(gatherCatalog),
        });
      }
    };

    window.addEventListener('message', onMessage);
    postToComposer({ type: rendererReady });
    return () => window.removeEventListener('message', onMessage);
  }, [gatherCatalog, processor]);

  return surfaces;
}
