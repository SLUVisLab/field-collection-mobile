# Gather — Design Backlog & Open Architecture Notes

A compact record of design ideas and unresolved architecture questions to carry into upcoming milestones.

## 1. Batches — multi-form local workflow abstraction

**Decision:** use **Batch** as the user-facing and architectural term.

A Batch is a Gather-local grouping layer above ordinary ODK form instances. It should not replace the existing instance lifecycle.

### Goals

- Group many planned/completed forms together.
- Allow work to span interruptions or multiple days.
- Support entity-driven ordering / auto-population.
- Show progress such as `18 / 30 complete`.
- Allow Batch-level Send/Delete selection.
- Allow expanding a Batch to select/unselect individual instances.
- Individual forms created outside a Batch remain visible alongside Batches.

Conceptually:

```text
Batch
├── id
├── name
├── createdAt
├── members[]
│   ├── form
│   ├── entity?
│   ├── planned order
│   ├── status
│   └── instanceId?
```

Batch actions should orchestrate the existing per-instance lifecycle rather than introduce a separate submission system.

### Open backend/provenance question

Batch membership should ideally survive submission so researchers can later retrieve:

> all submissions collected as part of Batch X

Investigate the cleanest ODK/Central-compatible way to persist a stable `batchId` (and optionally a human-readable Batch name) with submitted instances without tightly coupling Central to Gather's local abstraction.

Do not rely on the Batch name as identity; use a stable UUID.

---

## 2. Field-oriented input components

Standard Gather input components should support field-work-friendly interaction rather than requiring every form/Instrument author to build it manually.

### Specialized input surfaces

Potential reusable inputs include:

- large numeric keypad;
- tally/count controls;
- measurement-oriented input;
- other large-touch-target entry surfaces.

These should be usable by both:

```text
ODK / XForms rendering
A2UI Instruments
```

### Built-in speech-to-text

Speech should be an affordance of standard `TextInput` / `NumericInput` components rather than a separate control that every Instrument must compose.

Architecture:

```text
TextInput / NumericInput
        ↓
microphone affordance
        ↓
speech.transcribe capability
        ↓
validated field value
```

Preferences/settings may enable or disable speech globally or per project.

Field metadata such as labels, choices, units, and type may eventually be supplied as recognition context.

Prefer an offline-capable speech model for field use.

---

## 3. Gather Tool Composer — project-scoped Instrument library

M11 should turn the Composer-based authoring environment into a persistent Instrument Studio.

### Instrument Library

Scope saved Instruments primarily by project:

```text
Project
└── Instruments
    ├── Instrument A
    ├── Instrument B
    └── Instrument C
```

Support at minimum:

- New
- Save
- Load/Open
- Rename
- Duplicate
- Delete
- Publish

Distinguish:

```text
Save
→ editable source/draft

Publish
→ immutable resolved artifact
```

A published `.gather` package is a distribution artifact, not the editable source.

Eventually support draft + published revisions so existing studies do not silently mutate when an Instrument is edited.

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


## 5. Browser/device capability preview in Instrument Studio

The hosted Composer currently blocks renderer camera access through iframe Permissions Policy even though the Gather renderer can access the camera directly.

The M11 Composer fork/wrapper should support renderer preview permissions for at least:

```text
camera
microphone
geolocation
```

Longer term, derive allowed iframe capabilities from declarative Instrument requirements rather than maintaining a hard-coded list.

This supports increasingly faithful browser previews using:

- `getUserMedia`;
- browser geolocation;
- microphone input;
- future `onnxruntime-web`;
- browser-side image processing / overlays.

---

## 6. Composer authoring UX refinements

The Gather Tool Composer fork/wrapper should improve the Composer authoring experience without unnecessarily modifying upstream Composer internals.

### Organize Gather Catalog components

Currently Gather Catalog components appear together in a generic/`Other` category.

Add a way to expose meaningful Gather organization in the Composer component browser, ideally reflecting the Catalog/component taxonomy rather than flattening everything together.

Potential groupings may include:

```text
Capture
Imaging / Vision
Results
Calibration
Inputs
Scientific / Measurement
```

Do not hard-code a taxonomy prematurely; prefer a mechanism that allows the Gather Catalog itself to supply category/group metadata.

### Improve renderer preview sizing

The current Composer renderer viewport does not fit the mobile-device preview particularly well.

Refine the Composer/Studio preview layout so the Gather mobile frame:

- fits comfortably without awkward clipping or excess whitespace;
- uses an appropriate responsive/default viewport;
- can still be resized when useful;
- does not bake Instrument-specific chrome or titles into the phone wrapper.

Keep this primarily a Studio/Composer-shell concern rather than changing shared Instrument Components to compensate for an awkward preview container.

### Give the Composer agent richer Gather context

Investigate how to provide the Gemini Composer agent — or any future pluggable authoring agent — with better context about Gather's extension vocabulary.

Useful context may include:

```text
available Gather Catalog components
component schemas / props
component categories
capability Actions
example compositions
result/output contracts
current Instrument definition
Catalog/version information
```

Goal:

> The authoring agent should understand the actual Gather Catalog and capability vocabulary well enough to compose valid Instruments without requiring long corrective prompts from the user.

Prefer deriving this context from machine-readable Catalog/contracts where possible rather than maintaining a separate manually duplicated prompt description.

Keep the integration agent-provider-agnostic where practical so Gemini can later be replaced or supplemented by another chat/agent service.

---


## 7. Instrument model tooling and publishing

Retain the existing M11 direction:

```text
Composer
+ Gather Catalog
+ Model Browser
+ Model Runner
+ Compatibility Validator
+ Instrument Bundler
→ .gather package
```

The Studio should eventually support:

- curated/pre-provided ONNX model library;
- upload-your-own ONNX models;
- browser-side model execution;
- model file-size checks and practical mobile-size warnings/limits;
- runtime/operator compatibility checks;
- task-profile requirements;
- inspection/validation of model input and output names, shapes, dtypes, and layouts;
- declared pre/postprocessing;
- labels and required companion-resource validation;
- sample inference / finite-output checks where practical;
- dependency hashes/locks;
- deterministic `.gather` packaging;
- selecting which Instrument/form uses a model dependency;
- automatically attaching/publishing the resolved Instrument/model package to the appropriate ODK form/Central resource set.

The model pipeline should make compatibility failures explicit before publishing, with clear PASS / WARNING / FAIL feedback rather than discovering incompatibility on the field device.

Model bytes remain outside the A2UI JSON itself. Publishing should resolve ModelRefs/resources into the `.gather` distribution artifact while preserving deduplication in Gather's Model Store after installation.

---

## 8. Component / A2UI composition cleanup

Continue reducing Instrument-specific React composites.

Current direction:

```text
Gather-specific primitives
├── CaptureView
├── ImageOverlay
├── OutputReview
└── TwoPointCalibration
```

Prefer A2UI Basic Catalog components for generic composition:

```text
Text
Button
Row
Column
Card
Image
...
```

### OutputReview

`OutputReview` should remain presentation-only:

- render the proposed typed Instrument result;
- infer sensible defaults;
- accept optional declarative labels/order/sections/units/format/visibility metadata;
- not own Accept/Retake workflow actions;
- not know about XForms persistence.

The Instrument should compose Basic Catalog buttons below it.

### Mask review

Prefer composition such as:

```text
Text
ImageOverlay
Button "Accept Mask"
Button "Retake"
```

rather than a specialized `MaskReview` workflow component if no meaningful behavior is lost.

Do not introduce a generic `ReviewPanel` unless repeated use demonstrates real shared behavior beyond Basic Catalog layout.

### Buttons

Do not maintain a Gather-specific `ActionButton` Catalog concept if upstream Basic Catalog `Button` already represents the required semantics. A shared themed RN `Button` implementation may still exist as renderer/component plumbing.

---


## 9. First-party Instruments, model families, and device sensing

Gather should ship with a small set of high-value reference Instruments and a deliberately broad but compact in-house model library.

### Initial first-party Tools

#### Human-in-the-loop segmentation

A flagship reusable workflow:

```text
CaptureView
→ ImageAnnotator
→ promptable segmentation model
→ MaskEditor
→ OutputReview
```

The important reusable primitives are:

- image capture;
- image annotation (points / boxes / simple shapes);
- promptable segmentation;
- mask editing/refinement;
- final result review.

This should be built as composition rather than one monolithic segmentation component.

#### Blob Counter

A generalized version of the existing petal-counting idea.

Prefer an OpenCV-first pipeline:

```text
image
→ preprocessing
→ thresholding
→ morphology
→ connected components / contours
→ filtering
→ count + overlays
→ review
```

Use this Instrument to expose and validate useful OpenCV primitives rather than hiding the whole workflow inside one capability.

#### Image Quality / Anomaly Assessment

A pre-built quality-control Instrument that can evaluate captured data before submission.

Potential checks include:

- blur/sharpness;
- exposure;
- framing;
- occlusion;
- subject presence;
- anomalous / out-of-distribution capture;
- other task-specific quality flags.

This aligns strongly with Gather's goal of improving data quality at the point of collection rather than discovering unusable observations later.

### Initial in-house model families

Prefer one strong reference model/package in each broad category rather than many overlapping models.

Core families:

```text
image classification
object detection
promptable segmentation
fixed/task-specific segmentation
keypoint / landmark detection
OCR / text recognition
image embeddings / similarity
image quality / anomaly assessment
monocular depth / geometry
speech-to-text
audio event classification
```

OCR is a particularly important field-work capability for specimen labels, tags, IDs, instrument displays, and reducing manual transcription.

Speech-to-text may primarily surface through standard input components, but its model/runtime should still fit the same managed on-device model infrastructure.

### Capability direction

Potential generic capability vocabulary:

```text
vision.classify
vision.detect
vision.segment
vision.segmentPrompted
vision.keypoints
vision.embed
vision.depth
vision.assessQuality

text.recognize

speech.transcribe
audio.classify
```

OpenCV remains complementary:

```text
image.threshold
image.morphology
image.contours
image.connectedComponents
measure.*
```

### Device geometry / LiDAR

Model-based depth should not be the only geometry path.

Expose native device sensing where available, including:

- LiDAR / depth sensors;
- camera intrinsics;
- device-provided depth maps;
- spatial calibration information;
- potentially AR-derived geometry.

These should enter through the same Capability architecture rather than being embedded directly in Instruments.

Conceptually:

```text
vision.depth
        ↙        ↘
model-based     device depth / LiDAR
```

Instrument authors should consume a stable semantic capability while Gather chooses the best available implementation for the device/workflow.

### Selection principle

Prioritize models and sensors that are materially more valuable **at data-entry time** than in a later offline ML pipeline.

A first-party mobile capability is especially valuable when it lets the field worker:

- validate;
- correct;
- annotate;
- measure;
- disambiguate;
- enrich;
- or immediately retake

an observation before leaving the collection context.

---


## 10. Gather-extended XLSForm authoring for built-in Instruments

Built-in / first-party Tools should feel lightweight and native during form authoring without creating a second runtime delivery mechanism.

### Authoring goal

Allow Gather-aware XLSForm templates/tooling to expose named first-party Tools as convenient selectable options, for example:

```text
type                name            instrument
gather-instrument   flower_count    blob-counter
gather-instrument   specimen_mask   guided-segmentation
gather-instrument   label_scan      ocr-capture
```

A spreadsheet template could expose the available first-party Instrument names through dropdowns or other authoring assistance.

This should be treated as **Gather authoring sugar**, not as a new ODK/XForms standards-level primitive for every built-in Instrument.

### Publish-time resolution

At publish time:

```text
instrument = blob-counter
        ↓
resolve current/pinned library revision
        ↓
resolve Catalog + models + resources
        ↓
build/retrieve immutable .gather package
        ↓
attach package to the ODK form
        ↓
emit the normal Instrument attachment reference
```

The act of publishing should pin an immutable Instrument revision and dependency lock so an existing study does not silently change when the first-party library evolves.

### One runtime path

On-device, built-in and custom Instruments should be indistinguishable:

```text
Instrument field
→ .gather attachment
→ verify / install
→ run Instrument
```

Do not create a separate built-in-Instrument runtime.

The same publish pipeline should ultimately support:

```text
first-party library Instrument
project-authored Instrument
customized copy of a first-party Instrument
future shared/community Instrument
```

### Customize path

First-party library entries should eventually support:

```text
Use
→ publish/attach the stock pinned Instrument

Customize
→ copy editable source into the current Project Instrument Library
→ edit/save/publish like any other project Instrument
```

This keeps the library an authoring convenience while preserving a single reproducible distribution/runtime architecture.

---


## 11. Visual design direction — field instrument clarity without visual fatigue

Gather should eventually develop a shared visual design language across:

```text
mobile app
Composer / Gather Tool Composer
web renderer
other Gather web surfaces
ODK Central customization where practical
```

The design system should be driven by shared semantic tokens and component styling rather than separate per-application themes.

### Direction

The emerging visual language is a hybrid of:

- rugged handheld / field equipment;
- marine electronics and Garmin-style interfaces;
- retro handheld game UI discipline;
- PostHog-like technical playfulness;
- scientific field-notebook / instrument aesthetics.

The goal is **not** to make Gather look like a game or a cockpit.

Use those references for the interaction principles they handle well:

- large, obvious touch targets;
- clear selected / active / disabled states;
- strong hierarchy;
- high contrast;
- compact but legible information display;
- tactile-feeling controls;
- fast recognition in bright or difficult environments.

### Keep the presentation calm

High contrast should improve recognition rather than create visual noise.

Prefer:

- muted or warm neutral base surfaces;
- dark navy / charcoal rather than pure black where appropriate;
- saturated accent colors reserved for actions, status, warnings, and selections;
- generous whitespace around large controls;
- strong but restrained borders;
- minimal shadows and decorative texture;
- monospace selectively for measurements, IDs, coordinates, timestamps, and status;
- ordinary highly readable type for prose and form labels.

Avoid making every panel, border, label, and status indicator compete for attention.

### Shared component language, multiple profiles

Keep component geometry and interaction behavior consistent while allowing visual profiles to tune palette, scale, and contrast.

Potential profiles:

```text
Gather Standard
→ calmer desktop/web presentation

Gather Field
→ larger controls, stronger contrast, better daylight readability

Gather Night
→ genuinely low-luminance dark presentation
```

These should remain variations of one design system rather than independent themes with divergent component behavior.

### Design principle

> **Field instrument clarity + handheld tactility + desktop restraint.**

A second useful rule:

> **Personality should come from color, typography, borders, icons, illustration, motion, and small details — not from making familiar controls behave unexpectedly.**

The product should feel opinionated and recognizable without sacrificing ease of use or becoming visually exhausting during long field or desktop sessions.

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


## 13. Product terminology — use **Tool** instead of **Instrument**

**Decision:** prefer **Tool** as the user-facing name for the composed Gather abstraction previously called an Instrument.

`Tool` is intentionally broader and less domain-specific than `Instrument`, while still representing something more substantial than a single UI widget.

Examples:

```text
Guided Segmentation Tool
Blob Counter Tool
OCR Capture Tool
Image Quality Check Tool
```

Preferred product language:

```text
Tool Library
Built-in Tools
Project Tools
Create Tool
Customize Tool
Attach Tool to Form
Tool output
Tool package
```

The architectural vocabulary becomes:

```text
Components
→ reusable presentation primitives

Capabilities
→ reusable operations

Tools
→ composed interactive workflows that produce typed data/results

Forms
→ host ordinary questions and Tools
```

Avoid creating a separate formal `Widget` layer unless a concrete need emerges. Terms such as image annotator, mask editor, numeric keypad, etc. can remain Components even when they feel widget-like.

`Instrument` may still be used descriptively for particular scientific Tools, but it should not be the default product-level abstraction.

### Migration note

Existing implementation/docs may still contain names such as:

```text
Instrument Studio
Instrument Library
instrument.a2ui.json
.gather Instrument package
```

Do not perform a disruptive rename solely for terminology cleanup until the affected milestone is being revised. As M11 and publishing architecture are implemented, prefer the new language where practical:

```text
Gather Tool Composer
Tool Library
Tool definition
Tool package
```

File-format/internal names can remain stable if changing them would create needless compatibility churn.

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


## 15. Batch workflow matrix, Entity lifecycles, and Gather provenance

Batching and Entities should remain **orthogonal concepts**.

A Batch is a local Gather grouping/orchestration layer above ordinary ODK form instances. The form determines whether Entities are irrelevant, selected, created, or updated.

### Workflow matrix

| Entity behavior | One-off | Batch |
| --- | --- | --- |
| No Entity | Fill ordinary form | Repeated/grouped forms with shared Batch provenance |
| Use existing Entity | Pick/search Entity → fill form | Select/query Entity set → work through list/map/order |
| Create new Entity | Fill registration form → Entity created | Start empty → discover/create Entities as forms are completed |
| Existing + discover new | Pick existing or create | Planned Entity set + ability to add newly discovered Entities |

The first three are core cases. Mixed existing/new behavior should fall out of the same abstractions rather than require another workflow system.

### Known-Entity Batch

```text
Create Batch
→ choose form
→ choose/query Entity set
→ establish order
→ work through members
```

Navigation may be list, map, nearest-next, predefined order, or entity label. The Batch model should not care which presentation is used.

A member may contain:

```text
Batch member
├── entityRef
├── plannedOrder
├── status
└── instanceId?
```

### Discovery / registration Batch

A Batch may begin without predetermined Entity membership:

```text
Batch: New Saplings — Plot 7
0 collected

[ Add Observation ]
→ fill registration form
→ create provisional/new Entity
→ add member to Batch
→ continue
```

This is the same Batch abstraction with membership growing during work rather than being known beforehand.

Do not force users into a Batch merely because a form creates Entities; one-off Entity registration remains valid.

### Provisional local Entity identity — open design point

Offline create-and-immediately-reference workflows may require stable local identity before Central has created the authoritative Entity.

Investigate the cleanest ODK-compatible pattern for:

```text
local/provisional Entity identity
        ↓
registration instance
        ↓
later upload / Central Entity creation
        ↓
reconcile authoritative identity
```

This matters if a newly discovered Entity must be referenced again within the same offline Batch before synchronization.

Reuse ODK's existing Entity lifecycle semantics wherever possible before inventing a Gather-specific identity system.

### Batch operations remain orchestration

Batch-level Send/Delete/etc. should resolve into existing per-instance operations:

```text
select Batch
→ resolve eligible member instance IDs
→ existing Save / Send / Delete lifecycle
```

Do not introduce an atomic Batch submission protocol to Central.

Incomplete/planned members are not sendable until they have produced eligible instances.

---

## 16. Reserved `_gather` submission metadata envelope

**Decision direction:** Gather-authored forms should include one reserved hidden metadata node that carries small Gather-specific provenance through ordinary ODK submissions.

This avoids modifying Central or introducing a separate submission transport.

Conceptually, every Gather-oriented XLSForm template includes a reserved non-user-facing node such as:

```text
type       name
calculate  _gather
```

The exact XLSForm/XForms representation should be confirmed during implementation.

Gather populates the node before submission with compact JSON.

Initial example:

```json
{
  "version": 1,
  "batch": {
    "id": "7da3..."
  }
}
```

For an unbatched submission:

```json
{
  "version": 1
}
```

### Why one envelope

Prefer one reserved object over proliferating fields such as:

```text
_gather_batch_id
_gather_tool_revision
_gather_client_version
```

The envelope can evolve while the form contract remains stable.

Potential future metadata:

```json
{
  "version": 1,
  "batch": {
    "id": "7da3...",
    "name": "North Plot Survey"
  },
  "tool": {
    "id": "...",
    "revision": "..."
  },
  "client": {
    "version": "..."
  }
}
```

Keep this strictly for small provenance/identity metadata, not arbitrary application state.

### Requirements

- stable schema/versioning;
- stable UUIDs for Batch identity;
- names may be included for convenience but are not identity;
- researchers should never edit this node manually;
- Gather templates / XLSForm skills / publishing tooling should add it automatically;
- ordinary ODK clients and Central should be able to treat it as normal submitted form data;
- Gather-aware export/query tooling can later use it to reconstruct Batch provenance.

### Open implementation spike

Determine the cleanest way for the Gather XForms host/runtime to populate this reserved node before submission.

Avoid encoding dynamic JSON through awkward XLSForm expressions if the host can safely set the node value directly.

Architectural goal:

> **Every Gather-authored form carries one hidden `_gather` metadata node; Gather populates it before submission; Central receives it as ordinary form data.**

---


## 17. Full ODK / XLSForm type and control compatibility

A major roadmap item is to complete Gather's support for the full practical ODK/XLSForm form vocabulary.

Gather currently supports only a subset of the question/control types and presentation behaviors that researchers can author in an ODK-compatible XLSForm workbook.

### Interoperability goal

Gather should preserve a strong compatibility promise:

> **A standard ODK form should be usable in Gather without requiring Gather-specific rewrites. Gather extensions should be additive, not a replacement for normal ODK/XLSForm behavior.**

This supports both directions of interoperability:

```text
standard ODK/XLSForm authoring
        ↓
ODK Central
        ↓
Gather Mobile

and

Gather-extended XLSForm
        ↓
ODK Central
        ↓
Gather Mobile
```

Where Gather-specific extensions are absent, the form should behave as an ordinary ODK form.

### Compatibility work

Create and maintain an explicit coverage matrix against the ODK/XLSForm vocabulary, including where applicable:

```text
question / data types
select types
groups and repeats
media inputs
location / geometry inputs
date / time inputs
calculated / hidden values
constraints and relevance
appearances / widgets
read-only / metadata controls
Entity-related form behavior
other ODK-supported control semantics
```

The exact matrix should be derived from current ODK/XLSForm documentation rather than maintained from memory.

For each supported type/control, track:

```text
parsing / engine support
Gather renderer support
editing / interaction behavior
validation behavior
offline behavior
submission fidelity
mobile tests
parity notes / known limitations
```

### Rendering architecture

Prefer implementing reusable standard form controls through the same shared Gather Components/theme system used elsewhere where that does not distort ODK semantics.

However:

- ODK/XLSForm behavior is the compatibility contract;
- Gather styling must not change the meaning or expected behavior of standard form controls;
- specialized Gather Tools remain a separate additive layer.

### Unsupported forms

Until parity is complete:

- detect unsupported types/appearances explicitly;
- fail or degrade clearly rather than silently dropping data or controls;
- surface actionable compatibility diagnostics during form sync/load where practical.

### Validation target

Eventually maintain a representative compatibility fixture/test suite containing forms that exercise the supported ODK/XLSForm catalog.

This should become a regression gate for Gather Mobile releases.

### Roadmap principle

This is core platform work, not optional polish.

The value proposition depends on Gather being able to sit cleanly on top of ODK Central while researchers continue using the established ODK/XLSForm ecosystem.

---


## 18. Camera and media capture as a first-class Gather subsystem

Camera/media capture is a core Gather product capability and should be designed/documented as such rather than treated as a one-off component used by a few Tools.

React Native VisionCamera remains the primary native implementation layer, but Gather should expose a smaller, stable, semantic camera contract that fits:

```text
Gather Components
Gather Capabilities
A2UI Tools
standard ODK/XForms media inputs
web/Composer preview
```

Do **not** mirror the VisionCamera API directly into A2UI or Tool definitions.

### Layering

```text
A2UI Tool / XForms media field
        ↓
declarative Gather camera contract
        ↓
CaptureView
        ↓
platform camera adapter
   ↙                    ↘
VisionCamera          browser camera
Android / iOS        getUserMedia
        ↓
camera/media capabilities
        ↓
serializable ImageAsset / VideoAsset / media collection
```

Native VisionCamera Frames, CameraControllers, outputs, device objects, and other runtime/native objects must remain below public Gather contracts.

### `CaptureView`

`CaptureView` is the shared presentation layer for camera acquisition.

It should follow familiar Android/iOS camera interaction conventions while retaining Gather's own visual language:

- large obvious shutter;
- predictable flash/torch controls;
- front/rear camera switching when allowed;
- pinch/native zoom behavior;
- tap-to-focus when allowed;
- clear recording/capture state;
- safe-area/orientation handling;
- strong daylight readability and large touch targets;
- familiar thumbnail/gallery affordances for multi-capture.

The goal is native-camera familiarity, not pixel-for-pixel imitation of either platform's stock camera app.

### Declarative camera configuration

Tool/form authors should be able to enable, disable, or constrain camera functionality declaratively.

The Gather schema should describe **intent**, not raw hardware implementation.

Illustrative shape only:

```json
{
  "mode": "photo",
  "facing": "back",
  "allowCameraSwitch": true,
  "controls": {
    "flash": true,
    "torch": false,
    "zoom": true,
    "tapToFocus": true,
    "exposure": false,
    "lowLightBoost": "auto"
  },
  "capture": {
    "multiple": true,
    "minItems": 1,
    "maxItems": 12,
    "gallery": true
  },
  "quality": {
    "intent": "high"
  }
}
```

Potential declarative areas include:

```text
photo / video mode
single vs multi-capture
front/back preference
whether camera switching is exposed
flash modes / torch availability
zoom controls / gestures
tap-to-focus
exposure adjustment
low-light behavior
photo/video quality intent
HDR where appropriate
video stabilization
video audio
capture count requirements
gallery/review behavior
optional framing/grid/guide overlays
```

Prefer semantic presets such as `quality: high` or `stabilization: preferred` over hard-coding device-specific formats unless a workflow genuinely requires exact capture characteristics.

### Runtime capability negotiation

Camera hardware varies substantially across devices.

Gather should probe the active device and resolve declarative intent against actual hardware support.

```text
Tool requests camera behavior
        ↓
Gather camera policy/config
        ↓
device capability probe
        ↓
best supported configuration
        ↓
CaptureView exposes only valid controls
```

Unsupported controls should be hidden, disabled with explanation, or gracefully degraded according to the contract. They should not cause brittle camera failures.

### Intrinsic camera controls vs Tool workflow

Keep camera-native interactions inside `CaptureView`:

```text
shutter
flash / torch
camera switch
zoom
focus
exposure
record start/stop
gallery thumbnail
```

Keep broader workflow actions in the Tool where practical:

```text
Continue
Accept
Run model
Retake all
Submit
```

### Multi-photo / media collection mode

Multi-photo capture should be a first-class mode.

Expected interaction:

```text
camera remains active
→ capture photo
→ latest-image thumbnail appears
→ count badge updates
→ continue capturing
→ tap thumbnail to open capture gallery
```

The gallery should support at least:

```text
review full image
remove / retake an item
return to camera
show current count / min / max requirement
```

The output should be a typed serializable collection of durable media assets, never native VisionCamera objects.

### Capability vocabulary

Keep public camera Capabilities semantic and deliberately small.

Likely operations include:

```text
camera.capturePhoto
camera.recordVideo
```

Do **not** automatically turn every camera-controller operation into a global Capability. Zoom, focus, exposure, lens switching, etc. may remain internal interactive behavior unless another Tool genuinely needs to invoke them semantically.

Advanced camera-derived operations can be separate capabilities where useful:

```text
code.scan
depth.capture / depth.stream
frame processing
location-aware capture
```

### Advanced camera outputs

Preserve seams for richer camera features such as:

```text
photo
video
frame streaming
depth
preview
barcode scanning
multi-camera/device selection
HDR / stabilization
device-specific camera features
```

Do not clutter the default Camera UI with all of them. Prefer simple defaults + capability-aware opt-in controls + specialized Tools.

### Browser / Tool Composer parity

The same declarative camera contract should drive browser preview where practical:

```text
native → VisionCamera
web    → getUserMedia / browser APIs
unsupported browser feature → graceful degradation / fixture fallback
```

The Gather Tool Composer should eventually delegate camera/microphone/geolocation iframe permissions so authors can preview real acquisition workflows in-browser.

### Camera quality and data quality

Camera capture is also the entry point for future Gather data-quality features:

```text
image quality assessment
blur / exposure checks
OCR
barcode/label scanning
promptable segmentation
object detection
depth / geometry
LiDAR/device sensing
frame-processing overlays
```

Design `CaptureView` and camera capabilities so overlays and live/near-live analysis can be layered onto the preview without making the camera component model-specific.

### Design principles

> **Gather owns a stable, declarative field-capture experience; VisionCamera owns the native camera machinery.**

> **Expose camera intent and useful field interactions, not the upstream library's entire API surface.**

Camera should be treated as one of Gather's foundational reusable subsystems, with compatibility tests across representative Android/iOS devices and browser preview paths.

---


## 19. SurveyCTO as a primary product reference / requirements mine

SurveyCTO is an especially useful reference because it represents a mature product built on the ODK/XLSForm ecosystem that has spent many years solving operational problems for real field-data programs.

Do **not** treat SurveyCTO as a feature-parity target.

Treat it as competitive archaeology and a source of validated requirements, edge cases, and workflow ideas. Areas worth studying include:

```text
case / entity-style workflows
offline case creation and update
offline dataset publishing
offline device-to-device handoff
remote/default device configuration
CATI / calling workflows
data-quality review and correction
integrations / OData conveniences
field plug-ins
security / administration
team / operational workflows
```

SurveyCTO's field plug-in catalog is particularly valuable as a checklist of the kinds of extensibility real field teams eventually request.

For each relevant SurveyCTO feature, ask:

```text
Is this already covered by ODK upstream?
Is it relevant to Gather's users?
Can it be expressed with existing Components + Capabilities + Tools?
Is a new Gather primitive actually required?
```

Avoid copying implementation patterns blindly. SurveyCTO's web plug-in architecture and Gather's A2UI/native-capability architecture make different tradeoffs.

### Competitive lesson

> **ODK plus an opinionated product layer can become durable, widely used, and commercially valuable.**

Gather should learn aggressively from that history without trying to reproduce a decade-plus product surface.

---

## 20. Gather positioning — ODK as the drivetrain, Gather as programmable field computing

A useful product metaphor:

> **Keep the proven ODK drivetrain. Reinvent the cockpit.**

ODK/XLSForm/Central provide the standards-based data backbone. Gather's distinctive platform work sits above that backbone:

```text
ODK / XLSForm / Central
        ↓
Gather native mobile runtime
        ↓
camera · sensors · location · depth
OpenCV · ONNX Runtime
        ↓
stable Components + Capabilities
        ↓
declarative Tools
        ↓
AI-assisted Tool Composer + live preview
```

The key differentiation is **not simply that Gather can run machine-learning models on a phone**. The stronger thesis is:

> **Gather turns native device and machine-learning capabilities into composable field-research primitives.**

A conventional plug-in architecture often says:

> Here is an extension point. Write some software to put in it.

Gather should instead expose a bounded, typed vocabulary of things the device/runtime already knows how to do:

```text
capture images/video
read device sensors
run ONNX models
perform OpenCV operations
segment / detect / classify
measure geometry
review and correct outputs
produce typed research data
```

A Tool author should be able to compose these capabilities without reimplementing camera plumbing, native bindings, model execution, image overlays, persistence contracts, or form integration.

This makes the structured A2UI architecture more than a widget plug-in format. It gives both humans and authoring agents a constrained platform vocabulary:

```text
These are the Components.
These are the Actions.
These are the Capabilities.
These are their typed inputs and outputs.
These models are available.
These sensors are available.
Here is the current Tool.
```

That constraint is a feature: AI assistance becomes **assisted composition over a known platform**, rather than arbitrary code generation.

A useful competitive shorthand:

> **SurveyCTO makes ODK into a highly polished survey platform. Gather makes ODK into a programmable field-computing platform.**

"Programmable" should not imply that ordinary users must write code. A major part of the product bet is that structured composition + agents + live preview can make sophisticated field workflows accessible without traditional mobile/ML application development.

### Trust and product personality

Gather still needs the baseline qualities serious research organizations expect:

```text
stable
safe
predictable
recoverable
compatible
maintainable
```

Product rule:

> **Boring where trust matters; exciting where capability matters.**

Keep sync, persistence, submission state, provenance, compatibility, recovery, and permissions conservative and explicit. Let camera workflows, Tools, model-assisted collection, spatial workflows, and specialized field interactions carry more personality and delight.

Gather should aim to feel **serious and pleasurable**, not enterprise-boring or toy-like.

---

## 21. Tool authoring model — Use → Compose → Engineer

Support different levels of technical involvement without forcing every user to understand A2UI, ONNX, OpenCV, or mobile internals.

### Level 1 — Use

Most users should be able to select an existing Tool:

```text
Tool Catalog
→ choose Tool
→ attach/use in Form
```

### Level 2 — Compose

More advanced users should be able to create or customize Tools in Gather Tool Composer:

```text
natural-language agent assistance
+ available Components / Capabilities
+ live preview
+ model selection
→ composed Tool
```

The author should not need to learn the A2UI specification for ordinary Tool creation.

### Level 3 — Engineer

Experts should retain access to:

```text
A2UI definition
schemas
model contracts
pre/postprocessing
Capability requirements
dependency locks
provenance
```

The system should remain inspectable rather than becoming a black box.

### Authoring principle

> **Don't hide the platform; hide the ceremony.**

Preserve power and inspectability while removing unnecessary syntax, setup, and implementation burden from common workflows.

---

## 22. Product language principle — Plain actions, precise science

Gather serves researchers and field technicians, so terminology should be approachable without erasing scientifically meaningful concepts.

Do not over-consumerize technical workflows.

Use three layers of language:

### Task name

Describe the goal clearly:

```text
Guided Segmentation
Object Counter
Shape Measurement
Label Reader
Photo Quality Check
```

### Interaction language

Use plain action-oriented instructions:

```text
Select the specimen
Adjust the mask
Remove this region
Count these objects
Accept
```

### Method / output language

Keep scientific and technical objects explicit where they matter:

```text
segmentation mask
binary mask
connected component
contour
centroid
area
perimeter
morphology
classification confidence
model revision
```

Researchers should be able to inspect what method ran, what output was produced, and what provenance was recorded. A mask is not merely an implementation detail if it is itself a downstream scientific artifact.

Tool authors should be free to use more technical visible terminology when the project audience expects it.

### Design principle

> **Plain actions, precise science.**

Simplify the interaction without hiding the scientific object, method, output, or provenance.

---

## 23. ODK/Gather XLSForm agent skills

Form authoring remains one of the steepest learning curves in ODK. Prefer extending existing agent ecosystems and spreadsheet environments rather than building a new spreadsheet editor unless a real limitation requires one.

### Existing ODK-community precedents

Two especially relevant projects were surfaced together on the ODK Forum:

1. **ODK Form Skills** — a broader repository for agentic ODK workflows, including AI-driven XLSForm development/debugging, ODK Central integration, and data analysis.
   - Forum: https://forum.getodk.org/t/an-odk-form-skills-repository-for-agentic-ai-tools/57995
   - Repository: https://github.com/joybindroo/ODK-Form-Skills

2. **SwissTPH XLSForm Validation Skills** — a narrower validation/QA skill for existing XLSForms. It wraps `pyxform`, returns plain-English cell-specific feedback, and adds checks for silent-failure patterns such as repeat-scope references, choice-list mismatches, and settings-sheet gaps.
   - Repository: https://github.com/SwissTPH/XLSForm-Validation-Skills

The two projects are complementary: authoring + domain assistance on one side, deterministic validation/QA on the other.

Gather should build on and interoperate with these efforts where practical instead of creating an unrelated parallel ecosystem.

### Gather-specific knowledge layer

The Gather extension should teach an agent about:

```text
ODK / XLSForm conventions
Entities
Gather XLSForm sugar
Gather Tool Catalog
Tool outputs / result schemas
recommended Gather workflow patterns
Gather-specific validation rules
```

Prefer a Gather extension/layer over maintaining separate competing "ODK" and "Gather" skill universes.

### Meet users in existing spreadsheet environments

Likely environments include:

```text
Google Sheets + Gemini
Excel / Microsoft 365 + Copilot
Claude / other capable agent environments
```

If the host agent can already edit spreadsheets, Gather does **not** need to build its own spreadsheet-mutation API merely to support form authoring.

The portable asset Gather should own is primarily **domain knowledge, instructions, examples, Tool metadata, and validation guidance**.

Conceptually:

```text
host agent
        ↓
ODK + Gather XLSForm skill
        ↓
host's existing spreadsheet abilities
        ↓
XLSForm workbook
```

### Validation remains deterministic

The LLM is not the authority on form correctness.

Use:

```text
agent edits / proposes
        ↓
pyxform / ODK validation
        ↓
Gather-specific QA checks
        ↓
agent explains and fixes real errors
```

Where possible, derive agent context from canonical ODK/Gather documentation, schemas, Tool metadata, and contracts rather than maintaining a large duplicated prompt that will drift.

### Portability

Maintain one canonical source of ODK/Gather skill knowledge where practical, then adapt/export it for different agent ecosystems.

Potential future packaging:

```text
Gemini
Copilot
Claude skills
MCP-aware environments
other agent formats
```

A standalone Gather Form Builder should remain optional and evidence-driven rather than assumed.

---

## Guiding principle

Keep Gather-specific abstractions focused on capabilities and behavior that ODK/A2UI do not already provide.

Prefer:

```text
Basic Catalog composition
+ small Gather primitive vocabulary
+ shared Gather components
+ reusable capabilities
```

over Instrument-specific UI implementations or duplicated platform code.
