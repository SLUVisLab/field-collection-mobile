import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEBVIEW_XFORMS_HOST_ERROR_CODES,
  WebViewXFormsHost,
  createSidecarWebViewProps,
  createWebViewSidecarHtml,
} from '../src/index.js';

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const toMessageEvent = (message) => ({
  nativeEvent: {
    data: JSON.stringify(message),
  },
});

const extractRequest = (script) => {
  const match = script.match(/__xformsSidecarReceive\(([\s\S]+)\);\s*true;/);
  if (match == null) {
    throw new Error(`Could not parse request from script: ${script}`);
  }
  return JSON.parse(match[1]);
};

const createMockRef = () => {
  const injectedScripts = [];
  return {
    injectedScripts,
    ref: {
      current: {
        injectJavaScript(script) {
          injectedScripts.push(script);
        },
      },
    },
  };
};

test('createWebViewSidecarHtml includes expected bridge hooks and configurable engine url', () => {
  const html = createWebViewSidecarHtml({
    engineUrl: 'https://example.invalid/engine.js',
    bridgeVersion: 'test-bridge-v1',
  });
  assert.match(html, /__xformsSidecarReceive/);
  assert.match(html, /ReactNativeWebView/);
  assert.match(html, /transport\.postMessage/);
  assert.match(html, /https:\/\/example\.invalid\/engine\.js/);
  assert.match(html, /test-bridge-v1/);
});

test('createWebViewSidecarHtml exposes a generic fetchFormAttachment resource seam', () => {
  const html = createWebViewSidecarHtml();
  // The sidecar builds a fetchFormAttachment from provided attachments and
  // passes it to the engine's loadForm — the external-resource mechanism used
  // for Entity List CSVs and other jr: resources.
  assert.match(html, /fetchFormAttachment/);
  assert.match(html, /buildLoadFormOptions/);
  assert.match(html, /state\.loadForm\(xml, options\)/);
});

test('WebViewXFormsHost.loadForm forwards resource attachments in the request payload', async () => {
  const mock = createMockRef();
  const host = new WebViewXFormsHost({ webViewRef: mock.ref, requestTimeoutMs: 250 });
  host.handleWebViewMessage(toMessageEvent({ type: 'ready', payload: {} }));
  await flushMicrotasks();

  const attachments = [{ filename: 'plants.csv', contentType: 'text/csv', text: 'name,label\n' }];
  const loadPromise = host.loadForm('<xml/>', attachments);
  await flushMicrotasks();

  const request = extractRequest(mock.injectedScripts.at(-1));
  assert.equal(request.type, 'loadForm');
  assert.equal(request.payload.xml, '<xml/>');
  assert.deepEqual(request.payload.attachments, attachments);

  host.handleWebViewMessage(
    toMessageEvent({ id: request.id, type: 'response', ok: true, payload: { loadStatus: 'success' } })
  );
  await loadPromise;
  await host.dispose();
});

test('createSidecarWebViewProps returns expected hidden WebView defaults', () => {
  const onMessage = () => {};
  const props = createSidecarWebViewProps({
    html: '<html></html>',
    onMessage,
  });
  assert.equal(props.onMessage, onMessage);
  assert.equal(props.source.html, '<html></html>');
  assert.deepEqual(props.originWhitelist, ['*']);
  assert.equal(props.javaScriptEnabled, true);
  assert.equal(props.domStorageEnabled, true);
  assert.equal(props.style.width, 1);
  assert.equal(props.style.height, 1);
});

test('WebViewXFormsHost waits for ready, then resolves request response and records metrics', async () => {
  const mock = createMockRef();
  const host = new WebViewXFormsHost({
    webViewRef: mock.ref,
    requestTimeoutMs: 250,
  });

  const initializePromise = host.initialize();
  assert.equal(mock.injectedScripts.length, 0);

  host.handleWebViewMessage(toMessageEvent({ type: 'ready', payload: { bridgeVersion: 't1' } }));
  await flushMicrotasks();
  assert.equal(mock.injectedScripts.length, 1);
  const request = extractRequest(mock.injectedScripts[0]);
  assert.equal(request.type, 'initialize');

  host.handleWebViewMessage(
    toMessageEvent({
      id: request.id,
      type: 'response',
      ok: true,
      payload: { webAssemblyAvailable: true },
      latencyMs: 7,
    })
  );
  const result = await initializePromise;
  assert.deepEqual(result, { webAssemblyAvailable: true });
  const metrics = host.getMetrics();
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].requestType, 'initialize');
  assert.equal(metrics[0].ok, true);

  await host.dispose();
});

test('WebViewXFormsHost rejects timed out requests with structured error code', async () => {
  const mock = createMockRef();
  const host = new WebViewXFormsHost({
    webViewRef: mock.ref,
    requestTimeoutMs: 30,
  });
  host.handleWebViewMessage(toMessageEvent({ type: 'ready', payload: {} }));

  await assert.rejects(host.getSnapshot(), (error) => {
    assert.equal(error.code, WEBVIEW_XFORMS_HOST_ERROR_CODES.TIMEOUT);
    assert.match(error.message, /Request timed out: getSnapshot/);
    return true;
  });

  await host.dispose();
});

test('WebViewXFormsHost dispose rejects pending requests and further calls', async () => {
  const mock = createMockRef();
  const host = new WebViewXFormsHost({
    webViewRef: mock.ref,
    requestTimeoutMs: 250,
  });
  host.handleWebViewMessage(toMessageEvent({ type: 'ready', payload: {} }));

  const pending = host.setValue('/data/name', 'abc');
  await flushMicrotasks();
  assert.equal(mock.injectedScripts.length, 1);

  await host.dispose();

  await assert.rejects(pending, (error) => {
    assert.equal(error.code, WEBVIEW_XFORMS_HOST_ERROR_CODES.DISPOSED);
    assert.match(error.message, /Host disposed while request was pending/);
    return true;
  });

  await assert.rejects(host.serialize(), (error) => {
    assert.equal(error.code, WEBVIEW_XFORMS_HOST_ERROR_CODES.DISPOSED);
    return true;
  });
});
