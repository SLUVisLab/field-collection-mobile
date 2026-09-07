# Hosting the Composer and the renderer

> **OpenFieldWorks hosts and configures upstream Composer; Gather supplies the
> renderer and catalog that make it Gather-aware.**

That sentence is the boundary. Everything below is what it means in practice,
and the one piece of configuration that decides whether it works at all.

## The integration was never the hard part

`apps/renderer/src/composerBridge.js` has implemented the Composer's
`postMessage` protocol since M9, and
[m9-a2ui-compatibility.md](../../archive/milestones/m9-a2ui-compatibility.md#hosted-composer-authoring-verified-live)
records a live session in which the Google-hosted Composer authored a
Segment & Measure instrument against the advertised Gather catalog.

```text
Composer                                   renderer
   │                                          │
   │  <──────────────────  RENDERER_READY ────┤  on load, if framed
   ├──  GET_CATALOG  ─────────────────────>   │
   │  <──────────────────  A2UI_CATALOG  ─────┤  generateInlineCatalog(gatherCatalog)
   ├──  RENDER_A2UI  ─────────────────────>   │  applyRenderBatch → MessageProcessor
   ├──  DATA_MODEL_CHANGE  ───────────────>   │  updateDataModel
   │  <──────────────────  SEND_TO_SERVER ────┤  a component action
```

**The catalog comes from the renderer, not from configuration.** Composer asks;
the renderer answers with its live catalog. So a Gather component added to
`gather-catalog` is visible to the Composer's agent as soon as the renderer is
redeployed — there is no catalog file to publish and nothing to keep in sync.

This is worth protecting. A published Gather catalog would be a second copy of
something the renderer already knows, and therefore a synchronization problem
with no upside: the authoring environment tracks the renderer version because
it *asks* the renderer. Do not introduce a catalog artifact.

Origins are paired by the documented `?origin=` query parameter, which the
renderer echoes as its `postMessage` target. That is the same contract
upstream's own `DomainOriginVerificationService` implements.

## Deployment invariant: the renderer declares who may embed it

The renderer is meant to be embedded, so it constrains **who may embed it**:

```text
Content-Security-Policy: ... frame-ancestors https://a2ui-project.github.io <configured>
```

A Composer on any other origin is refused by the browser. This failure is
worth describing precisely, because it is invisible from every angle an
operator would normally look at:

- the renderer returns `200` for every request;
- its nginx log shows the requests arriving and being served;
- the Composer shows an empty preview and no error;
- the refusal appears **only** in the browser console of the embedding page.

It reads exactly like "our renderer does not implement the protocol", which is
how a day was lost to it on 2026-09-05.

`RENDERER_FRAME_ANCESTORS` (see `apps/renderer/compose.yml` and
`apps/renderer/nginx.conf.template`) adds a deployment's Composer origins. The
hosted Composer stays hard-coded in the template so an image run with no
configuration still works where the integration was first proven.

**Every new Composer hostname is a change to this list.** A Composer that
cannot embed the renderer is not a degraded integration — it is a blank preview
panel and nothing else.

`npm run gate:composer-bridge` checks the whole path in a real browser and
names this as the cause when the handshake never completes. See
[gates/composer-bridge/README.md](../../../gates/composer-bridge/README.md).

## Where the protocol has moved on

Gather implements the five messages the protocol had when it was written.
Upstream's `a2ui-bridge` at `a2ui-project/composer@956971a8` also carries:

```text
GET_COMPONENT_USAGES → COMPONENT_USAGES    which components a composition uses
SET_THEME                                  host theme propagation
SURFACE_RESIZE                             renderer reports its own size
SET_BLOCKING_STATE / FORCE_UNBLOCK         host-driven interaction blocking
CONSOLE_LOG                                renderer console into the Composer's Errors tab
```

None are required for authoring, and the gate passes without them. They are
what a Gather renderer would gain by adopting the official bridge — which is
**not currently possible**: `a2ui-bridge` is `"private": true` upstream and
returns 404 from npm. Re-check that before writing any more transport code by
hand; vendoring a built `dist/` from the pinned revision is the fallback, and
carries the usual cost of a vendored copy.

**Each message earns its implementation individually.** `composerBridge.js` is
a deliberately small compatibility adapter, not a bridge implementation racing
upstream. Before adding a message type, read the current upstream
implementation and establish that Gather authoring actually needs it. Parity
for its own sake would turn a 70-line adapter into a second renderer
architecture maintained against a package we cannot depend on.

## Known limitation: the camera in preview

Upstream's preview iframe (`shell/src/app/preview/rendered/rendered-frame.ng.html`)
sets `sandbox="allow-scripts allow-same-origin allow-forms"` and **no `allow=`
attribute**, so Permissions Policy blocks the camera for every renderer the
Composer hosts. Authoring is unaffected: the web renderer runs on fixture
capabilities.

Measured on 2026-09-05, from inside the renderer document, with a fake capture
device so the result is about policy rather than hardware:

```text
upstream iframe (sandbox only)     NotAllowedError: Permission denied
with allow="camera"                camera OK
```

So the answer to "can hosting configuration solve this?" is **no**, and not for
want of trying: Permissions Policy is delegated by the embedding element, and
nothing the renderer or its server sends can grant what the parent did not.

If M11 ever needs a camera-backed preview, the fix is one attribute on that
template, granting only what Gather uses. That is a device-capability
enhancement, not a prerequisite — the integration is complete without it, and a
patch there would not change the fact that Gather needs zero Composer patches
to work.
