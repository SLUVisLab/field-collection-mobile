# M11 Refinement — Composer Function, Capability, and Model Authoring UX

## Status

**Refinement to M11 / Tool Composer authoring UX**

> **Amended 2026-09-06, after the Phase 1 work and a cross-origin review.**
>
> ```text
> STOP B / Phase 1       COMPLETE
> native/web parity      8/8
> OpenCV version         exact native/web match (4.12.0)
> renderer CSP           unsafe-eval currently required
> renderer payload       1.2 MB → ~12 MB
> ```
>
> Phase 6 is amended: the Composer Function browser is a **read-only teaching
> surface fed by Catalog data**, and Tool mutation stays wrapper-owned. The
> original shape put interactive Gather model selection inside a cross-origin
> iframe, which is a cost this refinement does not need to pay to be useful.

This document turns the current Composer architecture into the next implementation sequence. The goal is not to add new scientific capability yet. The goal is to make the **existing Gather authoring vocabulary visible, teachable, copyable, and coherent inside the A2UI Composer**, while preserving the runtime and packaging boundaries already proven by the vertical slice.

The central design decision is:

> **Components are interaction primitives. Functions are executable authoring primitives. Gather Capabilities are the portable semantic subset of Functions. Models are dependencies selected in the context of model-backed Capabilities.**

The Composer should teach these concepts where authors actually work, rather than splitting them across disconnected wrapper panels.

---

# 1. Product outcome

The authoring experience should converge on:

```text
A2UI Composer

Components
→ browse interaction primitives
→ rendered preview
→ usage JSON
→ properties

Functions
→ browse executable primitives
→ usage JSON
→ parameters / return type
→ Gather-specific extension when applicable:
     capability metadata
     compatible models
     current Tool occurrences
     model selection
     exact ModelRef
```

The Gather wrapper continues to own:

```text
Context
Library
Review
Publish
```

The existing **Models** panel may remain during the transition, but the intended end state is that model selection is primarily performed **inside the Function detail for the model-backed Capability that uses the model**.

The researcher should not need to reason about separate browser/mobile capability vocabularies.

---

# 2. Terminology and ownership

## 2.1 Component

A reusable presentation / interaction primitive represented by code and exposed through A2UI.

Examples:

```text
CameraView
Flow
MaskReview
MeasurementReview
```

Authoring question:

> What interaction do I want to present?

The upstream Composer already handles Components well.

---

## 2.2 Function

The A2UI authoring/runtime primitive for an executable operation.

Examples include both:

```text
image_segment
measure_area

gather_persistAsset
gather_completeComposition
```

The upstream Composer Catalog already contains Function metadata, but the gallery currently exposes Components only.

The generic upstream Composer patch should understand **Functions**, not Gather-specific Capabilities or models.

---

## 2.3 Gather Capability

A portable semantic operation implemented by Gather.

Current definitions:

```text
image.segment
image.classify

measure.area
measure.perimeter
measure.boundingBox
measure.centroid
measure.color
measure.sharpness
```

A Capability is a Function-level semantic contract, but not every Function is a Capability.

For example:

```text
gather_persistAsset
gather_completeComposition
```

are **host functions**, not portable Capability dependencies.

Authoring question:

> What computation do I want the Tool to perform?

---

## 2.4 Model

An exact computational dependency satisfying a model-backed Capability profile.

Example:

```text
image.segment
accepts profile:
  segmentation.binary.v1

compatible model:
  U²-NetP
```

A Model should normally be selected **through the Capability that consumes it**, not as an isolated top-level concept.

Authoring question:

> Which implementation should this semantic operation use?

---

# 3. Non-negotiable runtime invariant

## 3.1 Authorable means previewable and device-executable

Adopt this as an enforced invariant:

> **If Gather exposes a Capability as authorable, it must execute in both the mobile runtime and the browser preview runtime.**

The implementations may differ internally:

```text
Capability contract
        │
        ├── native implementation
        │     RN / native OpenCV / ORT-RN
        │
        └── web implementation
              browser image adapter / web CV / ORT-Web
```

But the researcher should not encounter:

```text
works on device
does not work in Composer
```

as a normal supported state.

This is an implementation concern below the authoring abstraction.

---

## 3.2 Replace preview-gating with parity enforcement

Today the catalog-visible set is effectively restricted by browser implementation support:

```text
CAPABILITY_DEFINITIONS          8
catalog-advertised capabilities 3
```

This hides valid device behavior and makes the visible vocabulary silently incomplete.

The intended architecture is:

```text
CAPABILITY_DEFINITIONS
        ↓
parity gate
   ├── native implementation exists
   └── web implementation exists
        ↓
authoring Catalog
```

Do not use `ADVERTISED_CAPABILITIES` as a permanent second semantic registry.

If a Capability is incomplete on one host, it should not be accepted into the parity-safe authorable set until the implementation gap is closed.

---

# 4. Development sequence

The work should proceed in the following order.

---

# Phase 0 — Audit before patching

Before changing Composer, inspect the existing upstream implementation.

## Goal

Determine the smallest generic upstream-shaped patch.

## Inspect

### Component gallery

Identify the implementation responsible for:

```text
component navigation/list
selected-component detail
Preview
Usage JSON
Copy button
Properties table
category handling
```

Determine what can be reused directly for Functions.

### Function Catalog schema

Confirm the existing Function metadata shape:

```text
name
description
parameters
returnType
```

and any existing generic metadata / extension fields.

### Usage-example support

Determine whether upstream already has a generic place for:

```text
examples
usage
documentation metadata
```

Do not add a protocol field until this is measured.

### Host extension seam

Determine the smallest way a Function detail screen could expose a generic extension region without teaching upstream Composer about Gather.

Conceptually:

```text
Function detail
├── Usage
├── Parameters
├── Returns
└── host extension region
```

## Stop/report condition

Before implementation, report:

```text
files/components involved
reusable gallery/detail primitives
existing Function schema
whether generic usage metadata already exists
smallest plausible extension seam
estimated patch size
```

If the Function view requires a large invasive Composer rewrite, stop and reassess.

---

# Phase 1 — Restore Capability runtime parity

Do this before exposing the full Capability vocabulary.

## Goal

All current Gather Capabilities execute in both supported hosts.

**COMPLETE — 2026-09-06.**

```text
image.segment              native ✓ web ✓
image.classify             native ✓ web ✓
measure.area               native ✓ web ✓
measure.perimeter          native ✓ web ✓
measure.boundingBox        native ✓ web ✓
measure.centroid           native ✓ web ✓
measure.color              native ✓ web ✓
measure.sharpness          native ✓ web ✓
```

The browser measures with **OpenCV**, at the device's exact version:

```text
device    react-native-fast-opencv   OpenCV 4.12.0
browser   @techstark/opencv-js       OpenCV 4.12.0
```

which is the pattern inference already used — `onnxruntime-react-native` and
`onnxruntime-web`, one library family, two bindings, one set of numbers.

An earlier attempt reimplemented the arithmetic by hand and got contour lengths
wrong: it matched OpenCV on simple shapes and over-counted holes, because
reproducing `findContours` means reproducing Suzuki–Abe border following. Parity
by construction beat parity by careful reimplementation, and the hand-rolled
module was deleted.

### What it cost

```text
renderer CSP       'unsafe-eval' now required, renderer origin only
renderer payload   1.2 MB → ~12 MB (3.9 MB gzipped)
```

`wasm-unsafe-eval` is not enough: `@techstark/opencv-js` is ~10.8 MB of
JavaScript rather than a separate `.wasm`, and its Embind layer builds the
`cv.Mat` surface with `new Function` (`createNamedFunction`,
`craftInvokerFunction`). That is how Embind works, so it cannot be patched
around.

**Accepted as a temporary, renderer-origin-only constraint.** Later
optimisation candidates, neither scheduled:

```text
custom OpenCV build with -sDYNAMIC_EXECUTION=0 / trimmed modules
lazy loading, so the preview pays for OpenCV only when it measures
```

Prefer shared portable computation when it naturally exists, but do not require identical implementation libraries.

The required parity is:

```text
same semantic inputs
same semantic outputs
same result shape
equivalent numerical meaning
```

not:

```text
same internal library
same code path
```

## Cross-runtime fixtures

Use deterministic fixtures for each operation where practical.

Examples:

```text
known mask
→ area
→ perimeter
→ bounding box
→ centroid

known image + mask
→ mean color
→ sharpness
```

The fixture should let web behavior be checked against the Capability contract and the existing native/domain expectation.

## Structural parity gate

Add a gate based on actual runtime registries, conceptually:

```js
for (const capability of CAPABILITY_DEFINITIONS) {
  assert(nativeRuntime.canExecute(capability.id));
  assert(webRuntime.canExecute(capability.id));
}
```

Do not create another manually maintained parity list.

## Acceptance

```text
✓ every current CAPABILITY_DEFINITION has native execution
✓ every current CAPABILITY_DEFINITION has web execution
✓ adding a definition without either host implementation fails a gate
✓ current vertical-slice rehearsal remains green
✓ catalog advertises 8 capability functions, up from 3
```

`assertRuntimeCovers` lives in `gather-capabilities` and is called by **both**
hosts where they build their runtime — `previewRuntime` for the browser,
`GatherProvider` for the device — so a Capability defined without an
implementation fails at construction rather than vanishing from the catalog. Its
message says the remedy is not to stop advertising it.

### Parity has two halves, and both are permanent

```text
registry parity   both hosts have an implementation   runtime-parity.test.mjs
fixture parity    the implementations mean the same   pixel-measurements.test.mjs
```

Registry parity cannot prove two implementations *mean* the same thing, which is
what the fixtures are for. Two are worth keeping forever:

- **red-vs-alpha.** The device builds its mask from the red channel; the browser
  thresholded alpha. The fixture is a mask opaque everywhere and red on the left
  half only, so the two readings differ by a factor of two. That divergence was
  real, silent, and survives any change of library.
- **hole perimeter.** A 6×6 hole adds `20 + 4√2`, not the 28 an intuitive
  reading of the geometry gives, because a chain code takes its corners
  diagonally. It establishes that **OpenCV's semantics are the contract**, not
  our geometric intuition.

---

# Phase 2 — Generic upstream Function browser patch

## Goal

Expose Functions in the upstream A2UI Composer using the same successful interaction pattern as Components.

This patch must remain generic.

It must not know about:

```text
Gather Capabilities
ONNX
ModelRef
acceptedModelProfiles
OpenCV
Gather model selection
```

## Desired Composer structure

Use the upstream UI conventions that fit best, conceptually:

```text
Catalog

Components
Functions
```

or equivalent navigation if the current gallery architecture suggests another natural placement.

## Function detail

For a selected Function show:

```text
Function name
Description

Usage
[copyable JSON]

Parameters
name | description | type | required

Returns
type
```

There is no fake Preview panel.

For a Function, **Usage is the meaningful equivalent of the Component preview example**.

### Example

Conceptually:

```text
Measure area

Calculate the area represented by a binary mask.

USAGE

{
  "functionCall": {
    "call": "measure_area",
    "args": {
      "mask": {
        "path": "/working/mask"
      }
    },
    "returnType": "decimal"
  },
  "resultPath": "/working/area"
}

[Copy]

PARAMETERS

name    description    type       required
mask    Binary mask   MaskAsset   yes

RETURNS
decimal
```

Use the actual current Gather/A2UI syntax. This example is illustrative.

## Generic host extension seam — **data, not callbacks**

Add the smallest generic mechanism that lets a host augment Function detail, and
make it **Catalog data**:

```text
function
├ name / description / params / return
├ usage example
└ host metadata
   ├ semantic kind: capability | hostFunction
   ├ capability id
   ├ accepted profiles
   └ compatible model references/examples
```

The Catalog payload already crosses renderer→editor over `postMessage`, and
`x-gather-category` already rides it as an annotation. Extending that costs a
render path, not an interface.

**No callbacks, and no nested wrapper iframe in this pass.** The wrapper and the
editor are deliberately different origins so that reading the editor's state is
impossible rather than merely discouraged, and this session has already met that
wall twice — the camera's Permissions Policy chain, and the renderer picker that
cannot be driven from outside. A host-contributed *region* would mean rendering
Gather UI inside a cross-origin document; annotations mean the editor renders
data it was handed and reaches into nothing.

If "Change model" is ever wanted directly in that view, the thing to explore is
a **generic postMessage host-action request** — not cross-origin DOM. Explicitly
later.

Do not hard-code a `Models` section upstream. Upstream renders whatever host
metadata the Catalog declares, generically, and is inert for catalogs that
declare none.

## Patch quality requirements

The patch should be:

```text
generic
inert for catalogs that do not use the new seam
compatible with upstream data structures
easy to delete if A2UI v1 provides equivalent behavior
```

**"Small" is architectural here, not numeric.** A Function browser is a genuinely
new view, and expecting it to resemble the existing one-attribute patches is
unrealistic. In bounds:

```text
one navigation addition
one Function list/detail view
reuse of the existing Usage / Copy / properties-table components
one generic metadata seam
```

Stop and report before continuing if it starts to require changes to:

```text
Composer document state      Monaco          storage
editor lifecycle             bridge semantics
broad routing / state plumbing
```

A self-contained 300–500 line feature is far less concerning than 150 lines
smeared across six architectural layers. The smell test is >~500 changed lines
across many core files, or a patch that needs to understand editor internals
rather than Catalog data.

Add it to the existing patch ledger with a clear explanation of why it exists.

---

# Phase 3 — Canonical copyable Function usage

## Goal

The Function browser should teach authors valid hand-authoring syntax.

A Function signature alone is not sufficient to derive a useful idiomatic example.

For example, the signature does not fully tell us:

```text
which data-model paths are pedagogically useful
whether the common use is action-position or value-position
where an action result should be written
how a modelRef should normally be represented
```

Therefore Gather should own canonical authoring-example information where it
cannot be derived safely — **beside** the definitions, not inside them:

```text
CapabilityDefinition            portable semantic/runtime contract
        +
CapabilityAuthoringMetadata     pedagogical only
        ↓
authoring catalog projection
```

`CAPABILITY_DEFINITIONS` stays a clean portable contract that both hosts and the
packager consume; an authoring example is UI-facing and does not belong in it.

The metadata layer is keyed by Capability id and **gated against the
definitions**, so it cannot quietly become a second semantic registry: an entry
for an unknown id, or a definition with no entry, is a failure. Runtime
identity, parameters, return type and accepted profiles keep coming from the
real definition — the metadata carries only what cannot be derived, such as
representative binding paths and canonical usage shape.

## Avoid duplicate handwritten contracts

Do not maintain arbitrary JSON snippets detached from Capability definitions.

Preferred flow:

```text
CapabilityDefinition
        ↓
authoring-example metadata
        ↓
generate canonical FunctionCall example
        ↓
Composer Usage panel
```

Only add minimal pedagogical metadata that cannot be derived.

Example conceptual metadata:

```js
authoringExample: {
  args: {
    mask: { path: "/working/mask" }
  },
  resultPath: "/working/area"
}
```

This metadata is documentation/authoring guidance, not runtime state.

## Gather-specific action syntax

Remember that `resultPath` is a Gather host extension for lazy action-position FunctionCalls.

The generic Composer patch must not invent or understand that itself.

It should render a usage example supplied/generated by the Catalog/host authoring surface.

---

# Phase 4 — Treat examples as executable specifications

## Goal

Copyable examples must not rot independently of runtime behavior.

For every generated example:

```text
CapabilityDefinition
→ generate usage JSON
→ parse
→ validate through real authoring/runtime schema
```

Where practical:

```text
generated example
+ deterministic fixture
→ web Capability runtime
→ expected result
```

Examples:

```text
measure.area
+ fixture mask
→ expected area

measure.perimeter
+ fixture mask
→ expected perimeter
```

For a model-backed operation:

```text
generated image.segment example
+ real compatible first-party ModelRef
→ ORT-Web
→ valid segmentation result
```

The authoring example becomes part of the Capability acceptance criteria.

---

# Phase 5 — Gather Capability presentation inside Functions

## Goal

A Gather Capability should feel like a first-class Function in Composer while retaining the semantic distinction between Capability and host Function.

## Catalog grouping

Use generic category metadata so the Function browser can organize entries cleanly.

Example:

```text
Image
  Segment image
  Classify image

Measurement
  Area
  Perimeter
  Bounding box
  Centroid
  Color
  Sharpness

Gather host
  Persist asset
  Complete Tool
```

Do not mislabel host functions as Capabilities.

## Capability detail

The generic sections remain:

```text
Usage
Parameters
Returns
```

Gather's extension may additionally show:

```text
Capability
semantic id
accepted model profile(s), when applicable
used in current Tool
```

Avoid duplicating information already clearly represented by the generic Function metadata.

---

# Phase 6 — Model *information* under model-backed Functions

> **Amended 2026-09-06.** Originally "fold model selection into Function
> detail". Selection is a mutation, and mutation lives in the wrapper.

## Goal

Models should become an extension of the operation that consumes them.

The researcher-facing mental model is:

```text
Segment image
├── semantic contract
├── accepted profile: segmentation.binary.v1
└── selected implementation/model
```

rather than:

```text
choose Capability somewhere
then find unrelated Models panel
then remember how they connect
```

## Example Function detail

```text
Segment image

Generate a segmentation mask for an image.

USAGE
[generated invocation JSON]

PARAMETERS
...

RETURNS
MaskAsset

MODEL
Required profile
segmentation.binary.v1

Current Tool
Segment leaf
  U²-NetP · sha256:dcbe...

Compatible models
  U²-NetP
  Future compatible model

[Copy ModelRef]
```

The initial implementation can be simpler than this visually, but preserve the architecture.

---

## The division of labour

```text
Composer Function browser          Wrapper
→ Functions / Capabilities         → current Tool state
→ usage JSON                       → inspectComposition()
→ parameters / returns             → setModelSelection()
→ compatible model information     → autosave / Library mutation
→ copyable ModelRef and
  model-populated examples
```

The conceptual pull of "models live under the model-backed Function that uses
them" is right, and the read-only half of it is achievable now through Catalog
data. What the first version does **not** do is pay a large cross-origin
architecture cost to make that view interactive.

Everything below about occurrence-aware selection therefore describes **wrapper**
behaviour. It remains authoritative for how selection works; it just does not
happen inside the editor in this pass.

---

# 7. Model selection is occurrence-aware

Do not turn:

```text
image.segment → U²-NetP
```

into a global Capability setting.

A Tool may contain multiple occurrences:

```text
image.segment #1 → Model A
image.segment #2 → Model B
```

Use the existing authoring semantics:

```text
inspectComposition()
→ call occurrences
→ selectionGroup

setModelSelection()
→ update the appropriate authored selection source
```

## Suggested UX

When one occurrence exists:

```text
Model
[ U²-NetP ▾ ]
```

Keep it simple.

When several independently selectable occurrences exist:

```text
Used in this Tool

Segment leaf
Model: U²-NetP

Segment flower
Model: Flower model
```

When occurrences share a `selectionGroup`, present one shared selection rather than duplicate controls.

Do not create new model-selection semantics in Composer.

---

# 8. Usage JSON should respond to model selection

For a model-backed Capability, the Usage example should teach the actual model-selection modes Gather supports.

## Default

```text
Model
[ Gather default ]
```

Usage intentionally omits `modelRef`.

This teaches:

> no explicit ModelRef → product policy chooses the model for an editable draft.

## Explicit

```text
Model
[ U²-NetP ]
```

Usage contains the exact ModelRef:

```json
{
  "id": "u2netp-salient-segmentation",
  "revision": "sha256:..."
}
```

## Bound

Where relevant, expose/document the binding form:

```text
modelRef: { path: "/working/modelRef" }
```

Do not oversimplify bound/dynamic selection into a literal picker if the existing `setModelSelection` rules intentionally refuse mutation.

The current semantics remain authoritative:

```text
default
explicit
bound + static
bound + dynamic
```

---

# 9. Models panel becomes transitional

Do not delete the current Models panel immediately.

First prove that the Function detail can perform the important model authoring tasks.

During transition:

```text
Functions
→ primary model-selection authoring surface

Models
→ existing fallback/reference surface
```

Once Function-integrated model selection is complete and rehearsed, audit whether the separate Models sidebar still has unique value.

Possible eventual wrapper:

```text
Context
Library
Review
Publish
```

with model authoring living inside Composer Functions.

Do not remove Models merely for aesthetic cleanliness before parity is proven.

---

# Phase 7 — Prepare BYOM at the correct semantic boundary

> **Preparation only. No BYOM implementation in this refinement.** BYOM was
> moved out of M11's GREEN definition deliberately: it crosses the model
> store's provenance and trust boundary, and none of the workflow M11 exists to
> prove depends on it. See the M11 milestone note.
>
> What this phase may do is leave the seam obvious — a compatible-models list
> under `image.segment` is the natural place a future *"Import compatible
> model…"* would sit. Leaving room is not the same as building it.

Do **not** implement BYOM in this refinement unless separately authorized.

But design the Function/Model extension so BYOM has a natural future entry point:

```text
Segment image
→ Model
→ Import compatible model...
```

The import context already tells Gather:

```text
required capability
accepted model profile
expected semantic result
```

Example:

```text
Import model for Segment image

Required profile:
segmentation.binary.v1

[Choose model...]
```

This is preferable to:

```text
Models
→ Import arbitrary ONNX
```

because Gather knows what semantic contract the imported model is expected to satisfy.

## Do not make generic ONNX execution the normal BYOM abstraction

Avoid making:

```text
onnx.run
```

the primary user-facing Capability for custom models.

That leaks tensor/runtime implementation details into the semantic authoring layer.

Preferred BYOM model:

> Bring your own model **for a known Capability profile**.

A generic low-level ONNX execution primitive can be considered later if a concrete use case requires it.

---

# Phase 8 — Copyable ModelRef and model-populated invocation

For a compatible model, provide a copyable exact `ModelRef`.

Example:

```json
{
  "id": "u2netp-salient-segmentation",
  "revision": "sha256:dcbe..."
}
```

Do not make the full `ModelPackage` the primary copy target.

Where useful, also provide:

```text
Copy invocation using this model
```

Generate it from:

```text
Capability canonical usage example
+
selected exact ModelRef
```

Do not hand-maintain a second invocation example.

This should visually teach:

```text
Component
= interaction primitive

Capability / Function
= semantic operation

Model
= exact dependency implementing a model-backed operation
```

---

# Phase 9 — Agent authoring implications

The Function catalog is also part of the agent's authoring context.

Once parity is restored:

```text
all current parity-safe Capabilities
→ present in Catalog
→ visible to humans
→ visible to agent
```

This removes the current silent partial vocabulary.

The copyable usage examples should also be suitable as high-salience authoring guidance.

Do not reopen prompt-engineering work broadly during this pass. The immediate goal is to make the authoritative catalog complete and concrete.

After implementation, rerun the existing fixed agent smoke prompt once and record whether behavior changes. Treat the result as an observation, not a release gate.

---

# 10. Preserve existing boundaries

This refinement must not introduce:

```text
a second Capability registry
a Gather behavior DSL
a second model-selection mechanism
a second composition inspector
duplicate handwritten usage snippets
browser-only authorable Capabilities
device-only authorable Capabilities
fake/simulated browser Capability results
Gather-specific model logic directly inside upstream Composer code
```

Continue to reuse:

```text
CAPABILITY_DEFINITIONS
inspectComposition()
setModelSelection()
compatibilityFor()
gather-models
existing native runtime
existing web runtime
existing package planning
```

The Composer UI is a presentation and authoring layer over those contracts.

---

# 11. Upstream patch discipline

This refinement likely adds another Composer patch.

Keep the patch ledger explicit.

The patch should be described approximately as:

```text
Generic Function catalog browser + host detail extension seam
```

It should not be described as:

```text
Gather Capability/Model browser
```

On A2UI v1 migration:

```text
re-audit upstream Function browser support
re-audit Function examples/documentation metadata
re-audit generic host extension seams
delete the patch if upstream equivalent exists
```

Do not spend time upstreaming v0.9 changes before the v1 migration unless there is a compelling immediate reason.

---

# 12. Acceptance gates

## Runtime parity

```text
✓ all current authorable Capability definitions execute natively
✓ all current authorable Capability definitions execute in web preview
✓ adding an authorable Capability without both implementations fails a gate
✓ no preview-only allowlist silently truncates the semantic vocabulary
```

## Function browser

```text
✓ upstream Composer exposes Functions alongside Components
✓ Function detail shows description
✓ Function detail shows copyable Usage JSON
✓ Function detail shows Parameters
✓ Function detail shows return type
✓ host functions and Gather Capabilities remain distinguishable
✓ no fake Function preview was added
```

## Authoring examples

```text
✓ canonical examples are generated from authoritative definitions/metadata
✓ examples validate through real schemas
✓ representative examples execute against deterministic fixtures
✓ model-backed example performs real ORT-Web inference
```

## Model integration

```text
✓ model-backed Capability detail shows accepted profile
✓ compatible model(s) can be inspected
✓ exact ModelRef can be copied
✓ current Tool selection is derived from inspectComposition()
✓ model changes use setModelSelection()
✓ multiple occurrences / selectionGroup semantics remain correct
✓ generated usage reflects default vs explicit selection correctly
```

## Regression

```text
✓ Review semantics unchanged
✓ package readiness semantics unchanged
✓ form readiness semantics unchanged
✓ .gather dependency closure unchanged
✓ existing first-party Tools still load as whole compositions
✓ vertical-slice rehearsal remains green
```

---

# 13. Recommended implementation stops

Do not attempt this entire refinement as one undifferentiated coding task.

Use these checkpoints:

```text
STOP A
Audit upstream gallery + Function schema + extension seam.

STOP B
Restore 8/8 native/web Capability parity and gate it.

STOP C
Land generic upstream Function browser patch.

STOP D
Land generated/copyable executable Function usage.

STOP E
Land Gather Capability metadata presentation.

STOP F
Integrate model inspection/selection into model-backed Function detail.

STOP G
Rehearse the complete vertical slice and evaluate whether Models sidebar
still has unique value.
```

At each stop, report architecture changes, test/gate status, patch impact, and any discovery that would alter the next step.

---

# 14. Final intended authoring experience

A researcher should eventually be able to open the Composer and reason about the whole vocabulary without knowing Gather's implementation layers.

## Components

```text
Camera View

Preview
[rendered Camera View]

Usage
[copyable A2UI JSON]

Properties
...
```

## Functions / Capabilities

```text
Segment image

Generate a segmentation mask for an image.

Usage
[copyable FunctionCall JSON]

Parameters
image      ImageAsset       required
modelRef   ModelRef         optional

Returns
MaskAsset

Model
Profile: segmentation.binary.v1
Selected: U²-NetP
[Change]
[Copy ModelRef]
```

## Non-model Capability

```text
Measure area

Usage
[copyable FunctionCall JSON]

Parameters
mask       MaskAsset        required

Returns
decimal
```

The conceptual system is:

```text
Components = what the Tool presents
Functions / Capabilities = what the Tool does
Models = how some Capabilities are implemented
```

That is the UX target for this M11 refinement.
