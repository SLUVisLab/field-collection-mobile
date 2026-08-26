# odk-xforms-webview

React Native WebView implementation of `XFormsHost`, using a hidden browser sidecar that runs stock `@getodk/xforms-engine`.

## Purpose

This package provides the runtime boundary validated in M2.4:

- native side: request/response bridge + lifecycle handling (`WebViewXFormsHost`)
- sidecar side: browser execution context (`createWebViewSidecarHtml`)
- WebView defaults for hidden sidecar mounting (`createSidecarWebViewProps`)

It does not render visible form UI and does not own Central networking.

## Exports

From [src/index.js](/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/packages/odk-xforms-webview/src/index.js):

- `WebViewXFormsHost`
- `WEBVIEW_XFORMS_HOST_ERROR_CODES`
- `createWebViewSidecarHtml(...)`
- `DEFAULT_SIDE_CAR_ENGINE_URL`
- `DEFAULT_BRIDGE_VERSION`
- `createSidecarWebViewProps(...)`
- `HIDDEN_XFORMS_SIDE_CAR_STYLE`

## Minimal usage

```js
import { WebView } from 'react-native-webview';
import {
  WebViewXFormsHost,
  createWebViewSidecarHtml,
  createSidecarWebViewProps,
} from '.../odk-xforms-webview/src/index.js';
```

Use `createWebViewSidecarHtml()` for the hidden sidecar source and pass `onMessage` to
`host.handleWebViewMessage(event)`.

## Dependencies

Runtime dependencies:

- `react-native-webview`
- local `odk-xforms-host` package contract

Peer dependencies:

- `react-native` (runtime host environment)

Test/runtime tooling:

- Node.js (for `node --test`)

## Development

Run tests:

```bash
cd packages/odk-xforms-webview
npm test
```
