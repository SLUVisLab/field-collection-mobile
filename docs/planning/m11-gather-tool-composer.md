# M11 — Gather Tool Composer

**Revised 2026-09-05.** The original plan assumed a Gather-flavoured fork of the
A2UI Composer, and that Models, compatibility, Composer integration, packaging
and mobile installation each still needed architecture. Most of those boundaries
have since been built and proven, and the integration turned out to need no
Composer code at all. What is left is largely turning existing architecture into
a coherent authoring experience.

> **Host upstream Composer unchanged, let the Gather renderer supply the
> Catalog, add Gather-owned model authoring and discovery around it, and finish
> packaging and publishing the resulting Tool.**

The product goal is unchanged — author, test, validate, package and ship a Tool
together with its model dependencies. The implementation roadmap is much
smaller.

## What collapsed, and what that leaves

| The original plan assumed | What is actually true |
| --- | --- |
| A Gather fork or wrapper of Composer | Upstream runs unmodified. **Zero patches.** |
| Gather extensions inside Composer internals | One runtime asset, `config.json` |
| A published Gather Catalog to keep in sync | The renderer answers `GET_CATALOG` from the live catalog |
| A Model Browser needing model architecture | `gather-models` exists; this is presentation |
| A compatibility validator to build | `validateModelPackage` + `TASK_PROFILES` exist; this is a report |
| `.gather` as a deterministic archive from day one | `.gather` v1 already ships and works — v2 only where bundling demands it |

Sources: [composer-renderer-hosting.md](../reference/architecture/composer-renderer-hosting.md),
[model-architecture-audit.md](../reference/architecture/model-architecture-audit.md),
[deployment-architecture.md §Status](./deployment-architecture.md#status).

The ownership boundary that all of this rests on:

> **OpenFieldWorks hosts and configures upstream Composer; Gather supplies the
> renderer and catalog that make it Gather-aware.**

```text
openfieldworks-web/                     gather/
├── hosts pinned upstream Composer      ├── owns the renderer
├── owns config.json                    ├── owns the Gather Catalog
├── owns edge / Caddy deployment        ├── owns Components, Capabilities, Models
└── zero Composer patches               └── speaks the Composer bridge protocol
```

**Sequencing note.** The original document said M11 begins only after M10.
Phase 0 landed ahead of it, because hosting and integration never depended on
M10's field validation. Phases 1 onward still want M10's evidence that the Tool
premise holds in real fieldwork — building an authoring experience for a
workflow that has not been validated is how you polish the wrong thing.

---

## Phase 0 — Close the hosting and integration work

**Essentially done.** [Stage 2 of the deployment
plan](./deployment-architecture.md#status) records what was proven: our hosted
Composer selects the Gather renderer from `config.json`, receives the real
Gather Catalog, renders the canonical Tool, and completes an action and
data-model round trip.

Remaining:

- keep the renderer's CSP origins configurable — `RENDERER_FRAME_ANCESTORS` is
  a **deployment invariant**, and every new Composer hostname is a change to it;
- keep `gates/composer-bridge` passing;
- keep the pinned upstream revision and its update procedure documented in
  `openfieldworks-web/apps/composer/README.md`;
- verify Composer, renderer, site and Central stay independently deployable.

Done 2026-09-05: `gather/deploy/` — the previous production topology, a
host-network Caddy proxying two loopback upstreams — is superseded by
`openfieldworks-web/deploy/`, and its ODK Central integration moved to
`openfieldworks-web/deploy/central/`. Central stays stock and independently
deployable; the override now joins it to the shared network instead of
publishing a loopback port, so it exposes one fewer thing than before. The
production cutover is written down, because two proxies wanting port 443 is the
whole risk.

**Do not implement `ComposerHost` yet.** Anonymous session, local storage and
export are all already true of upstream, so an abstraction over them would have
one implementation and no behavioural boundary. The README seam records the
three triggers that would change that — authentication, remote storage, or
publishing to Central. Until one arrives, delete the code by not writing it.

**Gate.** Our hosted upstream Composer → Gather renderer selected from
`config.json` → real Gather Catalog returned → canonical Gather Tool renders →
state and action round trip works. *(Passing.)*

---

## Phase 1 — Make Models a first-class authoring resource

This replaces the original §2 "Model Browser", most of which described model
architecture that now exists:

```text
gather-models          ModelRef · ModelPackage · content revisions ·
                       TASK_PROFILES · compatibility validation · store
gather-capabilities    acceptedModelProfiles
src/compute/models     bundledModels · modelPolicy defaults · Model Catalog
```

So the work is **Composer presentation and agent exposure**, not new model
architecture. Build a Model Browser that consumes the existing Model Catalog:

```text
Gather Flower Segmenter
  profile      segmentation.binary.v1
  revision     sha256:…
  availability Gather-provided
  installed    yes / no
```

and filters naturally from the Capability the author is configuring:

```text
image.segment  →  acceptedModelProfiles  →  compatible models only
```

Preserve the three selection modes already established:

| Mode | Call | State |
| --- | --- | --- |
| 1. Capability default | `image.segment(image)` | implemented |
| 2. Explicit Gather-available model | `image.segment(image, modelRef)` | implemented |
| 3. Tool-supplied model | `image.segment(image, modelRef)` + model in `.gather` | distribution work, Phases 5–6 |

**Do not invent an A2UI "Model" type.** A model is a value an author selects,
carried as a `ModelRef` — not a new component species in the Catalog.

**Gate.** The Composer agent and UI can discover a model-backed Capability, list
compatible Gather models, and author an explicit `ModelRef`.

---

## Phase 2 — The browser-side Model Lab

Genuinely unfinished, and worth keeping narrower than the original §3.

**Do not build a second inference framework.** Reuse the portable
`ModelPackage` semantics with a web execution backend:

```text
ModelRef / ModelPackage
        ↓  web resolver
onnxruntime-web
        ↓  the same declared transforms and profile
typed semantic result
```

For the first slice, support only the profiles we actually ship:

```text
segmentation.binary.v1   →  image + mask overlay
classification.ranked.v1 →  ranked labels
```

No arbitrary ONNX playground. The proof that matters is narrow and specific:
**a model that passes Gather compatibility validation executes against sample
data in the Composer and produces a meaningful preview.**

This is an authoring aid. Native mobile execution stays authoritative, and the
Lab must never become a second source of truth about what a model does.

**Gate.** Select a compatible model → choose a sample image → run → inspect a
useful result.

---

## Phase 3 — Turn compatibility into a visible report

The validation the original §4 asked for largely exists —
`validateModelPackage`, `TASK_PROFILES`, content revisions from
`gather-hashing`, and the capability/model compatibility rules. **Do not build
another validation subsystem.** Build a Composer-facing adapter over the checks
that already run.

```text
PASS
  ✓ model package revision verified
  ✓ segmentation.binary.v1
  ✓ compatible with image.segment
  ✓ binaryMask postprocessing declared
  ✓ sample inference produced finite output

WARNING
  ! model is not supplied by the Gather app and must be packaged

FAIL
  ✗ output profile incompatible with image.segment
```

**A new check is only justified when it corresponds to a real runtime
constraint.** A report that fails for reasons the device would not is worse than
no report, because it teaches authors to ignore it.

**Gate.** A researcher can understand *why* a model will or will not work,
before packaging and before fieldwork.

---

## Phase 4 — Make Tool dependency selection explicit

The original §5 pictured a Tool carrying exact model dependencies locked before
export. That is still right, and can now be stated precisely. A Tool
distinguishes:

```text
Capability requirement     image.segment
Model selection            ├ default
                           ├ exact Gather-available ModelRef
                           └ exact bundled ModelRef
```

At publication, `default` resolves through `modelPolicy` to an exact revision:

```text
editable Tool     image.segment → default
       ↓  publish
published Tool    image.segment → ModelRef abc123
```

That gives the reproducibility guarantee **without** making authors pick a model
by hand for every generic Tool — the two goals the original document treated as
in tension.

The dependency view is what makes it reviewable rather than implicit:

```text
Flower Measurement
├── Gather Catalog compatibility
├── image.segment
│   └── model: gather.flower-segment@abc123
└── measure.area
    └── no model
```

Packaging should fail rather than silently produce an incompletely locked Tool.

**Gate.** Before publishing, every model-backed operation resolves to a known
compatible `ModelRef`, and the author can see that dependency graph.

---

## Phase 5 — `.gather` v2, only as far as model bundling requires

The largest genuinely new architecture item, and the one most at risk of being
overbuilt. The original §6 assumed `.gather` would immediately become a
deterministic archive. Since then a much simpler artifact path was **proved on
hardware**:

```text
XLSForm names a .gather resource → Central distributes it → Gather downloads it
→ a composition unknown to the installed binary executes
```

**Do not throw that away.** Evolve deliberately:

```text
.gather v1   composition-only artifact          already works, already shipped
.gather v2   a container, when dependencies need embedding
```

A minimal v2:

```text
tool.gather
├── manifest.json
├── composition.a2ui.json
└── models/
    └── <revision>/
        ├── model.json
        ├── model.onnx
        └── labels.json?
```

**Resist duplicating information.** `ModelPackage` stays the authoritative model
metadata, `gather-hashing` stays content identity, `gather-models` install stays
the installation path. The bundle declares **requirements, not mechanisms**:

```text
requires:
  capabilities: [image.segment]
  models:       [ModelRef abc123]
```

Whether the bytes travel with the Tool is then a separate question with an
obvious answer:

```text
ModelRef abc123 + package contains a provider   →  install from the package
ModelRef abc123 + the app already provides it   →  no duplicate bytes
```

This is also what leaves room for remotely downloadable models later without a
second Tool format — the manifest already says *what is required*, never *where
to get it*.

**Gate.** Two Tools carrying the same model install one model revision in the
device model store.

---

## Phase 6 — Tool-supplied model installation

Completes selection mode 3.

```text
.gather
   ↓ inspect model requirements
already installed?
├── yes → reuse
└── no
     ↓ bundled provider available?
     ├── yes → verify bytes → modelStore.install()
     └── no  → unavailable / error
```

Keep it provider-independent. The long-term shape is one store with several
sources:

```text
providers        app bundle · .gather bundle · remote provider later
      ↓
ModelPackage + bytes  →  the same modelStore  →  the same ModelRef
```

**Do not introduce** a `.gather`-specific model store, Tool-specific inference,
or ownership-based uninstall. A model installed from a Tool is indistinguishable
from a model installed any other way, and that is the property worth protecting.

This is also where the declarative model-requirement hook belongs, so project
synchronization can eventually preflight models before anyone leaves for the
field:

```text
Tool requires ModelRef abc123          ✓ a requirement
Tool downloads abc123 from URL X       ✗ a mechanism
```

**Gate.** A model not shipped in the Gather binary arrives with a Tool, installs
through the existing model subsystem, and executes through the existing
Capability runtime.

---

## Phase 7 — Complete the Central distribution workflow

The original §7 is almost exactly right, and much of it is already proven:
an XLSForm field or group names a `.gather` attachment, Central accepts and
distributes it, and Gather downloads it through form resources.

So the initial workflow stays deliberately manual:

```text
Composer → export .gather → attach in XLSForm / Central → publish → Gather syncs and runs
```

**Do not block M11 on Composer authentication or direct Central publishing.**
The original document already allowed that deferral, and direct publishing is
precisely the trigger that would make `ComposerHost.publish` and a session seam
real rather than speculative.

**Gate.** An exported Tool and its dependencies attach to an ordinary stock
Central form and are consumed by Gather with no custom server behaviour.

---

## Phase 8 — First-party Tool presets, one distribution path

Not explicit enough in the original document, and now important.

The first-party artifacts under [`compositions/`](../../compositions/README.md)
should appear as Composer presets:

```text
New Tool   [ Quadrat Tally ]  [ Photo Capture ]  [ Segment & Measure ]  [ Custom ]
```

**Selecting one must not create a built-in runtime species.** It produces the
same published `.gather` artifact a custom Tool does:

```text
first-party preset source → Composer → the same publish pipeline → .gather → Central
```

The ease-of-use advantage is entirely in the authoring UX; the runtime path
stays single. This is the same rule `compositions/README.md` already states, and
the preset UI is the most likely place to accidentally break it.

**Gate.** A Tool started from a preset and a Tool authored from scratch are
indistinguishable after publication.

---

## Phase 9 — Camera preview, only if it earns the patch

The one remaining candidate for a Composer patch, and the decision is already
half-made by measurement. Upstream's preview iframe sets `sandbox` but no
`allow=`, so Permissions Policy blocks the camera for every renderer it hosts.
Measured from inside the renderer document with a fake capture device:

```text
upstream iframe (sandbox only)   NotAllowedError: Permission denied
with allow="camera"              camera OK
```

Permissions Policy is delegated by the embedding element, so **no hosting or
origin configuration can substitute** — this needs a source change or it does
not happen.

Decide what M11 actually needs before patching. **If sample-image preview is
enough for GREEN, do not patch.** If real `CameraView`, microphone or
geolocation preview is required, carry one narrow removable patch granting only
those capabilities, and record: why it is needed, the upstream revision, the
exact diff, its test, and its removal condition —
`openfieldworks-web/apps/composer/patches/README.md` is the ledger.

Either way this is a **device-capability enhancement, not a prerequisite**. The
zero-patch integration result stands regardless.

---

## Explicitly out of GREEN

Useful, and none of it on the critical path:

```text
direct Central publishing            package signing
authentication / SSO                 general model conversion
remote model registry                WebGPU optimization
Hugging Face discovery               browser-vs-native numerical parity studies
model uninstall UI                   public Tool marketplace
                                     full Tool cloud library
```

Also out: a **generalized remote model provider**. M11 only has to ensure that
nothing in `.gather` v2 or the resolver architecture *prevents* one later.

---

## M11 GREEN definition

M11 is GREEN when a researcher can:

1. Open our hosted, pinned upstream A2UI Composer.
2. Select the Gather renderer and receive the real Gather Catalog.
3. Author or open a Gather Tool using shared Components and Capabilities.
4. For a model-backed Capability: use the Gather default model, **or**
   explicitly select another Gather-available model, **or** import and package a
   supported custom model.
5. Inspect model identity, task profile, revision and compatibility.
6. Run the model against sample data in the browser and inspect useful output.
7. Receive a clear compatibility report.
8. See the exact Capability and Model dependencies that will be published.
9. Publish or export an immutable `.gather` artifact with every required
   non-preinstalled dependency embedded or precisely referenced.
10. Attach that artifact to an ordinary ODK form in Central.
11. Sync the form to Gather.
12. Have Gather verify the Tool, reuse or install required Models through
    `gather-models`, and execute it through the same Capability runtime.
13. See submission outputs land in ordinary XForms fields and media, with the
    actual model revision preserved in provenance.
14. Reconstruct the exact Tool and model dependency set afterwards.

> **Design the Tool, choose and test its computation, validate compatibility,
> freeze the dependencies, and ship it through ordinary ODK.**

---

## Development order

```text
A  finish and commit the openfieldworks-web deployment work   Phase 0  ← essentially done
B  surface the existing Model Catalog in Composer             Phase 1
C  minimal Model Browser + compatibility UI                   Phases 1, 3
D  segmentation / classification Model Lab                    Phase 2
E  Tool dependency resolution and view                        Phase 4
F  specify minimal .gather v2 container                       Phase 5
G  bundled-model install through existing gather-models       Phase 6
H  export + Central attachment end-to-end gate                Phase 7
I  first-party Tool preset UX                                 Phase 8
J  decide whether camera preview justifies the one patch      Phase 9
K  run the complete M11 acceptance flow                       GREEN
```

**B–E are product integration over architecture that already exists. F–G are
the only substantial new platform work.** That distinction is the main thing
this revision changes about how long M11 should take.
