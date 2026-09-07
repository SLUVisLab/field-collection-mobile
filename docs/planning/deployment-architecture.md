# Deployment architecture

**Status: partly built — see [Status](#status) below.** This is the plan for the
`openfieldworks-web` repository, the public surface, and how the Gather Tool
Composer is hosted. It is the prerequisite for
[M11 — Gather Tool Composer](./m11-gather-tool-composer.md), which
describes what the Composer *does* and was written assuming a host that did not
exist yet.

**Terminology.** The verbatim sections below say *Instrument Studio*; the
product is now the **Gather Tool Composer**. The words are left as written
rather than rewritten, because a section that claims to be verbatim has to
be.

Extracted 2026-09-04 from `design-backlog.md` §4, §12 and §14, unchanged. It sat
under a heading about the public website, which is not where anyone would look
for it, and by the filing rule in [docs/README.md](../README.md) a decision that
gates the next piece of work is not backlog.

```text
gather/                  this repo — app, Components, Catalog, Tools,
                         Capabilities, renderer
openfieldworks-web/      created 2026-09-05 — site, pinned Composer,
                         Composer runtime config, edge proxy, deploy definitions
A2UI Composer            upstream, pinned at build time
ODK Central              upstream, independently deployed
```

---

## Status

> **OpenFieldWorks hosts and configures upstream Composer; Gather supplies the
> renderer and catalog that make it Gather-aware.**

### Stage 2 — pin and embed upstream Composer — **done, 2026-09-05**

```text
✓  pinned standalone upstream Composer      a2ui-project/composer @ 956971a8
✓  zero Composer patches                    and zero is the answer, not "for now"
✓  runtime renderer configuration           config.json, an upstream asset
✓  existing Gather renderer protocol         composerBridge.js, unchanged
✓  Gather Catalog delivered by renderer      GET_CATALOG → A2UI_CATALOG
✓  canonical composition renders             SEGMENT_AND_MEASURE_INSTRUMENT
✓  action + data-model round trip            gather.capture returned
✓  CSP embedding requirements                documented and gated
```

**Zero patches is the current answer, not a placeholder.** Nothing about the
integration is waiting on a Composer change: the only Composer-side gap found
is `allow="camera"` on the preview iframe, and that is a device-capability
enhancement Gather does not need to author with. See
[composer-renderer-hosting.md](../reference/architecture/composer-renderer-hosting.md).

This turned out much smaller than the milestone assumed. The remaining M11 work
is Gather Composer *product behaviour*, not integration plumbing — the plumbing
was already built in M9 and needed one line of deployment configuration to work
under our own hostname.

---

## 12. Public web surface and production server architecture

When Gather is ready for a public release, OpenFieldWorks should have a small front-facing web application at the root domain that acts as the product entry point.

### Proposed public surface

```text
openfieldworks.com
→ Gather landing page / product home
→ documentation links
→ videos / getting-started material
→ Tool Catalog
→ links to Composer / Instrument Studio and Central

composer.openfieldworks.com
→ Gather Tool Composer

central.openfieldworks.com
→ ODK Central

renderer.openfieldworks.com
→ Gather A2UI renderer used by Composer / Studio

docs.openfieldworks.com        # optional later
→ Gather-specific documentation
```

Avoid creating extra subdomains until they earn a clear product boundary. The Tool Catalog can initially live at a normal route such as:

```text
openfieldworks.com/instruments
```

The public site may also link to upstream A2UI and ODK Central documentation where appropriate.

### Keep deployment units independent

Do **not** build one giant Docker Compose stack that tightly couples all hosted applications.

Prefer:

```text
single edge reverse proxy
        ↓
shared Docker network
        ↓
independent Compose projects
├── site
├── composer / studio
├── renderer
└── central
```

Each application should be independently buildable, deployable, restartable, and rollbackable.

A thin deployment/orchestration layer may provide convenience commands such as:

```text
deploy site
deploy composer
deploy renderer
deploy central
deploy all
status
logs <service>
```

This gives operational convenience without coupling application lifecycles.

### Reverse proxy

Use one simple edge proxy as the public ingress point, with automatic HTTPS and hostname routing.

Caddy is a strong default for the initial deployment because the desired routing is simple:

```text
openfieldworks.com              → site
composer.openfieldworks.com     → composer
central.openfieldworks.com      → Central
renderer.openfieldworks.com     → renderer
```

Keep application containers on an internal/shared Docker network and expose only the edge proxy publicly where practical.

### Repository boundaries

Keep repositories aligned with real upstream/product boundaries rather than creating many small repos.

The cleaner initial product split is **two OpenFieldWorks repositories**, with upstream projects treated as external dependencies:

```text
gather/
→ main Gather monorepo
→ mobile app
→ shared Components
→ Gather Catalog
→ first-party Tools
→ Capabilities / model runtime
→ renderer

openfieldworks-web/
→ public landing site
→ Gather docs / guides
→ Tool Catalog presentation
→ Gather Tool Composer shell
→ pinned upstream Composer integration
→ Composer patch/update scripts
→ reverse proxy / edge configuration
→ Compose deployment definitions
→ environment templates
→ deploy/status/log scripts
```

Upstream dependencies remain upstream:

```text
A2UI Composer
→ fetched/pinned during Tool Composer build

ODK Central
→ independently deployed upstream service
```

A possible web-repo shape:

```text
openfieldworks-web/
├── apps/
│   ├── site/
│   └── composer/
│       ├── shell/
│       ├── patches/
│       └── scripts/
├── deploy/
│   ├── Caddyfile
│   ├── compose.yml
│   ├── env/
│   └── scripts/
└── ...
```

This keeps repository count low while preserving clean runtime boundaries. The web repository owns the public OpenFieldWorks surface, Gather Tool Composer host integration, and lightweight deployment configuration; it does **not** imply that the site, Composer, renderer, and Central share one tightly coupled lifecycle.

ODK Central should remain an upstream deployment dependency rather than being copied into Gather unless a concrete customization truly requires it.

Keep the first-party Instrument library in the main Gather/product source initially. Do not create a separate Instrument repository until sharing/community/versioning requirements justify it.

### Build and deployment flow

Prefer immutable container images and pinned revisions.

Conceptually:

```text
Git push / tagged release
        ↓
CI builds container image
        ↓
container registry
        ↓
server pulls pinned image
        ↓
docker compose up -d
```

For early prototypes, server-side builds are acceptable, but production should move toward CI-built images so rollback and version tracking are straightforward.

> **Deferred 2026-09-04.** CI-built images and a registry are **not** part of
> this work. Continue with **server-side builds and the simplest deploy
> workflow that functions** until something concrete demands otherwise — a
> rollback that hurt, a build that could not be reproduced, or more than one
> person deploying.
>
> The flow above stays the destination, not the starting point. What that
> changes in practice:
>
> ```text
> now      git pull on the server → docker compose up -d --build
> later    CI → registry → server pulls a pinned tag
> ```
>
> The cost of deferring is that a broken build is discovered on the server
> rather than before it. That is acceptable while one person deploys, and it is
> the thing to watch: **the trigger for revisiting is a deploy that failed for a
> reason a build would have caught**, not a calendar date.
>
> Two habits keep the door open without paying for CI now: keep the Compose
> files referencing build contexts that a registry image could replace
> one-for-one, and keep every service's build reproducible from a clean clone.

Keep secrets and deployment-specific configuration outside source control.

### Tool Catalog evolution

Initially, the public Tool Catalog can be generated from first-party Tool metadata in the Gather repository.

Later:

```text
first-party Tools
+ project/shared Instruments
+ community Tools
        ↓
Catalog service / registry
        ↓
website + Instrument Studio
```

Do not introduce a database-backed public marketplace before it is needed.

### Authentication / Central integration — open question

The public site can initially link directly to Central for sign-in and project management.

Once Instrument Studio persists project-scoped Instruments, investigate the cleanest way to connect Studio identity/authorization to ODK Central projects.

Do not assume Central provides the exact SSO mechanism Gather needs; treat authentication/session integration as an explicit design investigation rather than coupling Studio prematurely to Central internals.

### Operational principle

> **One public edge, independently deployable services, and repositories that follow real product/upstream boundaries.**

Favor a small amount of deployment automation over a monolithic infrastructure stack.

---

## 4. Gather Tool Composer — upstream wrapper, not a fork by default

**Decision:** do not maintain a conventional long-lived fork of A2UI Composer unless a concrete requirement forces one.

Treat upstream Composer as a **pinned build dependency** wrapped by the Gather Tool Composer shell.

Conceptually:

```text
Gather Tool Composer shell
├── project / Tool library
├── save / load / publish
├── model browser / runner
├── compatibility validation
├── Central integration
├── agent context
└── embedded upstream A2UI Composer
```

### Upstream integration strategy

At build time:

```text
fetch pinned upstream Composer revision
        ↓
apply tiny explicit Gather patch set if needed
        ↓
build upstream Composer
        ↓
embed/serve inside Gather Tool Composer shell
        ↓
run integration tests
```

Do **not** pull the latest upstream Composer dynamically at runtime. Production should always use a known-good pinned revision.

Prefer integration in this order:

1. public Composer/renderer APIs and `postMessage` seams;
2. host/same-origin integration exposed cleanly by the shell;
3. minimal build-time patches only when upstream lacks the required hook.

Gather-specific product functionality should remain outside upstream Composer internals wherever practical.

### Patch discipline

If a Composer source change is unavoidable, keep it as a small explicit patch, for example:

```text
patches/
├── renderer-permissions.patch
├── host-load-save-hooks.patch
└── composer-extension-seams.patch
```

Each patch should:

- solve one narrow integration problem;
- be documented;
- be covered by integration tests;
- be removable when upstream adds an equivalent seam.

Examples of likely temporary patches:

- renderer iframe permissions for camera / microphone / geolocation;
- load/save document hooks;
- configurable renderer viewport behavior;
- host toolbar / extension hooks.

Avoid DOM manipulation or monkey-patching from the shell when a tiny deterministic source patch is safer and easier to validate.

### Update workflow

Provide tooling such as:

```text
scripts/update-composer
```

that:

```text
fetches chosen upstream revision
→ applies Gather patches
→ builds
→ runs Composer + renderer integration tests
→ reports patch conflicts/regressions
```

This keeps the upstream relationship explicit without carrying a divergent Git history.

### Architectural principle

> **No fork by default. Keep upstream Composer stock, wrap it from outside, and maintain only a tiny removable patch set for missing integration seams.**

---

## 14. Repository minimalism

**Decision:** prefer two OpenFieldWorks-owned product repositories for the foreseeable future:

```text
gather/
openfieldworks-web/
```

Do not create a dedicated Composer fork repository if the wrapper + pinned-upstream + patch-set strategy is sufficient.

Create new repositories only when a boundary has independent release cadence, ownership, or upstream-history requirements that cannot be handled cleanly inside these two repos.

This is an organizational preference, not a reason to couple runtime services or packages that should remain independently deployable.

---

## Where this came from

Sections above are `design-backlog.md` §4, §12 and §14 verbatim. The backlog
retains one-line pointers in their place. Numbering is preserved so older
references to "backlog §12" still resolve to the right content.
