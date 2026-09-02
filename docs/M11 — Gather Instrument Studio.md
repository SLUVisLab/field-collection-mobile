# M11 — Gather Tool Composer

## Goal

NOTE: we have since changed naming conventions from "gateher instrument studio" to "Gather Tool Composer" however, some references in this document may still use the older "instrument" language.

Extend the upstream A2UI Composer into a Gather-focused **Tool Composer** for authoring, testing, validating, and packaging Instruments and their Model dependencies.

M11 begins only after M10 has validated the core Gather Tool premise end-to-end.

The product target is:

```text
A2UI Composer
      +
Gather Catalog
      +
Model Browser
      +
Model Runner
      +
Compatibility Validator
      +
tool Bundler
      ↓
single portable .gather tool package
```

The goal is not to replace upstream A2UI authoring. Reuse and stay close to the upstream Composer while adding the Gather-specific workflow that A2UI itself does not need to own.

---

## 1. Composer strategy

Start from the upstream A2UI Composer and maintain the smallest practical Gather wrapper or fork.

Preserve upstream architecture and make future rebasing straightforward.

Gather-specific additions should live in clearly isolated areas rather than modifying Composer internals unnecessarily.

Primary additions:

```text
Model Browser
Model Lab / Runner
Compatibility Report
Instrument dependency view
Package / Export workflow
```

---

## 2. Model Browser

Provide a curated browser of known Gather-compatible Models.

Initial entries can include existing validated Models such as:

```text
U2-NetP
MobileNet V3 Large
```

Each entry should expose:

```text
Model identity
task profile
revision
artifact hash
input/output contract
preprocessing
postprocessing
labels/resources
provenance
```

Do not begin with an open-ended public Model marketplace.

A curated registry/index is sufficient.

Also support importing a user-provided ONNX Model Package.

---

## 3. Model Lab / Runner

Allow a Model to be executed directly in the Composer environment against sample inputs.

Prefer browser-local execution using `onnxruntime-web`.

Workflow:

```text
select/import Model
      ↓
inspect ONNX inputs/outputs
      ↓
choose/upload sample input
      ↓
declared preprocessing
      ↓
ONNX inference
      ↓
declared postprocessing
      ↓
visualize result
```

Examples:

```text
segmentation → mask overlay
classification → ranked classes
future detection → boxes
```

This is an authoring/compatibility environment, not the authoritative mobile execution environment.

---

## 4. Model compatibility validation

Automatically validate imported Models against Gather's supported Model profiles.

Checks should include where applicable:

```text
ONNX loads successfully
supported ops/runtime
input names
input dtype
input shape/layout
output names
output dtype/shape
supported task profile
supported preprocessing vocabulary
supported postprocessing vocabulary
labels/resources present
finite sample inference
artifact hashes
manifest consistency
```

Produce a clear compatibility report:

```text
PASS
WARNING
FAIL
```

Failures should explain exactly what is incompatible.

Do not promise support for arbitrary ONNX graphs merely because they load in the browser.

---

## 5. Instrument dependency management

The Studio should understand that an Instrument may depend on one or more immutable Models.

Example:

```text
Calibrated Specimen Morphometrics
├── Gather Catalog revision
├── A2UI Instrument definition
├── segmenter ModelRef
└── optional classifier ModelRef
```

The authoring UI should make these dependencies visible and lock exact revisions before packaging.

The Model tested in the Studio should be the same immutable artifact referenced by the exported Instrument package.

---

## 6. Single-file Gather Instrument package

Export an Instrument and its dependencies as one portable file, for example:

```text
specimen-morphometrics.gather
```

Treat `.gather` as a deterministic archive/container format.

Conceptually:

```text
specimen-morphometrics.gather
├── manifest.json
├── instrument.a2ui.json
├── lock.json
│
└── models/
    ├── segmenter/
    │   ├── model.json
    │   └── model.onnx
    │
    └── classifier/
        ├── model.json
        ├── model.onnx
        └── labels.json
```

The lock should pin:

```text
Instrument revision
A2UI version
Gather Catalog revision
Capability requirements
Model revisions
ONNX artifact hashes
resource hashes
pre/postprocessing definitions
important parameters
```

The bundle is a **distribution artifact**, not Gather's runtime storage format.

On installation:

```text
.gather package
      ↓
verify package + internal hashes
      ↓
inspect dependencies
      ↓
reuse already-installed Model revisions
      ↓
install missing Models into Model Store
      ↓
install Instrument
```

This preserves Model deduplication even when multiple Instruments ship the same Model.

---

## 7. ODK Central workflow

The `.gather` package should be suitable for attachment to an ODK form as a single resource.

Target author experience:

```text
author XLSForm
      +
build Instrument in Gather Studio
      ↓
export specimen-morphometrics.gather
      ↓
attach package to form
      ↓
publish to ODK Central
```

Gather then downloads and installs the package during form/project synchronization.

A later enhancement may publish directly from Instrument Studio to Central, but direct Central integration is not required for the first M11 implementation if file export already produces the complete deployment artifact.

---

## 8. Reproducibility

Instrument Studio should make reproducibility a natural consequence of the authoring workflow.

The researcher should be able to answer:

```text
Which Instrument revision ran?
Which Catalog revision did it target?
Which Models were used?
What were their exact hashes?
What preprocessing/postprocessing was declared?
What dependencies were packaged?
```

Packaging should fail rather than silently produce an incompletely locked Instrument.

---

## 9. Keep the fork maintainable

Treat upstream compatibility as a feature.

Prefer:

```text
upstream Composer
        +
isolated Gather extensions
```

over deeply rewriting Composer internals.

Document:

```text
upstream revision
Gather patches/extensions
rebase/update procedure
```

Where possible, propose generally useful improvements upstream rather than permanently carrying them.

---

## Stretch goals

After the core workflow works:

```text
direct ODK Central publishing
remote/shared curated Model index
Hugging Face/model-source discovery
WebGPU performance profiling
mobile-vs-browser result comparison
Instrument templates
package signing
Model conversion/export assistance
```

Do not let these block the initial M11 workflow.

---

## M11 GREEN definition

M11 is GREEN when a researcher can:

1. Author or open an A2UI Instrument in the Gather-flavored Composer.
2. Select a known Model or import a supported ONNX Model Package.
3. Inspect and validate its declared input/output contract.
4. Run the Model on sample data in the browser and inspect meaningful output.
5. See Instrument → Model dependencies and immutable revisions.
6. Receive a clear compatibility report.
7. Export the complete Instrument as one verified `.gather` package.
8. Attach that single package to an ODK form for distribution.
9. Have Gather verify, unpack, deduplicate/install Models, and load the Instrument.
10. Reproduce the exact Instrument/Model dependency set from the package lock.

The resulting experience should feel like:

> **Design the tool, test the computation, validate compatibility, freeze the dependencies, and ship it.**
