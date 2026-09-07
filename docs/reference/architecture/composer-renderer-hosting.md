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

### `frame-ancestors` is checked against the whole chain — 2026-09-06

The renderer sits two levels deep:

```text
wrapper  frames  editor  frames  renderer
```

CSP `frame-ancestors` is evaluated against **every ancestor**, not the immediate
parent. So the renderer listing only `editor.…` is not enough — the outermost
host has to appear in its list too, and a local dev server therefore needs
adding to *both* `EDITOR_FRAME_ANCESTORS` and `RENDERER_FRAME_ANCESTORS`.

Found by the demo rehearsal: the editor framed fine and the renderer inside it
was blocked, which reads exactly like a renderer fault and is not one.

An environment change to either list needs the container **recreated**, not
rebuilt — `ofw deploy editor` rebuilds the whole pinned upstream Composer for
what is a one-line env change.

### The tooling enforces this, because documenting it was not enough — 2026-09-06

It happened a second time. A renderer rebuilt with a bare
`docker compose -f apps/renderer/compose.yml up -d --build` came up with no
`RENDERER_FRAME_ANCESTORS` at all, and **all four** browser gates then failed
identically with a 20-second timeout — including gates that had nothing to do
with the change being tested. The symptom points at the code under test and
never at the deployment.

Three things now prevent it, in order of how hard they are to bypass:

```text
image      docker-entrypoint.d/05-require-renderer-config.envsh
           refuses to start without RENDERER_FRAME_ANCESTORS or
           RENDERER_AUTHORING_ORIGIN — whatever command was used

ofw        `ofw deploy renderer` checks the env file first, so the
           error names the file to edit rather than a container log

env file    deploy/env/<environment>.env, passed with --env-file
```

Consequences worth knowing:

- **Never `source` the env file.** `RENDERER_FRAME_ANCESTORS` is a
  space-separated origin list, so `set -a; . local.env` tries to execute the
  second origin as a command and the variable ends up truncated or unset. Use
  `docker compose --env-file`, which parses it properly. `ofw` reads the file
  with `grep` for the same reason.
- **An unconfigured renderer is a legitimate deployment, but must be asked
  for.** `RENDERER_FRAME_ANCESTORS=upstream-only` means "only the hosted A2UI
  Composer may embed this", and is the one way to get the old empty-value
  behaviour. An empty string is now treated as a mistake, because it always was
  one.
- `RENDERER_AUTHORING_ORIGIN` is gated for the same reason: empty means
  `Access-Control-Allow-Origin: ""`, and the wrapper's catalog imports fail
  CORS with the renderer still serving `200`.

The sentinel has to be handled in a **sourced** `.envsh`, not a `.sh`. nginx
runs `.sh` entrypoint scripts as subprocesses, so rewriting the variable there
is lost before `20-envsubst-on-templates.sh` reads it — the first version of
this check put the literal string `upstream-only` into the CSP header.

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
nothing the renderer or its server sends can grant what the parent did not. The
renderer sends no `Permissions-Policy` header, and one would not help — that
header can only restrict further, never grant.

### It is two hops, not one — remeasured 2026-09-06

The paragraph above was written before the wrapper existed, when the Composer
framed the renderer directly. The chain is now three documents on three origins:

```text
wrapper (composer.…)  →  editor iframe (editor.…)  →  renderer iframe (renderer.…)
```

`camera`'s default allowlist is `self`, so **every cross-origin hop needs its own
`allow`**. Measured with a fake capture device:

```text
A. as shipped                           top OK · editor denied   · renderer denied
B. allow="camera" on our editor iframe  top OK · editor camera OK · renderer denied
```

The grant propagates exactly one hop per attribute. Two are needed: one on the
wrapper's own `#editor` iframe, and one on upstream's
`rendered-frame.ng.html`.

### Why the second one cannot be set from JavaScript

The obvious move is to select the renderer's iframe and set the attribute — the
ordinary DOM pattern, and it works for the first hop. It cannot work for the
second, and not because of anything about attributes:

```text
hop 1  set allow on our own <iframe id="editor">   → "camera"
hop 2  editor.contentDocument                      → null (blocked)
hop 2  editor.contentWindow.document               → SecurityError: Blocked a frame…
```

That iframe is created by the editor's Angular code, inside the editor's
document, on another origin. There is no element to select.

And the separate origin is **our own decision**, recorded in the web
repository's `deploy/compose.wrapper.yml`: hosting the shell and upstream apart
means the
browser enforces the message-protocol boundary rather than a convention we
maintain. Serving the editor same-origin would make the DOM reach-in work and
would trade that guarantee away to save one attribute.

### Why this is not being fixed — 2026-09-06

Not blocked, and deliberately not scheduled. A laptop webcam at a desk
photographs a desk. What a Tool author needs from a preview is whether *this
model* handles *the kind of image they will actually capture*, so representative
sample data is the right primary affordance and would be even with the camera
fully enabled. `SampleImageInput` in `apps/renderer/src/gatherComponents.jsx` is
that affordance, not a workaround.

If a camera-backed preview is ever wanted, the cost is known and small: one
attribute on our iframe plus a fourth upstream patch, granting `camera` only.
The integration is complete without it.


## The active renderer is not observable — audited 2026-09-06

The wrapper imports its authoring modules from a configured renderer and hands
the editor the same URL as `?renderer=`, so the two agree by construction on
every document load. Upstream's renderer picker is preserved, which means a
person can change it mid-session — and then the preview would run against one
renderer while Review, Models and Publish analyse against another, both
producing plausible output.

Audited before building anything to detect it. The embedded-host protocol is:

```text
DOCUMENT_CHANGED   the editor announces an edit
DOCUMENT_STATE     the editor answers with the document
GET_DOCUMENT       the host asks for it
```

Nothing reports the active renderer, and `0002-embedded-host-document-seam.patch`
does not mention one. **So the divergence is not observable from our side
without an upstream change**, and no patch was added for it in Phase 1.

Two things limit the exposure, which is why this is recorded rather than fixed:

- `composerDocument.load()` sets `?renderer=` on **every** draft open, so a
  manual change survives only until the next one.
- The wrapper's own imports never move; only what the preview renders does.

The obvious workaround — reach into the editor and operate the picker — is not
available. That iframe's document is cross-origin, so there is no element to
click; see the camera section above, which measures the same wall.

## `resultPath` is Gather's, and both hosts share one implementation

Upstream A2UI resolves a **value-position** `functionCall` reactively — an
expression, re-evaluated when its inputs change. An **action-position** one is a
different thing: user-triggered, awaited, and its result usually has somewhere
to go. Upstream has no notion of that destination, so `resultPath` is ours
(`src/a2ui/actionAdapter.js`).

```text
value-position    upstream reactive evaluation
action-position   lazy · user-triggered · awaited · optional resultPath write
```

`src/a2ui/functionCallProps.js` holds the behaviour once; the mobile binder and
the web renderer both compose it. Before that the renderer had no `resultPath`
at all, and the failure was silent in the worst way: every call in an authored
Tool *executed successfully* and no result reached the next one.
`gather_persistAsset` ran, `/working/image` stayed null, `image_segment` had
nothing to segment, and nothing errored.

### Why the renderer rebinds `Button`

Every action-position call in an authored Tool hangs off a Basic Catalog
`Button`, and upstream's implementation binds internally — there is no seam to
give it `resultPath` from outside. So the renderer binds `ButtonApi` itself and
renders Gather's Button, exactly as `src/a2ui/mobile/basicCatalog.js` does and
for exactly the same reason. `Button` remains upstream vocabulary; only the
binding is ours.

### Candidate upstream proposal

"Call a function and put the result somewhere" is not a Gather-specific idea,
and `resultPath` beside `functionCall` is a small, general addition. Worth
proposing upstream. **M11 does not depend on it** — nothing here is blocked on
acceptance, and no Composer patch is involved.

## The renderer is a temporary web host

Worth stating plainly, because the direction affects how much is worth building
here. The renderer exists to project shared Gather contracts onto the web while
React Native Web coverage matures. Two implementations of a Component or of
action semantics is a cost, not a design — this pass removed one such
duplication (the component API registry) and shared another (`resultPath`).

As RN-Web coverage improves, prefer making the shared Gather application *be*
the web renderer over maintaining parallel implementations. Anything added here
should be chosen with that ending in mind.
