# Model discovery, selection and distribution — architecture audit

## Architectural invariants

Recorded 2026-09-04. These outlive the audit below and constrain `.gather` v2
and remote model delivery.

**1. The application bundle is one model provider, not the permanent home of
Gather models.** `bundledModels.js` says *what this distribution can provide*.
It is a provider, and the catalog marks its entries `source: 'app'` precisely so
a second source can appear beside it without the word "bundled" meaning
"available".

**2. Model resolution stays provider-independent.** Every source ultimately
supplies a verified `ModelPackage` plus bytes to the same `modelStore.install`.
`ensureModelAvailable({ modelStore, projectKey, modelPackage, install })` takes
the installer as a closure for exactly this reason: the store never learns where
bytes came from.

**3. Forms and compositions must eventually declare their required
`ModelRef`s.** Not yet true — a `ModelRef` reaches Gather only inside an
authored `FunctionCall`, at interaction time, which is too late to preflight or
prefetch before fieldwork. A declarative list per composition is the missing
piece, and it is what makes offline readiness checkable.

**4. Installed models are shared, content-addressed device resources.** Their
lifecycle should be **reachability**, not ownership by one form or tool — the
same conclusion the form-resource blob cache reached, and for the same reason:
two artifacts may legitimately reference identical content, so no single one may
claim it. This is why no `uninstall(model)` was added.

### The design rule these produce

> **A tool declares what model it requires, not how Gather must obtain it.**

That is what makes app-bundled models today, tool-bundled models next, and
on-demand remote models later a change of *provider* rather than a change of
Capability or execution architecture.

### The seam that upholds them

Verified 2026-09-04. **One selection seam:**
`GatherProvider.resolveCapabilityModel` — used both by the direct app actions
and injected into `createCapabilityRuntime`, so an authored `FunctionCall` and
an app call converge on the same code before execution.

Two honest qualifications:

- `src/compute/runtime/modelExecutor.js` calls `modelStore.resolve` a second
  time, to obtain the artifact's device path. It derives the ref from the
  package it was handed, so it **cannot select a different model** — it is not a
  second selection path — but it is a direct store dependency a remote-delivery
  design would need to account for.
- `actions.installModel` and `actions.resolveModel` are exposed with **no
  consumers**. They are shaped like a second path; if they gain one, it should
  be `resolveCapabilityModel`.

---

**Audit below: analysis only, read from the code on 2026-09-04.**

> **Implemented 2026-09-04.** Steps 1–6 below have landed; §7 (no distributor
> in identity) and §8 (`.gather` multi-file packaging) are deliberately not
> done. What shipped:
>
> ```text
> gather-capabilities  acceptedModelProfiles on definitions
>                      createCapabilityRuntime({ resolveModel })  ← the fix
>                      modelRef optional in image.* input schemas
> gather-models        modelStore.listInstalled({ projectKey })
> src/compute/models/  bundledModels.js   one declaration per shipped model
>                      modelPolicy.js     capability → default ModelRef
>                      modelCatalog.js    the Gather Model Catalog
> GatherProvider       resolveCapabilityModel injected into the runtime
>                      modelCatalog exposed as an action
> ```
>
> Both actionable workflows are covered end to end in
> `test/compute/model-selection-workflows.test.mjs`, through the real registered
> A2UI function, the real capability runtime and a real model store —
> `segmentExecute` is not stubbed at the boundary under test, which is precisely
> what no earlier test could observe.

**Headline.** The portable model domain is in better shape than the target
implies — `gather-models` already does identity, integrity, validation,
compatibility and convergent installation, and `image.segment` already takes a
serializable `ModelRef`. What is missing is everything *around* selection: there
is no default-model policy, no way to turn an authored `ModelRef` back into a
resolved model, no model catalog for the Composer, and no bundle format.

One finding is a live defect rather than a gap: **the A2UI-registered
`image.segment` cannot execute.** Detail in §C.

---

## Summary by workflow

| workflow | status |
| --- | --- |
| **1. Capability default model** | **MISSING** — no policy layer exists. The only default is `modelName = 'u2netp'` as a JS parameter default in `GatherProvider`, which is app wiring, not a resolvable contract. |
| **2. Explicit pre-installed Gather model** | **PARTIAL / INCORRECT** — `ModelRef` is already the capability's public input and `modelStore.resolve` already maps a ref to an installed model, but nothing connects them on the A2UI path. As registered, the function fails. |
| **3. `.gather`-bundled model** | **MISSING** — `.gather` is a single JSON file today. No bundle, no manifest, no model extraction. `modelStore.install` is source-agnostic and would accept one unchanged. |

The invariant you want to preserve — *different distributors, one `ModelRef`,
one Capability contract, one runtime, one provenance* — is **already true for
installation and execution**. It is untested for distribution because only one
distributor exists.

---

## A. `gather-models` — EXISTS, and is close to complete

`packages/gather-models/src/`

| concern | status | where |
| --- | --- | --- |
| `ModelRef` shape | EXISTS | `modelPackage.js` → `{ id, version, revision, artifactSha256, taskProfile }` |
| `ModelPackage` shape | EXISTS | `identity`, `taskProfile`, `artifact{path,sha256}`, `tensor{inputName,inputShape,outputNames,layout}`, `upstream{project,revision,license,…}`, `conversion{…}`, `preprocessing[]`, `postprocessing[]`, optional `labels{path,sha256}` |
| revision calculation | EXISTS | `modelRevisionFor` — `digestCanonical` of the whole validated package with `identity.revision` stripped. Content-addressed: identity + tensor contract + pre/post steps + artifact digest all bind into it |
| compatibility / task metadata | **EXISTS** | `TASK_PROFILES` = `segmentation.binary.v1`, `classification.ranked.v1`; validation enforces profile-specific postprocessing (`binaryMask`, `topK` + `labels`) |
| store installation layout | EXISTS | `projects/<key>/models/<revision-hex>/{model.json,model.lock.json,model.onnx,labels.txt}` |
| availability / resolution | EXISTS | `modelStore.resolve({projectKey, modelRef})`, `ensureModelAvailable({modelStore, projectKey, modelPackage, install})` |
| sources converge | **EXISTS** | `install()` takes `{modelPackage, artifactBytes, labelBytes}` — it has no idea where bytes came from. `ensureModelAvailable` takes an injected `install` closure precisely so bundle/Central/registry share one store |
| **source / distributor persisted** | **MISSING** | Nothing records *where a model came from*. `upstream` records the model's scientific provenance (project, revision, license), not its distributor. Installation-time only |

`resolve()` verifies on every first read per process: lock ↔ descriptor,
artifact digest, labels digest, and re-derives the revision from the stored
descriptor. That is the property that makes convergence safe.

**Gap worth naming:** no `listInstalled({projectKey})`. A catalog and a
"compatible models" filter both need one, and the store has no enumeration API
at all.

---

## B. Gather-shipped models — EXISTS, boundary already correct

| question | answer |
| --- | --- |
| where the bytes live | `assets/models/` — `u2netp.onnx` (4.6 MB), `mobilenet-v3-large-imagenet1k-v2.onnx` (21.9 MB), `imagenet-1k-labels.txt`, `export-metadata.json` |
| how packages are declared | `src/compute/models/bundledModelPackages.js` — `BUNDLED_MODEL_PACKAGES` keyed by short name |
| when installed | lazily, first use: `ensureBundledModel` → `resolve` → on `GATHER_MODEL_UNAVAILABLE` → `installBundledModel` |
| ordinary `ModelRef`s? | **yes** — identical `modelStore.install` path, identical layout, indistinguishable afterwards |
| capability default model? | **no** |

The ownership boundary you describe is already in place and was made explicit
two commits ago: `gather-models` understands models; `bundledModelPackages`
is app policy about which models *this build* ships, and deliberately stays
app-side.

**Note:** `bundledResources` in `bundledModelInstaller.js` is a second map
keyed by the same short names, holding `require()` handles. Adding a model
means editing two maps that must agree — a small, real coupling.

---

## C. Capabilities ↔ Models — PARTIAL, with one defect

### What exists

`SegmentInputSchema = { image: ImageAssetSchema, modelRef: ModelRefSchema }`
— **`ModelRef` is already the capability's public, serializable input.** The
implementation validates `modelRef.taskProfile` against the expected profile
and refuses a mismatch (`GATHER_IMAGE_UNSUPPORTED_PROFILE`). Provenance records
the real thing: `modelExecutor` writes receipts with
`capability: 'image.segment'` and the model ref, and `segment()` echoes
`model: modelRef` into its result.

`image.segment` is therefore **already stable semantic behaviour independent of
which model satisfies it** — the capability names an operation and a profile,
not a model.

### Where the model actually comes from today

```text
GatherProvider.runImageSegmentation({ image, modelName = 'u2netp' })
      ↓  BUNDLED_MODEL_PACKAGES[modelName]          ← app map lookup, not a ref
      ↓  ensureBundledModel(...)                     ← install if absent
      ↓  segment({ image, model: <ModelPackage>, modelRef: createModelRef(model), execute })
      ↓  execute → computeRuntime.executor.segment({ image, model, projectKey })
      ↓  modelExecutor.resolvedModel → modelStore.resolve({ modelRef: createModelRef(model) })
```

So there are **two** model arguments in flight: `modelRef` (serializable,
public) and `model` (the full `ModelPackage`, opaque, private). The executor
takes the **package**, not the ref, and re-derives the ref itself.

### The defect

`createCapabilityRuntime` binds `'image.segment': (input) => segment({ ...input, execute })`
and passes the A2UI-validated input straight through. That input is
`{ image, modelRef }` — **there is no `model`**. Verified:

```text
schema-accepted keys = [ 'image', 'modelRef' ]
execute saw model = undefined
```

`modelExecutor.resolvedModel` then calls `createModelRef(undefined)`, which
throws in validation. So the registered A2UI function `image_segment` is
advertised to the Composer and cannot run. Nothing catches this because no test
or gate drives a capability function through A2UI with a real runtime — the
renderer fixtures stub `segmentExecute` entirely
(`apps/renderer/src/fixtureCapabilities.js`).

**The fix is small and already latent:** `modelStore.resolve({projectKey, modelRef})`
returns `{ model: descriptor, modelRef, artifactPath, … }`. A resolution step
between the A2UI function and the capability turns a `ModelRef` into the
package the executor wants. That step is workflow 2.

---

## D. A2UI / Composer model exposure — MISSING, but nothing is *wrong*

| question | answer |
| --- | --- |
| are models exposed to the Composer? | **No.** Nothing enumerates models to any authoring surface |
| represented incorrectly as Components/Functions? | **No** — and this is worth stating: no one has been tempted yet. There is no model Component, no model Function, no model in `gather-catalog` |
| can the agent discover compatible installed models? | **No** — the store has no `listInstalled` |
| can an A2UI Function accept a serialized `ModelRef`? | **Yes, already.** `ModelRefSchema` is part of `SegmentInputSchema`, and `capabilityFunctions` uses the capability's own input schema as the wire schema, so `catalog.invoker` will parse and pass a `ModelRef` today |
| obvious injection point for a Model Catalog? | **Yes** — `capabilityFunctions({definitions, runtime})` is built in `GatherProvider` from `CAPABILITY_DEFINITIONS`; a sibling `modelCatalog` assembled from the store and app config would sit beside it without touching A2UI |

`defineCapability` already carries Composer metadata (`group`, `subcategory`,
`kind: 'inference'`, `platforms`, `describe()`), and its docstring states the
intent: *"the Composer agent can load `definitions.js` to learn the available
operations and their io contracts without pulling native dependencies."* A
Model Catalog is the same idea for a third kind of thing.

**What a capability does not yet declare:** which task profile it accepts.
`IMAGE_TASK_PROFILES.segmentationBinary` is hard-coded inside
`implementation.js` rather than declared in the definition, so nothing
machine-readable says *`image.segment` accepts `segmentation.binary.v1`*. That
one field is what makes catalog filtering possible.

---

## E. `.gather` model packaging — MISSING

Today a `.gather` resource is **a single JSON file**. `flower_v1.gather` in the
Central gate is `authored_photo_v1.a2ui.json` renamed;
`resolveCompositionDefinition` decodes it to text and `JSON.parse`s it. There is
no archive, no internal manifest, no file extraction.

| anticipated capability | status |
| --- | --- |
| bundled arbitrary files | MISSING |
| manifest-declared models | MISSING |
| model metadata | MISSING |
| extracting model bytes | MISSING |
| installing through `gather-models` | **the seam EXISTS** — `install({modelPackage, artifactBytes, labelBytes})` needs only bytes and a package |
| dedupe against installed | **EXISTS** — `ensureModelAvailable` resolves first and installs only on `GATHER_MODEL_UNAVAILABLE`; identical packages produce an identical revision, so an identical model installs zero times |
| validating compatibility before use | PARTIAL — `validateModelPackage` runs at install and resolve; nothing validates *before* the interaction is offered |

**Smallest extension:** a `.gather` becomes a container with a manifest that may
declare `models: [ModelPackage]` plus their byte entries. Everything downstream
already exists. The container format is the only new thing, and it should be
chosen for what the resource loader can already do — the loader hands back
`base64` for opaque resources, so a zip is decodable without new transport.

---

## F. Default model semantics — MISSING

There is no default-model concept anywhere. The literal `modelName = 'u2netp'`
in `GatherProvider.runImageSegmentation` is a JS parameter default in app
wiring: not serializable, not discoverable, not overridable by an author, and
invisible to provenance until after execution.

**Where it belongs:** app/capability configuration, not `gather-models`. The
package must keep answering *what is this model* and never *which model should
this app prefer*. Concretely, a map the app owns:

```text
{ 'image.segment': ModelRef, 'image.classify': ModelRef }
```

resolved at call time when the author supplied none. That preserves the
distinction you named — `ModelRef` is exact identity; the default is a *policy
that selects one* — and it keeps the recorded provenance identical either way,
because by the time the capability runs it has a concrete ref regardless of who
chose it.

---

## Recommended order

Each step is independently useful and none requires the next.

1. **Fix the A2UI capability model gap** (§C). Resolve `modelRef` → installed
   package between the A2UI function and the capability. Small, and it makes
   workflow 2 real. Add a test that drives `image_segment` through
   `catalog.invoker` with a real store — the missing test is why this survived.
2. **Add `modelStore.listInstalled({projectKey})`.** Enumeration is the
   precondition for every catalog and every compatibility filter. Pure addition
   to `gather-models`.
3. **Declare accepted task profiles on capability definitions.** Move
   `IMAGE_TASK_PROFILES.segmentationBinary` out of `implementation.js` into
   `defineCapability`'s spec (`acceptsTaskProfile` or similar) so the pairing is
   machine-readable. Enables filtering; costs one field.
4. **App-owned capability default models** (§F). A small config map plus
   resolution at call time. Removes `modelName = 'u2netp'`. Workflow 1.
5. **Gather Model Catalog** — a Gather-owned, typed, machine-readable list built
   from `listInstalled` + `BUNDLED_MODEL_PACKAGES`, assembled beside
   `capabilityFunctions` in `GatherProvider` and passed to the Composer as its
   own kind. **Not** an A2UI Function or Component. Workflow 2's authoring half.
6. **`.gather` container with declared models** (§E). Last because it is the
   only genuinely new format, and because steps 1–5 make its payload
   meaningful. Reuses `install` and `ensureModelAvailable` unchanged.

### Things to keep not doing

- `gather-models` gains no inference, no ONNX, no OpenCV, no default policy.
- No A2UI-specific model subsystem; the Model Catalog is Gather's and A2UI
  merely consumes `ModelRef`s it already accepts.
- No second execution path for tool-bundled models — step 6 ends at
  `modelStore.install`, and everything after is the path that already exists.
- No `ModelPackage` on a serializable contract. `ModelRef` crosses; the package
  stays private, which is the split the current code already draws.

### Two smaller things noticed

- `bundledModelPackages.js` and `bundledResources` in
  `bundledModelInstaller.js` are two maps keyed by the same names that must
  agree. Worth merging when step 4 touches this area.
- `modelStore` has no uninstall and no sweep. Models are the largest artifacts
  on the device (26 MB bundled today), and a `.gather`-delivered model would add
  more. Not urgent; worth a note before step 6.
