# Composer bridge gate

Proves that a **self-hosted** A2UI Composer can drive the Gather renderer, all
the way from the iframe handshake to an action coming back.

This exists because the failure it catches is invisible from the server. On
2026-09-05 the renderer served `200`, its bridge code was correct, and the
integration had already been verified live against the Google-hosted
Composer — but under our own hostname the Composer sat forever waiting for a
renderer that never attached. The renderer's CSP said

```text
frame-ancestors https://a2ui-project.github.io
```

so the browser refused to frame it and reported the refusal only in the
console of a page nobody was watching. Nothing on the server side was wrong,
and nothing on the server side could have told you.

## Running it

```bash
# with the local deployment up (see openfieldworks-web/deploy/README.md)
npm run gate:composer-bridge
```

It needs Google Chrome installed and `playwright-core` available; both are
dev-machine tools, which is why this is a gate rather than a unit test.

`host.html` reproduces what the Composer's preview panel does — the same
sandbox attributes and the same documented `?origin=` pairing contract — and is
copied into the running Composer container so that it runs from the **real**
Composer origin. Serving it from anywhere else would test a different origin
than the one the CSP is about, which is the entire point.

## What it asserts

```text
1  RENDERER_READY → GET_CATALOG → A2UI_CATALOG   catalog handshake
2  RENDER_A2UI                                    the canonical instrument renders
3  DATA_MODEL_CHANGE                              Flow selects a different view
4  SEND_TO_SERVER                                 a button press returns an action
```

Step 2 renders `SEGMENT_AND_MEASURE_INSTRUMENT` from `gather-catalog` — the
composition that actually ships, not a fixture written for this gate.

## Why a probe page and not the Composer's own UI

The Composer's real preview panel was driven too, and it works: selecting
"Gather renderer (local)" in Settings attaches the renderer, and the Composer's
own Raw Messages tab shows `RENDERER_READY` and `A2UI_CATALOG` arriving from
`renderer.openfieldworks.localhost`. That path is the acceptance criterion, but
it is not what the gate automates — it depends on upstream's Angular Material
selectors and its Monaco editor, so it would fail on an upstream redesign that
broke nothing. The probe page pins the contract instead of the chrome around
it.

## Known limitation, not a failure

The console reports `Permissions policy violation: camera is not allowed in
this document`. Upstream's preview iframe carries `sandbox` but no `allow=`
attribute, so the camera is blocked by Permissions Policy for every renderer,
not just Gather's. Authoring is unaffected — the web renderer uses fixture
capabilities — and live camera preview inside the Composer would need an
upstream `allow="camera"` on that iframe. Upstream's own integration notes
already list renderer iframe permissions as an expected gap.
