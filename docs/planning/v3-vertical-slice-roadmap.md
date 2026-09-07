# Gather V3 — End-to-End Vertical Slice Demo Roadmap

## Overview

The next phase of Gather should be organized around a single end-to-end **vertical slice** that proves the product vision without requiring us to finish the entire platform.

The goal is not to support every ODK field type, every possible Gather Component, every model runtime, every batch workflow, or every downstream analysis tool. The goal is to prove that the architecture compounds:

> **A researcher can start with an existing field map, use an agent-assisted workflow to create a valid ODK study and Entity model, add a custom model-assisted field interaction without writing code, deploy it through ordinary ODK Central, collect a real batch of observations in Gather, and immediately use the resulting data in CSV, Python/Jupyter, QGIS, and Power BI.**

The demo should feel boring in the best possible way. The sophisticated machinery—XForms, A2UI, ONNX, OpenCV, media ownership, model execution, provenance, synchronization—should disappear behind a workflow that feels obvious to the researcher and technician.

The product philosophy underneath this roadmap is:

- **Reuse upstream structure wherever it already expresses the truth.**
- **Do not invent a new contract when a standard one already exists.**
- **Keep Gather-specific infrastructure as small as possible.**
- **Make powerful things easier to assemble, not harder to own.**
- **Push complexity toward the machine and preserve user intent at the interface.**
- **Keep downstream data boring, interoperable, and user-owned.**
- **Treat every important Gather primitive as a stable, typed, machine-readable contract that an agent can discover and compose.**

A2UI is currently valuable because it gives us a shortcut to a polished authoring experience: a catalog, built-in agent, live web preview, and a deployable structured artifact. It should remain a means to the vertical slice, not an architectural dependency that Gather cannot outgrow.

---

# Demo Story

A useful target scenario is a small plant or plot-based field study.

1. A researcher begins with an existing field map containing plots, plants, transects, or other persistent study units.
2. In Excel / Microsoft 365, an agent helps transform that source data into:
   - an ODK XLSForm;
   - an Entity model;
   - map/entity selection;
   - the study's observation structure;
   - a slot for one custom Gather interaction.
3. In the Gather Composer, the researcher describes a model-assisted interaction such as:
   - capture a flower image;
   - segment the flower;
   - review or correct the mask;
   - calculate area;
   - optionally count or classify a feature;
   - save the image, measurement, and notes.
4. The Composer builds the interaction from trusted Gather Components, Capabilities, and Models and shows a live preview.
5. The form and composition resources are published through ordinary ODK Central.
6. A field technician opens Gather and starts a field run / batch:
   - sees the next target;
   - completes the observation;
   - advances to the next target;
   - can stop and resume later;
   - sends completed work through normal ODK submission semantics.
7. After the field run, the same data is immediately demonstrated in:
   - CSV;
   - a Jupyter notebook using pyODK;
   - QGIS for spatial analysis/visualization;
   - Power BI through OData for live reporting.

The demo should communicate a simple promise:

> **From field map to field instrument to analysis—without building a new data platform.**

---

# Current Foundation

A substantial portion of the difficult plumbing is already in place.

### ODK / XForms foundation

- Gather uses ordinary ODK Central and XForms/XLSForm.
- Custom Gather compositions bind into normal XForms structures rather than a parallel data model.
- Direct body-backed children of a composition group are candidate output destinations.
- The composition's declared outputs are intersected with those candidates, so unrelated hand-fillable child questions remain untouched.
- Name matching is the default; explicit `gather:output` metadata is only an escape hatch.
- XForms remains authoritative for storage structure, destination type, media projection, and live requiredness.
- Effective requiredness is the producer contract OR the live XForms requirement.
- Type validation is based on projectability rather than exact string equality.
- The old binding manifest has been deleted.

### Composition execution

- A2UI Components and Functions execute through the real runtime.
- Function results can be written back into composition state.
- Flow/state provides authored multi-step interaction structure.
- Host functions cover Gather-specific lifecycle operations such as asset persistence and composition completion.
- Handler-free form-resource compositions work without a composition-specific app registry entry.

### Media / provenance lifecycle

- Working assets can be persisted as durable Gather assets.
- Media outputs are promoted into ordinary ODK `instance_media`.
- XForms stores the submitted attachment filename.
- Disposable working copies are released only after the durable submission copy and XML commit succeed.
- Draft save → exit → reopen → resume has been verified on-device.
- Existing pre-rewrite drafts remain compatible because XForms is the authoritative representation.
- Receipts and asset identity have been verified on-device.

### Shared UI / renderer foundation

- Gather instrument UI is implemented once in React Native and rendered on web through React Native Web.
- Mobile and web consume the same Component implementations.
- The current web renderer is a thin Composer preview host and should remain thin.
- Future web collection remains possible without requiring a second implementation of Gather's primitives.

---

# Milestone 1 — Close the Remaining Packaging Gate

## User outcome

A form authored for the demo can carry its custom Gather composition artifact through a stock ODK Central form version and arrive on the device through the normal form-resource path.

## Work

Validate the existing `gather_resources` approach against a real Central draft:

1. upload the prepared gate form;
2. confirm Central recognizes the opaque composition artifact as an expected attachment;
3. upload the artifact;
4. download it unchanged through the ordinary resource API;
5. verify the device receives it through normal form synchronization.

Use a checksum to verify that the opaque artifact is not transformed.

## Architectural decisions

- This is only a **resource-distribution problem**.
- Do not reintroduce a binding manifest.
- Do not make the composition artifact pretend to be XML or CSV.
- Do not change the engine to parse or ignore fake secondary-instance formats.
- Keep the compatibility shim isolated from the conceptual Gather artifact model.
- If stock Central eventually supports a clean generic opaque-resource declaration, replace the shim.

## Gate

> A composition unknown to the installed Gather binary travels with an ordinary ODK form version and is available to the Gather runtime without custom Central behavior.

---

# Milestone 2 — Model System and One Real Model-Backed Capability

## User outcome

A researcher can select or use a real model-backed Gather interaction without knowing anything about ONNX Runtime, model files, execution providers, or platform differences.

For the vertical slice, one production-quality segmentation path is enough.

## Work

Reassess and implement the smallest coherent `gather-models` layer.

It should likely own:

- `ModelRef`;
- model identity and revision;
- model metadata;
- integrity/hash verification;
- compatibility requirements;
- local resolution;
- packaged/bundled model dependencies.

It should **not** become the inference framework.

The capability layer remains responsible for semantic operations such as:

```text
image.segment
image.classify
image.detect
measure.area
```

Execution backends consume resolved models.

Target architecture:

```text
composition / plugin
      ↓
    ModelRef
      ↓
 gather-models
      ↓
verified local artifact
      ↓
gather-capabilities
      ↓
native/web execution backend
```

For mobile, preserve native execution where it materially improves performance:

- iOS → native ONNX Runtime / CoreML where appropriate;
- Android → native ONNX Runtime / NNAPI/XNNPACK where appropriate;
- native OpenCV for heavy CV operations.

For web / Composer preview:

- ONNX Runtime Web;
- OpenCV.js / WASM where practical;
- deterministic preview behavior remains acceptable where real execution is not yet worth the cost.

## Architectural decisions

- Model identity is separate from capability semantics.
- Public contracts contain no native tensors, OpenCV Mats, frames, sessions, or runtime-specific objects.
- Components and authored artifacts consume typed serializable contracts.
- Keep heavy inference outside a WebView when the native host can execute it more efficiently.
- A future plugin should call Gather Capabilities through a host SDK rather than bundling its own inference stack by default.

## Gate

> The same semantic `image.segment` operation can be invoked from an authored interaction while the user remains unaware of model/runtime/platform implementation details.

---

# Milestone 3 — Gather Composer Wrapper for the Vertical Slice

## User outcome

A non-technical researcher can attach a custom Gather interaction to a form, describe what they want conversationally, see a live preview, and deploy it without installing packages or writing code.

## Work

Build only the Gather-specific wrapper needed around the existing A2UI Composer.

The wrapper should support:

1. selecting/opening a target form;
2. discovering `gather-composition` groups;
3. selecting the group/slot to author;
4. exposing the Gather Catalog:
   - Components;
   - Functions / Capabilities;
   - available Models;
5. giving the Composer agent enough Gather-specific documentation to use those primitives correctly;
6. validating the composition's declared outputs against the selected XForms group;
7. previewing the interaction through the existing web renderer;
8. attaching the resulting reusable composition artifact to the form;
9. preparing/publishing the form and resources to Central.

The first target interaction should be Segment & Measure or an equally concrete plant-science workflow.

## Architectural decisions

- A2UI is a **near-term authoring accelerator**, not a permanent dependency assumption.
- The durable assets are:
  - Components;
  - Capabilities;
  - Models;
  - typed contracts;
  - output projection;
  - assets/media;
  - provenance;
  - host services.
- Do not build a Gather workflow DSL beside A2UI.
- Do not expand A2UI to solve arbitrary programmability.
- If an interaction does not fit naturally into structured composition, that is evidence for the future plugin escape hatch rather than evidence that A2UI needs another custom language feature.
- Keep the renderer thin and keep substantive behavior in shared packages.

## Gate

> A researcher can describe a custom scientific interaction, inspect it in a live preview, attach it to an ODK form, and deploy it without developer tooling.

---

# Milestone 4 — Agent-Assisted XLSForm + Field-Map Workflow

## User outcome

A researcher can begin with an existing field map or study dataset instead of a blank spreadsheet and use an agent to produce the ODK structures needed for collection.

This is one of the most important usability improvements in the demo.

## Target workflow

Input might be:

- GeoJSON;
- CSV with stable IDs and coordinates;
- an existing plot/transect/plant map;
- an existing study-unit table.

The researcher should be able to say something like:

> “These polygons are my experimental plots. Each plot has a treatment and block. We need technicians to visit every plot, photograph one flower, measure it, and record notes.”

The agent should help produce:

- persistent Entity design;
- stable IDs;
- Entity properties;
- geometry;
- observation form;
- map/entity selection;
- repeat/visit structure where appropriate;
- Gather composition slot;
- standard Gather field conventions.

## Scope of the agent skill

The Gather-aware ODK skill should be good at four things:

### 1. Interpret source study data

Inspect:

- geometry;
- IDs;
- hierarchy;
- treatments;
- assignment/group fields;
- study-unit semantics.

Ask only genuinely ambiguous study-design questions.

### 2. Propose the ODK data model

Distinguish:

```text
persistent study object
→ Entity

observation / visit
→ submission
```

Example:

```text
Plot 17
= persistent Entity

September observation of Plot 17
= submission
```

### 3. Author ordinary XLSForm

Prefer standard ODK structures:

- groups;
- repeats;
- Entity Lists;
- external datasets;
- map selection;
- normal typed questions;
- Gather appearance/namespace conventions only where needed.

### 4. Validate

Run normal ODK/XLSForm validation plus Gather-specific checks:

- Entity references;
- composition slots;
- body-backed output destinations;
- type projectability;
- resource references;
- known silent-failure patterns.

## Architectural decisions

- The spreadsheet remains ordinary XLSForm wherever possible.
- Gather-specific authoring sugar may exist later, but the canonical publish/runtime representation should remain normal ODK structures.
- The agent should not secretly become another A2UI Composer.
- Excel / Microsoft 365 is the form- and study-model authoring environment.
- Gather Composer is the custom interaction authoring environment.
- Reuse existing ODK skills/validators where possible rather than creating a parallel XLSForm ecosystem.

## Gate

> Starting from a real field map and a short description of the study, the researcher can reach a valid deployable XLSForm and Entity workflow with minimal manual ODK expertise.

---

# Milestone 5 — Batch / Field-Run Workflow

## User outcome

A technician can work through a real set of study targets without repeatedly navigating the underlying ODK object hierarchy.

The product should reflect the technician's intent:

> “I need to visit these 30 plots today.”

rather than exposing:

```text
Project
→ Form
→ Entity List
→ Entity
→ New Instance
→ Save
→ Back
→ repeat
```

## Target UX

A simple field-run surface:

```text
Prairie Transect — Sept 3
18 / 30 complete

Current: Plot 019
Next:    Plot 020

[ Continue ]
```

Desired behavior:

- planned targets;
- completed targets;
- unfinished targets;
- automatic next-target progression;
- stop and resume later;
- visibility into what remains;
- optional browse/list/map access;
- independent underlying ODK instances;
- ordinary retryable submissions.

## Architectural decisions

- A Batch / Field Run is a **Gather-local orchestration layer above ordinary ODK instances**.
- It is not a new submission protocol.
- Every observation remains independently saveable and submit-able.
- “Send batch” may be one user gesture that fans out to normal submission operations.
- Do not create atomic multi-submission semantics unless a real requirement emerges.
- Revisit any old `_gather` submission-metadata convention before reusing it; do not preserve historical architecture by inertia.

## Gate

> A technician can begin a field run, work through a set of mapped Entities, stop, resume, and finish the run without manually reconstructing the form/entity workflow for every observation.

---

# Milestone 6 — Mobile Product Polish

## User outcome

The demo feels like a product rather than an engineering harness.

This should be a focused cleanup pass, not a design-system rewrite.

## Work

Polish the surfaces that appear in the golden workflow:

- project / field-run entry;
- My Work / batch overview;
- forms;
- map/entity selection;
- composition launch;
- capture;
- model processing;
- review;
- Accept / Save;
- next-target transition;
- drafts / resume;
- sync/send state;
- loading / empty / error states;
- typography, spacing, hierarchy, and navigation.

## Design principles

### Design around verbs, not implementation nouns

Prefer:

```text
Continue field run
Visit next plot
Review unfinished observations
Send completed work
```

over exposing architecture terminology unnecessarily.

### Do not let implementation complexity leak into the UI

The user should not need to understand:

- XForms;
- instance lifecycle;
- model stores;
- asset ledgers;
- capability runtimes;
- composition IDs;
- attachment projection.

### Give simplicity an explicit budget

For every demo screen, ask:

- What can disappear?
- What can be automatic?
- What decision is the user being forced to make?
- Does the user actually need to know this internal concept exists?

## Gate

> A new technician can complete the golden workflow from the visible UI without needing an explanation of Gather's internal architecture.

---

# Milestone 7 — Real Field Run

## User outcome

The vertical slice is exercised with genuine observations rather than fixtures.

## Work

Take the demo study into the field and collect enough real observations to expose realistic behavior.

Target roughly 20–50 observations, depending on the study.

Exercise:

- map/entity navigation;
- batch progression;
- image capture;
- model-backed capability;
- review/edit step;
- media projection;
- draft/resume;
- interrupted collection;
- sync;
- submission retries if encountered;
- final completion state.

Record:

- technician friction;
- unexpected navigation;
- places where intent is lost;
- model latency;
- battery/thermal behavior;
- camera ergonomics;
- offline behavior;
- confusing terminology;
- failure states.

## Architectural principle

Real field use outranks speculative framework work.

After this milestone, the next roadmap should be driven heavily by observed field friction rather than by hypothetical completeness.

## Gate

> Gather successfully supports a real field session from start to finish and produces ordinary ODK submissions with images, measurements, Entity relationships, and provenance intact.

---

# Milestone 8 — Downstream Data / Interoperability Demo

## User outcome

Immediately after collection, the researcher can use the data in the tools they already know.

Gather should not need to build its own analytics platform to demonstrate value.

The same Central data should be shown through four deliberately simple paths.

## 1. CSV — “Just give me my data”

Demonstrate:

- standard Central export;
- ordinary rows/columns;
- stable IDs;
- collected measurements;
- media references;
- Entity linkage.

The point is not a fancy export interface.

The point is:

> **The data is boring, portable, and yours.**

## 2. Jupyter + pyODK — “I want to analyze it”

Provide a small reproducible notebook that:

- connects to the demo Central project;
- reads the collected observations;
- joins useful Entity properties;
- computes one or two simple summaries;
- optionally retrieves selected media;
- produces one scientifically relevant plot/table.

Do not build a Gather-specific notebook framework.

## 3. QGIS — “Where is it happening?”

Demonstrate:

- study plots / plants / Entities on a map;
- collected observations;
- one Gather-produced measurement used for symbology;
- visited vs. remaining or another simple status visualization;
- click a feature and inspect the associated observation;
- associated image if practical.

This closes the spatial loop:

```text
existing field map
→ study design
→ field collection
→ collected data back on the map
```

## 4. Power BI / OData — “What is happening operationally?”

Build one simple dashboard page:

- observations completed;
- completion/coverage;
- one measured trait;
- treatment/site breakdown or similar;
- refresh to show newly synchronized submissions.

The selling point is the connection, not dashboard complexity.

## Architectural decisions

- Do not build Gather-native analytics for this demo.
- Use ODK's existing downstream interfaces.
- Treat interoperability as a first-class product feature.
- The same authoritative ODK data should serve GIS users, scientists, data managers, and program managers.

## Gate

> Within minutes of sync, the same field observations are visibly usable as CSV, Python data, a GIS layer, and a live BI feed.

---

# Milestone 9 — Demo Packaging and Narrative

## User outcome

A new viewer can understand the product in one coherent end-to-end story.

## Demo sequence

### 1. Start with the researcher's existing world

Open an existing field map / study dataset.

### 2. Author the study

Use Excel + the Gather-aware ODK agent skill to create or refine:

- Entities;
- geometry;
- form structure;
- observation workflow;
- Gather composition slot.

### 3. Create the custom instrument

Open Gather Composer.

Describe the desired scientific interaction conversationally.

Show:

- available Components;
- Capabilities;
- Model;
- agent-generated composition;
- live preview;
- output validation.

### 4. Publish

Publish the ordinary ODK form and attached Gather resources to Central.

### 5. Collect

On the mobile device:

- start the field run;
- visit several mapped targets;
- capture;
- run on-device segmentation;
- review;
- measure;
- accept;
- advance automatically.

### 6. Sync

Send the resulting ordinary ODK submissions.

### 7. Use the data

Show:

- CSV;
- Jupyter;
- QGIS;
- Power BI.

## Core pitch

> **Gather lets researchers create and deploy their own specialized field instruments without becoming software developers.**

Supporting ideas:

> **Researchers work in terms of cameras, segmentation, measurements, maps, and observations. Gather handles ONNX, OpenCV, native acceleration, XForms, media, and sync underneath.**

> **Every important Gather primitive has a stable, typed, machine-readable contract that an agent can discover and compose.**

> **Gather adds intelligence and flexibility upstream while preserving boring, interoperable ODK data downstream.**

> **From field map to field instrument to analysis—without building a new data platform.**

---

# Parallel Research Track — Sandboxed Gather Plugins

This is strategically important, but it should **not block the vertical slice**.

SurveyCTO's field plug-ins suggest a powerful alternative or complement to A2UI:

```text
sandboxed web application
→ HTML / CSS / JavaScript / React
→ shared Gather web Components
→ typed Gather SDK
→ native host Capabilities / Models
→ same XForms output binding
```

A future Gather plugin could potentially:

- run inside a WebView on mobile;
- run directly in the Composer/browser for preview;
- use existing React Native Web Gather Components;
- call native Gather Capabilities through a narrow bridge;
- use native ONNX/CoreML/NNAPI and OpenCV rather than performing heavy inference inside the WebView;
- return the same declared typed outputs used by A2UI compositions.

This could eventually make A2UI optional or reduce it to a structured authoring format.

## Research question

> **Does A2UI uniquely earn the complexity of a second runtime once a sandboxed web-plugin architecture exists?**

Do not answer this philosophically. Build a small comparative spike after or alongside the vertical slice.

Recreate the same model-assisted interaction as a plugin and compare:

- framework code;
- artifact complexity;
- agent authoring quality;
- live preview;
- iOS/Android behavior;
- security;
- model/capability reuse;
- native acceleration;
- versioning;
- provenance;
- maintainability.

## Current strategic stance

- Keep using A2UI because it accelerates the demo.
- Freeze unnecessary A2UI-specific infrastructure.
- Keep all new Components, Capabilities, Models, media contracts, and host services A2UI-independent.
- Do not let Gather become architecturally dependent on A2UI implementation details.
- Preserve the deeper North Star even if the runtime changes:

> **Every important Gather primitive should have a stable, typed, machine-readable contract that an agent can discover and compose.**

---

# Explicitly Out of Scope for the Vertical Slice

The demo does **not** require:

- support for every ODK question type;
- every Gather Component envisioned for the platform;
- a large model catalog;
- perfect parity between native and web inference;
- arbitrary workflow scripting;
- a generalized sequencing DSL;
- a complete plugin system;
- a Gather-native analytics platform;
- a full GIS product;
- a fully mature web field-collection client;
- perfect offline PWA behavior;
- a public marketplace;
- a generalized model registry service;
- broad Central customization;
- perfect UI throughout the entire app.

Build only enough at each layer to prove the end-to-end architecture.

---

# Definition of Done

The vertical slice is complete when we can demonstrate, in one continuous workflow:

```text
EXISTING FIELD MAP
        ↓
Excel / Microsoft 365
+ Gather-aware ODK agent skill
        ↓
ODK XLSForm + Entities
        ↓
Gather Composer
+ Components
+ Capabilities
+ real Model
        ↓
live preview
        ↓
ordinary ODK Central
        ↓
Gather Mobile
+ field-run / batch workflow
        ↓
real on-device model-assisted observations
        ↓
ordinary ODK submissions
        ↓
┌──────────┬───────────┬──────────┬───────────┐
│ CSV      │ Jupyter   │ QGIS     │ Power BI  │
│ portable │ science   │ spatial  │ reporting │
└──────────┴───────────┴──────────┴───────────┘
```

And the researcher never has to understand the machinery that makes it possible.

> **Powerful underneath. Boring at the boundaries. Delightful where the user touches it.**
