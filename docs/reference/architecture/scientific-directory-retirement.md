# Retiring `src/scientific` — and finding a home for pre-made compositions

**Status: landed 2026-09-04.** Proposal A was taken, with `gather-models`
extracted alongside it rather than deferred. What shipped:

```text
packages/gather-hashing/     canonical JSON + content digests (new)
packages/gather-models/      ModelPackage / ModelRef / store / availability
src/compute/                 ONNX + OpenCV engines, config, inference pipeline
src/media/                   asset contracts, capture persistence, identity
src/provenance/              execution receipts
compositions/                canonical first-party artifacts, as content
```

`contracts.js` split four ways with one domain error each — `IntegrityError`,
`MediaAssetError`, `ModelError`, `ComputeError` — replacing the single
`ScientificContractError` that stood for all of them. The S&M result helper went
to `src/a2ui/segmentAndMeasureResult.js` to die with its cluster rather than be
rehomed into `compute/`. Identifiers were renamed by ownership, not by prefix
sweep. The stale `vision.segment` assertion in the M80 gate is fixed.

### The shared-hashing package, after review

`gather-integrity` was reviewed and **narrowed into `gather-hashing`**. The
consumer map settled it:

| export | consumers |
| --- | --- |
| `canonicalJson` | **one**, inside `gather-models` |
| `assertSerializableValue` | two, both app-side |
| `IntegrityError` | **none** — a dead re-export |
| `sha256For` / `revisionFor` | models *and* media *and* provenance |

So the genuinely cross-boundary surface was one idea — a digest — and the rest
had smaller owners. Deleting the package outright was not reachable: provenance
needs a canonical digest, `gather-models` needs the same one, and the only ways
to avoid a shared package are a copy in each domain (which the app and
`gather-capabilities` already had, and had drifted) or routing media and
provenance through `gather-models` for hashing, which is a worse dependency
direction.

What shipped instead:

```text
gather-hashing   canonicalize / digestBytes / digestCanonical
                 DIGEST_ALGORITHM / DIGEST_PREFIX
                 no error type, no policy, no domain semantics
src/provenance/serializable.js   assertSerializableValue — a receipt
                 precondition, owned by the thing that needs it
```

`sha256For` took either bytes or a value, which hid at every call site whether a
digest described *bytes* or a *description of bytes*. `digestBytes` now refuses
anything but a `Uint8Array`.

**On reimplementing a standard:** the precise claim is that

> Gather's canonical value representation is compatible with RFC 8785/JCS **over
> Gather's admitted serializable value domain**.

— objects, arrays, strings, finite numbers, booleans and null, and nothing
about values JCS handles and Gather refuses. Within that domain the agreement is
a consequence rather than a coincidence to maintain: key order is UTF-16
code-unit order, which is what `Array#sort` does, and numbers come from
`JSON.stringify`, which already implements the ES6 `Number::toString` JCS
mandates. Adding an RFC 8785 dependency would replace fifteen lines and change
nothing observable inside that domain.

**The digests are a compatibility contract, and are pinned as one.**
`instance_receipts.revision` holds canonical digests on device, and
`gather-models` names installed model directories by revision
(`projects/<key>/models/<digest>/`), so changing canonicalization would orphan
every installed model and make old receipt revisions incomparable with new ones.

`packages/gather-hashing/vectors.js` freezes that: canonical forms including the
number cases where a runtime with its own formatter would diverge (`1e+21`,
`1e-7`, `-0 → 0`, `1e20`), non-ASCII key ordering, known digests for bytes and
for a receipt-shaped value, and the refusals — `NaN`, `Infinity`, `Date`,
function, `Map`, `RegExp`, and `undefined` in three positions, since
`JSON.stringify` would drop or null those silently.

It is runtime-agnostic on purpose, because the risk being guarded is that a
*runtime* formats a number differently:

| runtime | how | status |
| --- | --- | --- |
| Node | `packages/gather-hashing/test/golden-vectors.test.mjs`, in `test:unit` | passing |
| Hermes | `gates/HashingVectorsGateApp.js`, marker `HASHING_VECTORS::` | not yet run — needs a device |
| browser | `packages/gather-hashing/browser-vectors.html` | not yet run |

All three call the same `runHashingVectors` against the same module, so a
divergence shows up as a named failing vector rather than a mystery.

Original evaluation follows.

Extends [scientific-directory-audit.md](../../archive/superseded/scientific-directory-audit.md)
(2026-09-01), which mapped every file to an owner and is still accurate. Two
things have changed since, and they change conclusions rather than adding to
them:

1. **"Scientific" is retired as a naming term.** It implies something specific
   that is neither accurate nor useful — Gather tools, compositions and
   capabilities are not exclusively scientific.
2. **Compositions are now form-supplied artifacts, not app-registered Tools.**
   The prior audit deferred the Tools home to "Phase 5/7". That question is no
   longer about packaging code.

## 1. What is actually in there

19 files, 1247 lines. Three groups.

### Belongs — on-device models and native compute (12 files)

```
models/modelPackage.js            ModelPackage / ModelRef / TASK_PROFILES
models/modelStore.js              immutable install / resolve / verify
models/modelAvailability.js       resolve-or-install
models/bundledModelPackages.js    the two bundled descriptors, as data
models/bundledModelInstaller.js   native seam — expo-asset / expo-file-system
runtime/modelExecutor.js          ONNX inference orchestration
runtime/modelTransforms.js        pure numeric pre/post
runtime/onnxRuntime.js            bounded session cache, engine-agnostic
runtime/onnxReactNativeAdapter.js native seam — onnxruntime-react-native
runtime/executionProviders.js     platform → EP list
runtime/openCvImageAdapter.js     OpenCV decode / resize / mask
runtime/openCvMeasurementAdapter.js OpenCV area / perimeter / bbox / colour
```

This is the directory's real subject, and it matches the intent: on-device
models, ML runtimes, native wrappers, and their configuration. `performance.js`
and `debug.js` are generic helpers that travel with the backend.

### Does not belong (5 files)

| file | what it actually is |
| --- | --- |
| `assets/imageAssetService.js` | generic media persistence. Nothing about it is ML — it copies capture bytes into project storage and mints an `ImageAsset` |
| `assets/workingAssetIdentity.js` | the same, added 2026-09-02 and filed here by momentum rather than by argument |
| `provenance/receipt.js` | capability-generic provenance. **Newly proven so:** `XFormsCompositionControl` now mints a receipt for an authored composition with no model in the picture at all |
| `contracts.js` | a god module — generic hashing/serialization/error *plus* the `ImageAsset`/`MaskAsset` contracts, imported by nearly every file here |
| `workflows/segmentAndMeasure.js` | a result-shape validator for one deprecated native screen |

The first two are exactly the two files that prompted this probe, and the prior
audit had already reached the same verdict on `imageAssetService.js`
("**mislabeled** — nothing scientific here"). `workingAssetIdentity.js` is mine
from two days ago: it went next to its only caller instead of next to its
concern.

### `workflows/` is not what it sounds like

It is a single 40-line function, `createSegmentAndMeasureResult`, that asserts
the shape of the deprecated Segment & Measure screen's accepted result. It
contains no composition, no workflow engine, and nothing reusable. It should
disappear with that screen (roadmap step 6 audits it) rather than be relocated.

So the `workflows/` directory is not the home of pre-made compositions, and
never was. But the question behind the concern is real, and the answer moved.

## 2. Pre-made compositions: content, not code

Today they live in `test/fixtures/quadrat-tally/`,
`test/fixtures/photo-capture/` and `gates/fixtures/authoredCompositionFixture.js`
— i.e. nowhere. That is genuine homelessness, and it will get worse as the
catalog grows.

The instinct that they are "no different from any other composition except that
we pre-made them" is exactly right, and it settles more than it looks like:

```text
a composition's distribution channel is a FORM ATTACHMENT, via Central
the app receives one with a form; it never imports one
```

We proved that on hardware: a composition unknown to the installed binary
rendered, executed and committed with **zero** registry entry. So a pre-made
composition is not a dependency of the mobile app. It is a **seed for an
author** — something the Composer opens, inspects, and forks into a customised
copy, which is a *document* workflow, not a module-import one.

### Why `packages/` is the tempting answer and probably the wrong one

`packages/` is the mobile app's dependency space. Putting artifacts there
creates a standing invitation to `import` one into the app — which is precisely
the composition registry we spent this week deleting. The property worth
protecting is that **the binary knows nothing about any specific
composition**, and directory layout is the cheapest enforcement available.

There is a small legitimate code tail: Quadrat Tally still ships a registered
handler. That tail is app code and belongs in `src/`, and it should be kept
physically apart from the artifacts so that a composition's *artifact* never
sits next to its *handler*. The tail should shrink toward zero as authored
behaviour replaces bespoke handlers.

## 3. The naming footprint

Five paths and roughly 200 identifier occurrences:

```text
src/scientific/                 the directory itself
src/components/scientific/      one file, SegmentAndMeasureViews.js
test/scientific/                the test mirror
assets/scientific/models/       the bundled .onnx and labels
docs/m8-scientific-*.md         historical record — leave alone
```

Worst identifier concentrations: `GatherProvider.js` (51), `modelStore.js` (19),
`modelExecutor.js` (14). The names themselves:
`ScientificContractError`, `createScientificModelRef`,
`validateScientificModelPackage`, `assertSerializableScientificValue`,
`persistScientificCapture`, `scientificRuntime`, `segmentScientificImage`,
`measureScientificMask`.

**Most of these should not be renamed — they should stop existing.** A wholesale
`Scientific* → Gather*` pass would be one mechanical commit, but it would
entrench the god module: `ScientificContractError` does not want to become
`GatherContractError`, it wants to split into a serialization error and an asset
error. Renaming first means renaming twice.

The exception is the *rule*, which costs nothing and should start now: no new
identifier, file or directory uses the term.

## 4. Proposals to review

### A. Evict and rename, in that order (recommended)

Two commits, no new packages, no cross-package API negotiation.

```text
1  evict the five strangers
     assets/*            → src/media/            (generic asset persistence)
     provenance/receipt.js → src/provenance/     (capability-generic)
     contracts.js        → split: serialization helpers, asset contracts, errors
     workflows/*         → delete with the S&M screen (roadmap step 6)

2  rename what remains, which is now honestly one subject
     src/scientific/  →  src/compute/
     test/scientific/ →  test/compute/
     assets/scientific/models/ → assets/models/
```

Why `compute/`: what remains is models plus two native engines, and one of those
engines does measurement rather than inference — so `inference/` and `ml/` are
both narrower than the contents. `compute/` covers "on-device work the device
does with models and native libraries" without over-claiming.

The eviction has to come first, because `contracts.js` is what nearly every
remaining file imports; splitting it after a rename means touching the same
files twice.

### B. Rename now, evict later

One mechanical commit stops the term spreading immediately, and the eviction
happens whenever `gather-storage`'s API is ready. Cheaper today, and it entrenches
the god module — the audit's `contracts.js` split gets harder, not easier.

### C. Extract `gather-models` as part of the move

The prior audit found this cluster genuinely cohesive and native-free at its
core, and said "yes, eventually — but not forced by the current graph", blocked
on the `contracts.js` split and the `modelExecutor` ownership fork. Both blockers
are still standing. Doing it now means resolving that fork under time pressure
from a rename.

### For the composition catalog

```text
compositions/                       repo root, content not code
  README.md                         what this is, and what it is NOT
  photo/authored-photo/
    authored_photo_v1.a2ui.json
  tally/quadrat/
    quadrat_tally_v1.a2ui.json
```

Consumed by the Composer, never by the app. Categories are directories, so the
"large catalog with many subcategories" case is just nesting. Publishing to
Central stays the distribution path, so nothing here needs npm semantics.

The migration that follows is to serve this from a registry when the Composer
wants search and versioning across many entries — at which point a content tree
is already the right shape and a package would have been the wrong one.

**What to do with the fixtures:** the test and gate fixtures should *reference*
catalog entries rather than define their own, so the artifacts under test are
the artifacts that ship. That is the change that stops the catalog from being
homeless, and it is worth doing whichever proposal wins.

## 5. What this does not settle

- The `modelExecutor` ownership fork (Models subsystem vs `image.*` capability
  backend) — still open, and still the prerequisite for `gather-models`.
- Whether `src/media/` is a way station or the destination. The prior audit's
  answer was `gather-storage`, "needs storage-package API alignment"; `src/media/`
  is the lower-risk intermediate that does not block on that.
- The stale receipt capability ids in `modelExecutor.js` (`vision.segment`,
  `vision.classify`) that the prior audit flagged as a correctness bug. Still
  unfixed, still independent of any move, and still worth doing on its own.
