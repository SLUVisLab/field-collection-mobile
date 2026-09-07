# odk-xforms-webview

React Native WebView implementation of `XFormsHost`, using a hidden browser sidecar that runs stock `@getodk/xforms-engine`.

## Purpose

This package provides the runtime boundary validated in M2.4:

- native side: request/response bridge + lifecycle handling (`WebViewXFormsHost`)
- sidecar side: browser execution context (`createWebViewSidecarHtml`)
- WebView defaults for hidden sidecar mounting (`createSidecarWebViewProps`)

It does not render visible form UI and does not own Central networking.

## Bridge request types

The sidecar bridge handles: `initialize`, `loadForm`, `loadInstance`,
`getSnapshot`, `getRenderModel`, `setValue`, `addRepeat`, `removeRepeat`,
`serialize`, `inspectMediaSeam`, `dispose`.

- `loadInstance` restores a previously serialized instance by handing the engine
  an `InstanceData` (`FormData` with an `xml_submission_file` `File`) to its
  `LoadFormResult.restoreInstance(...)` entrypoint — the engine-authoritative
  "subsequent load", **not** a replay of `setValue` calls.
- `getRenderModel` walks the engine's live node tree in document order and
  projects the `FormRenderModel` (labels/hints/control type/appearance/structural
  sequence, including parsed upload media type/accept) defined by
  `odk-xforms-host`.
- For a binary upload, `setValue(reference, safeFilename)` creates an ephemeral
  same-named web `File` so the engine validates and serializes the filename. The
  native app remains responsible for durable bytes and OpenRosa's native file
  body; this bridge does not copy media over the WebView boundary.

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
} from 'odk-xforms-webview';
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
