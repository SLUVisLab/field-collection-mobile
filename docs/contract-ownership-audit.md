# Shared contract ownership audit

**Date:** 2026-09-01
**Scope:** which serializable contracts cross subsystem boundaries, and who should own them
**Status:** analysis only — no code changed
**Companions:** [scientific-directory-audit.md](./scientific-directory-audit.md) (file-level ownership),
[components-capabilities-ownership.md](./components-capabilities-ownership.md) (pillars, §5 asset contracts)

This answers the question §5 of the ownership map left open: *"Phase 2 relocates
them to a package-owned, native-free contracts module (candidate:
`gather-capabilities` or a small shared contracts entry)."*

## Method

Every claim below comes from the import graph and from executing the schemas,
not from the directory layout. Where a boundary claim was testable, it was
tested — three of them failed, and those failures are the most useful findings
in this document.

## Headline: the duplication already exists, and it already drifts

The premise that `contracts.js` is a "god module" is correct but incomplete.
There are **two** contracts modules, and **three** representations of
`ImageAsset`:

| # | Representation | Location | Enforced? |
| --- | --- | --- | --- |
| 1 | `createImageAsset()` constructor + imperative validators | `src/scientific/contracts.js` | yes, at construction |
| 2 | `ImageAssetSchema` (zod) | `packages/gather-capabilities/src/contracts.js` | **never parsed** |
| 3 | ad-hoc duck-typing (`requireImageAsset`, `isAssetObject`) | capability implementations, `gather-components/…/outputSchema.js` | partially |

**No zod io schema in `gather-capabilities` is ever `.parse()`d.** Verified:
`grep -rn '\.parse(\|safeParse'` across the package, `src/scientific`, and
`GatherProvider` returns only two `JSON.parse` calls in `modelStore.js`. The
schemas are declarative metadata for Composer advertisement; runtime validation
is a parallel set of hand-rolled guards.

Three drifts follow directly from that, all verified by execution:

1. **The renderer's fixture mask is invalid.** `apps/renderer/src/fixtureCapabilities.js`
   produces a mask lacking `format` and `sourceImageAssetId`;
   `MaskAssetSchema.safeParse` → `success: false`. Nothing catches it because
   nothing parses.
2. **`SegmentationResultSchema` understates the real output.** Declared keys are
   `image, model, mask, threshold`; the implementation returns those plus
   `receipt` and `performance`, and the Tool depends on `receipt`
   (`segmentAndMeasure.js` reads `segmentation.receipt`). The
   Composer-advertised contract is a subset of reality.
3. **`TASK_PROFILES` is duplicated verbatim across the package boundary.**
   `TASK_PROFILES` (`src/scientific/models/modelPackage.js`) and
   `IMAGE_TASK_PROFILES` (`gather-capabilities/src/contracts.js`) are
   independently defined and currently identical. The app validates a
   ModelPackage against one; the capability checks `modelRef.taskProfile`
   against the other. Divergence would make correct models silently unusable.

Two further schema-level observations: `measure.color` and `measure.sharpness`
declare `output: z.unknown()` — two of six measurement capabilities advertise no
output contract at all; and `createScientificModelRef` emits `artifactSha256`,
which `ModelRefSchema` accepts only because it is `.passthrough()`.

## What the import graph actually says

**`gather-capabilities` is hermetic.** Its only external import is `zod`. It
does not reach into app `src/` — the boundary the pillars call for is already
real and should be protected.

**`gather-storage` and `odk-central-client` do not know `ImageAsset` exists.**
`grep` for `assetId|ImageAsset` across both packages returns nothing. Durable
persistence is by *relative file key + bytes*; the asset contract is a
capability/Tool-level value that happens to carry a `path`. This matters for
Example 1 below: **storage is not an `ImageAsset` consumer**, so it exerts no
pull on ownership.

**Nothing persists a Tool result yet.** `onAcceptedResult` is an unwired seam
(its only non-test reference is the adapter that calls it). There is no
`.gather` bundle anywhere in the repo — `grep -rn '\.gather\b'` over `src`,
`packages`, `docs` returns nothing. So for every contract below, "persisted /
bundled" is currently **no**, which materially lowers the urgency of all of this.

**Every consumer of the generic helpers is inside `src/scientific` + tests.**

| Symbol | Files | Directories |
| --- | ---: | --- |
| `ScientificContractError` | 12 | all `src/scientific/*` + tests |
| `sha256For` | 6 | `src/scientific/{assets,models,runtime}` + tests |
| `revisionFor` | 4 | `src/scientific/{models,provenance}` + tests |
| `canonicalJson` | 3 | `src/scientific/models` + tests |
| `assertSerializableScientificValue` | 3 | `src/scientific/{provenance,workflows}` |
| `createImageAsset` | 3 | `src/scientific/assets` + tests |
| `createMaskAsset` | 3 | `src/scientific/runtime` + tests |

**Zero cross-package consumers.** This is the single most decision-relevant fact
in the audit: the generic serialization/hashing helpers do **not** cross any
boundary today. Extracting them into a shared package would be speculative.

## Contract ownership matrix

Legend — *Crosses?* = crosses a package/runtime boundary today.
*Persisted?* = written to durable storage or a bundle today.

| Contract / helper | Current file | Producers | Consumers | Crosses? | Persisted? | Generic or domain | Colocate? | Proposed owner | Confidence | Move now |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **ImageAsset** | `src/scientific/contracts.js` (ctor) + `gather-capabilities/contracts.js` (schema) | `imageAssetService` (app), renderer fixtures | capability impls, `gather-components` display, Tool result | **yes** (app → capabilities → components) | no | generic media | no | **`gather-capabilities`** now; `gather-contracts` if/when `gather-models` is extracted | high | **defer** (dedupe via parity test now) |
| **MaskAsset** | same pair | `modelExecutor` (app) | `image.segment` output, `measure.*` input, Tool result | **yes** | no | domain (vision) | no | same as ImageAsset | high | defer |
| **VideoAsset** | `gather-capabilities/contracts.js` only | *none — no producer* | none | no | no | generic media | n/a | stays where it is | high | **no** (unused; do not move a contract with no producer) |
| **ModelRef** | `modelPackage.js` (`createScientificModelRef`) + `ModelRefSchema` (package) | Models subsystem (app) | `image.*` impls (profile check), receipts, Tool provenance | **yes** (app → capabilities) | no | Models domain | **producer colocated, shape shared** | **shape → shared vocabulary; construction stays with Models** | high | defer |
| **ModelPackage** | `models/modelPackage.js` | bundled catalog, model store | model store, executor | no | yes (descriptor on disk) | Models domain | **yes** | **Models** (`gather-models` later) | high | **no** |
| **TASK_PROFILES / IMAGE_TASK_PROFILES** | duplicated in both | both sides | package validation + capability guard | **yes, duplicated** | indirectly (in descriptors) | shared vocabulary | no | **shared vocabulary** (single definition) | high | **no** — add parity test now, unify at `gather-models` |
| **SegmentationResult** | `gather-capabilities/image/segment/definition.js` | `image.segment` | Tool, A2UI data model, components | within package | no | capability-local | **yes** | **`gather-capabilities/image/segment`** — already correct | high | **no** (fix schema, don't move) |
| **ClassificationResult** | `…/image/classify/definition.js` | `image.classify` | Tool, components | within package | no | capability-local | **yes** | same | high | **no** |
| **MeasurementResult** | *does not exist*; `QuantitySchema` + ad-hoc adapter shape | OpenCV adapter (app) | Tool, components | partial | no | measurement domain | **yes** | **`gather-capabilities/measure`** | medium | **no** (specify it first) |
| **ExecutionReceipt** | `src/scientific/provenance/receipt.js` | `modelExecutor` (app) | forwarded opaquely by capabilities; read by Tool provenance | **yes** (as opaque payload) | no | capability-generic | construction near backend | **construction stays app-side; shape declared in shared vocabulary** | medium | defer |
| `canonicalJson` | `src/scientific/contracts.js` | — | 3 files, all app | **no** | no | generic | **yes** | **app util** (rename) | high | **no** |
| `sha256For` | same | — | 6 files, all app | **no** | no | generic | **yes** | app util | high | **no** |
| `revisionFor` | same | — | 4 files, all app | **no** | no | generic | **yes** | app util | high | **no** |
| `assertSerializableScientificValue` | same | — | 3 files, all app | **no** | no | generic | **yes** | app util | high | **no** |
| `ScientificContractError` | same | — | 12 files, all app | **no** | no | generic | **yes** | app util (rename) | high | **no** (rename only) |

## The four worked examples

### Example 1 — who owns `ImageAsset`?

```text
CameraView → camera.capturePhoto → ImageAsset → MediaGallery → Tool result → storage / ODK attachment
```

The chain's premise does not hold today at both ends. **Storage never sees an
`ImageAsset`** — `gather-storage` takes a relative key and bytes; the ODK
attachment path takes a filename and a native `File`. And **Components do not
consume the contract**, only its duck-typed shape: `outputSchema.js` treats
anything with `assetId | uri | path | mimeType` as an asset and formats a
summary. That is the right amount of coupling for a renderer — a display surface
should not need a schema import to show "image/jpeg · 960 x 640".

So the real sharing set is **producers (app) + Capabilities (declare/validate)**,
not the four-way spread the example implies. The app already depends on
`gather-capabilities`, so `gather-capabilities` can own the asset schemas today
with no new package and no wrong-direction edge.

The constraint to watch: if Components ever need to *validate* rather than
display an asset, importing from `gather-capabilities` would create
**Components → Capabilities**, which the pillars forbid. That is the trigger for
a shared package, not a reason to build one now.

### Example 2 — should `ModelRef` stay with Models?

**Yes, for construction. No, for the shape.** The current split is already
close to right and is worth preserving deliberately:

- `createScientificModelRef` lives with the Models subsystem, which is the only
  thing that can compute a revision from a ModelPackage.
- `image.segment` receives a **serializable `modelRef`** plus an **opaque
  `model`** plus an injected `execute`. It never imports the model store, never
  resolves anything, and inspects exactly one field: `modelRef.taskProfile`.

That is model lifecycle *not* leaking into capabilities, and it should be
defended. `SegmentationResult` belongs in
`gather-capabilities/image/segment` — it already is there, and it should not
move to any global contracts module.

The tension is narrow and specific: **Capabilities need the ModelRef *vocabulary*
(shape + task profiles) but must not depend on Models; Models produce ModelRef
but should not depend on Capabilities.** Today that is resolved by duplication
(the two `TASK_PROFILES`). Once `gather-models` is a package, duplication becomes
untenable and a third owner is required. That single edge is the entire case for
a shared contracts package.

### Example 3 — what is `MeasurementResult`?

It does not exist as a contract. What exists is `QuantitySchema` (`{value, unit}`)
and an implicit adapter shape `{area, perimeter, boundingBox, centroid}` /
`{color, sharpness}` produced by `openCvMeasurementAdapter` and consumed by the
Tool. Two capabilities (`measure.color`, `measure.sharpness`) declare
`output: z.unknown()`.

**Verdict: capability-local, in `gather-capabilities/measure`.** Measurements are
a coherent domain but not a cross-cutting one — nothing outside the measure
capabilities and their direct consumers needs the shape. The real work here is
*specifying* the missing contracts (color and sharpness especially), not moving
anything. Physical-unit calibration, when it lands, will change these shapes;
another argument for leaving them where they can change cheaply.

### Example 4 — is provenance shared?

`ExecutionReceipt` is **capability-generic in shape but produced by the execution
backend**. `modelExecutor` builds it (correctly recording `image.segment` /
`image.classify` — the stale `vision.*` ids the previous audit flagged are now
fixed), capabilities forward `result.receipt` without inspecting it, and the Tool
reads it for provenance.

**Verdict: construction stays near the backend; the shape should be declared
where the capability output is declared.** A receipt is only meaningful in terms
of a capability id, a ModelRef, and input/output digests — all vocabulary the
capability layer already has. Declaring `ExecutionReceiptSchema` alongside
`SegmentationResultSchema` also fixes drift #2 honestly, since the receipt is
part of the real output. Moving receipt *construction* into the capability
package would drag `revisionFor`/`canonicalJson` across the boundary for no gain.

## Strategy comparison

| | A — colocate everything | B — shared package for cross-boundary values | C — hybrid |
| --- | --- | --- | --- |
| ModelRef vocabulary | duplicated (today's `TASK_PROFILES` problem) or forces Models↔Capabilities edge | solved | solved |
| Asset contracts | duplicated across app/package/renderer | solved | solved |
| Risk of a new god module | none | **real** — a `gather-contracts` package attracts everything | low if contents are capped |
| Capability results | correctly local | at risk of being hoisted | correctly local |
| Cost today | zero | a package with ~5 consumers, most in one app | near-zero (defer the package) |

**A alone cannot work** — it is what we have, and it produced three verified
drifts. **B alone over-corrects**: it would pull `SegmentationResult` and
`MeasurementResult` away from their capabilities, which is exactly the giant
global contracts module to avoid. **C is right**, with one refinement the
evidence forces: the shared *package* is not needed yet, because the only edge
that requires it (Models↔Capabilities) does not exist until `gather-models` is
extracted.

## Recommendation

**Hybrid (C), with the shared package deferred and its trigger named.**

1. **Now:** keep every contract where it is. Convert the silent duplication into
   a loud one with parity tests (below). Fix the two schema honesty bugs.
2. **Interim owner of shared vocabulary:** `gather-capabilities`. It is hermetic,
   already holds the schemas, and the app already depends on it — no new package,
   no wrong-direction edge.
3. **Extract `gather-contracts` only when `gather-models` is extracted.** That is
   the moment the Models↔Capabilities edge becomes unavoidable. Extract both in
   one change, or neither.

Do **not** create the package to hold `canonicalJson`/`sha256For`/`revisionFor` —
they have zero cross-boundary consumers and belong in an app util module.

### Minimal exact contents, if/when `gather-contracts` lands

Native-free, zod-only, no behavior:

```text
gather-contracts
  Sha256            'sha256:<hex>' format primitive
  ImageAssetSchema
  MaskAssetSchema
  VideoAssetSchema
  ModelRefSchema
  TASK_PROFILES     the single task-profile vocabulary
  ExecutionReceiptSchema
```

Explicitly **not** in it: `canonicalJson`, `sha256For`, `revisionFor`,
`assertSerializable*` (app utils); `ModelPackage` + validation (Models);
`SegmentationResult`, `ClassificationResult`, measurement shapes (capability
domains); anything that imports a runtime.

## Proposed dependency graph

Today — all edges point into packages from the app; **no cycles**:

```text
   gather-components      gather-storage       gather-capabilities
   (duck-typed display)   (keys + bytes)       (zod only, hermetic)
            ▲                    ▲                     ▲
            └────────────────────┼─────────────────────┘
                                 │
                        app src/ (composition root)
                          scientific/{models,runtime,assets,provenance}
                          a2ui/, context/GatherProvider
```

Target, after `gather-models` + `gather-contracts`:

```text
                      gather-contracts        (schemas only, no runtime)
                       ▲      ▲      ▲
          ┌────────────┘      │      └────────────┐
   gather-models        gather-capabilities   gather-components
   (lifecycle,          (portable ops,        (presentation)
    store, validate)     engines injected)
          ▲                    ▲                     ▲
          └────────────────────┼─────────────────────┘
                        app src/ (wires engines, owns Tools)
```

Rules that keep it acyclic:

- `gather-capabilities` **must never** import `gather-models`. It takes an opaque
  `model`, a serializable `modelRef`, and an injected `execute`. This is true
  today and is the property most worth protecting.
- `gather-components` **must never** import `gather-capabilities`. Display stays
  duck-typed.
- `gather-contracts` imports nothing but `zod`.
- Tools compose downward only; nothing imports Tools.

### Circular-dependency risks in the proposal

| Risk | Trigger | Mitigation |
| --- | --- | --- |
| Models ↔ Capabilities | `gather-models` imports task profiles from `gather-capabilities`, or Capabilities import ModelRef from Models | `gather-contracts` owns the vocabulary; extract with `gather-models` |
| Components → Capabilities | a component validates rather than displays an asset | keep display duck-typed; if validation is genuinely needed, that is the second trigger for `gather-contracts` |
| Capabilities → app `src/` | a capability needs a receipt builder or model resolution | keep construction app-side and inject; the package must stay `zod`-only |
| `gather-contracts` becomes the new god module | anything with two consumers gets hoisted | cap its contents at the list above; capability results stay in their capability |

## `uri` is a runtime-local locator, not a portable value (decided 2026-09-01)

`ImageAsset.uri` / `VideoAsset.uri` name **where this runtime can render the
asset right now**:

```text
native   file://...
web      blob:... / data:...
```

The **shape and meaning** of the contract are portable; the locator is not.
Composer preview operates on a browser-local asset while the device operates on a
durable one, so **semantic parity is the goal, identical URI values are not**.

Consequences for the parity test below: assert the *shape* (required keys, digest
format, positive integer dimensions) and explicitly **do not** assert a URI
scheme or cross-runtime equality of `uri`. This is recorded so a later reader
does not mistake the difference for a defect and "fix" it.

## Safe cleanup available now (low risk, no moves)

1. **Contract parity tests.** Assert `createImageAsset(...)` parses against
   `ImageAssetSchema`, `createMaskAsset(...)` against `MaskAssetSchema`,
   `createScientificModelRef(...)` against `ModelRefSchema`, and that app
   `TASK_PROFILES` deep-equals `IMAGE_TASK_PROFILES`. This makes today's
   duplication *fail loudly on drift* without committing to a dependency
   direction — the highest value-per-risk action available.
2. **Declare `receipt` and `performance`** in `SegmentationResultSchema` and
   `ClassificationResultSchema`, so the advertised output matches what the
   implementation returns and the Tool relies on.
3. **Fix the renderer fixture mask** — add `format` and `sourceImageAssetId` so
   web fixtures satisfy `MaskAssetSchema`.
4. **Specify `measure.color` / `measure.sharpness` outputs** instead of
   `z.unknown()`.
5. **Header note** in `src/scientific/contracts.js` recording that it is the
   app-side constructor half of a pair, and pointing here.

Items 1–4 are behavior-preserving and independently revertable.

## Deferred

- Extracting `gather-contracts` — until `gather-models` extraction (same change).
- Extracting `gather-models` — unchanged from the previous audit; still blocked
  on the `modelExecutor` ownership fork.
- Splitting `src/scientific/contracts.js` — the split is correct in principle,
  but with zero cross-boundary consumers of the generic half it buys nothing yet.
- Moving `imageAssetService.js` to `gather-storage` — note that storage is
  currently asset-agnostic, so this would *introduce* the asset contract into a
  package that is deliberately free of it. Reconsider whether the move is wanted
  at all, rather than treating it as pending.
- Moving `workflows/segmentAndMeasure.js` to a Tools home.

## Misleading names

The `Scientific*` prefix is wrong in three different ways, and each wants a
different fix:

| Name | Problem | Suggested |
| --- | --- | --- |
| `ScientificContractError` | generic error, 49 occurrences, nothing scientific about it | `ContractError` |
| `assertSerializableScientificValue` | asserts JSON-serializability | `assertSerializable` |
| `canonicalJson` / `sha256For` / `revisionFor` | *correctly* named; only their file is mis-prefixed | keep |
| `createScientificModelRef` | a Models concept, not a scientific one | `createModelRef` |
| `validateScientificModelPackage` | same | `validateModelPackage` |
| `persistScientificCapture` (provider action) | generic media persistence | `persistCapture` |
| `segmentScientificImage` / `classifyScientificImage` | wrap `image.segment` / `image.classify` | align to capability ids |
| `src/scientific/assets/imageAssetService.js` | generic media persistence | (per prior audit) |
| `src/scientific/workflows/segmentAndMeasure.js` | a **Tool** | (per prior audit) |

The renames are mechanical but wide (`ScientificContractError` alone touches 12
files). They are safest as one dedicated rename commit **after** the ownership
decisions land, so the two kinds of churn do not overlap in review.

## Open questions for review

- Should `gather-capabilities` **enforce** its io schemas at runtime, or stay
  advertisement-only? Enforcing would have caught all three drifts, at the cost
  of parse overhead on every capability call and a stricter contract than the
  duck-typed implementations currently honor.
- Is `VideoAsset` worth keeping in the package before a producer exists? It is
  currently a schema with no writer and no reader.
- Does the accepted Tool result become a persisted artifact (the `.gather` bundle
  that does not yet exist)? If so, the asset and receipt contracts become
  *format* contracts with compatibility obligations, which would raise their
  ownership priority considerably.
