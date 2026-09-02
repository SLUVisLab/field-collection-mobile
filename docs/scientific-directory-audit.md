# `src/scientific` ownership & dependency audit

**Status:** analysis/documentation only — **no files moved**, no refactor performed.
Verified from code on 2026-09-01. Respects **Option B** (the app/model layer computes
the serializable `ModelRef`; `contracts.js` / `modelPackage.js` are **not** moved
into `gather-capabilities`).

**Why:** `src/scientific` is an M8 vertical slice mixing several architectural
concerns (asset storage, model lifecycle, execution engines, provenance, and a
Tool). This audit maps each file to its true owner before any ownership change.

## Method

For every file: read imports/exports, found external consumers by basename grep,
and traced the three representative execution paths. External consumers are almost
entirely [GatherProvider.js](../src/context/GatherProvider.js) (the app wiring point)
and — for the workflow only — [capabilityActionAdapter.js](../src/a2ui/capabilityActionAdapter.js).

## Dependency direction (verified execution paths)

```
image.segment  (gather-capabilities, portable; receives modelRef + injected execute)
  execute = scientificRuntime.executor.segment            → runtime/modelExecutor.js
    ├─ modelStore.resolve(modelRef)                        → models/modelStore.js         [Model subsystem]
    ├─ imageAdapter.decodeResizeRgb / resizeMask           → runtime/openCvImageAdapter    [OpenCV engine, NATIVE]
    ├─ rgbToTensor / binaryMask                            → runtime/modelTransforms      [pure transforms]
    ├─ onnxRuntime.run                                     → runtime/onnxRuntime → onnxReactNativeAdapter [ONNX engine, NATIVE]
    ├─ files.write + createMaskAsset                       → contracts.js (asset) + injected fs
    └─ createExecutionReceipt                              → provenance/receipt.js
  ⇒ SegmentationResult { image, model: ref, mask, threshold, receipt, performance }

measure.area  (gather-capabilities, portable; injected adapter)
  adapter = scientificRuntime.measurementAdapter          → runtime/openCvMeasurementAdapter [OpenCV, NATIVE]
  ⇒ MeasurementResult { area: { value, unit } }

Segment & Measure Tool
  capabilityActionAdapter (ToolFlowController)
    → persistScientificCapture   → assets/imageAssetService.js   [generic media persistence]
    → segment/classify           → runtime/modelExecutor.js       [image inference backend]
    → measure*                    → openCvMeasurementAdapter       [measurement backend]
    → createSegmentAndMeasureResult → workflows/segmentAndMeasure.js [Tool result contract]
```

**Boundary observations (verified):**

1. **Stale capability ids (bug).** `runtime/modelExecutor.js` writes receipts with
   `capability: 'vision.segment'` / `'vision.classify'` — not updated after the
   Phase-2 `vision.* → image.*` rename. Receipts now record a capability id that no
   longer exists in the catalog.
2. **`modelExecutor` is portable orchestration, not native.** It imports **no**
   native module directly; ONNX/OpenCV/fs are injected. It straddles the Model
   subsystem (calls `modelStore.resolve` + `createScientificModelRef`) and the ONNX
   engine — it is the *image inference backend* for `image.*`.
3. **`openCvImageAdapter` is shared infra**, used by inference (decode/resize/mask)
   **and** measurement (`openCvMeasurementAdapter` imports `decodeRgbFile` from it).
4. **`contracts.js` is a base "god module"**: it mixes generic hashing/serialization
   + error + the asset contracts (`ImageAsset`/`MaskAsset`) and is imported by ~all
   scientific files. The generic parts are not scientific.

## Per-file records

Fields: responsibility · imports · consumers · serializable contracts · native deps ·
scientific-coupling · likely owner · confidence · move now? · notes.

### A. Model lifecycle / model package infrastructure

**`models/modelPackage.js`** — ModelPackage validation + `ModelRef` creation +
revision hashing + `TASK_PROFILES`. · imports `contracts`. · consumers: modelStore,
modelAvailability, bundledModelPackages, modelExecutor, **GatherProvider**. ·
contracts: `ModelRef`, `ModelPackage`, `TASK_PROFILES` (all serializable). · native:
none. · coupling: `contracts`. · owner: **Models subsystem (future `gather-models`)**.
· confidence: **high**. · move now? **no** (Option B). · notes: the model-contract
core; "Scientific" prefix is misleading (it is the Models pillar).

**`models/modelStore.js`** — device-side immutable install/resolve with hash/lock
verification; fs injected. · imports `contracts`, `modelPackage`. · consumers:
GatherProvider, modelExecutor (`resolve`). · contracts: resolved descriptor +
`modelRef` + paths. · native: none (fs injected). · coupling: contracts, modelPackage.
· owner: **Models subsystem**. · confidence: **high**. · move now? **no**. · notes:
cohesive with modelPackage; cleanly injectable.

**`models/modelAvailability.js`** — resolve-or-install orchestration. · imports
`contracts`, `modelPackage`. · consumers: bundledModelInstaller. · native: none. ·
owner: **Models subsystem**. · confidence: **high**. · move now? **no**.

**`models/bundledModelPackages.js`** — the two bundled `ModelPackage` descriptors
(u2netp, mobilenetV3Large) as data. · imports `modelPackage` (TASK_PROFILES). ·
consumers: bundledModelInstaller, **GatherProvider**. · native: none. · owner:
**Models subsystem (catalog/data)**, or app-provided model catalog. · confidence:
**medium-high**. · move now? **no**. · notes: could be app- or study-supplied later;
today it is bundled-app data.

**`models/bundledModelInstaller.js`** — loads bundled `.onnx`/`.txt` bytes via
`expo-asset`/`expo-file-system` and installs them. · imports **expo-asset**,
**expo-file-system**, `require()` of asset files, bundledModelPackages,
modelAvailability. · consumers: **GatherProvider**. · native: **yes** (expo asset/fs
+ bundled require). · owner: **Models subsystem — native "source adapter" seam**
(`.native`), behind the store. · confidence: **high**. · move now? **no**. · notes:
the one native file in the model cluster; isolate behind a source-adapter seam.

### B. Capability implementation / execution backend

**`runtime/modelExecutor.js`** — ONNX inference pipeline for segment/classify
(preprocess → run → postprocess → materialize mask → receipt). · imports `contracts`
(createMaskAsset, sha256For), `modelPackage` (createScientificModelRef), `receipt`,
`modelTransforms`, `performance`, `debug`; injected `modelStore`/`onnxRuntime`/
`imageAdapter`/`files`. · consumers: **GatherProvider** (wired as `executor`, the
`execute` for image.*). · native: none directly (all injected). · coupling: **high**
— bridges Model subsystem + ONNX + OpenCV image adapter + provenance. · owner:
**`image.*` capability execution backend** (depends on the Models subsystem).
· confidence: **medium** (straddles Models vs Capabilities — see §F). · move now?
**no**. · notes: **has the stale `vision.*` receipt ids**; is portable orchestration
despite living in `runtime/`.

**`runtime/modelTransforms.js`** — pure numeric ONNX pre/post (rgbToTensor, sigmoid,
binaryMask, softmax, rankedLabels). · imports `contracts`. · consumers: modelExecutor.
· native: none. · owner: **image inference backend** (ONNX transforms). · confidence:
**high**. · move now? **no**.

**`runtime/onnxRuntime.js`** — bounded ONNX session cache; `createSession`/
`createTensor` injected; only plain data crosses out. · imports `contracts`. ·
consumers: onnxReactNativeAdapter. · native: none (engine-agnostic core). · owner:
**ONNX engine (portable core)**. · confidence: **high**. · move now? **no**.

**`runtime/onnxReactNativeAdapter.js`** — binds `onnxRuntime` to
`onnxruntime-react-native`. · imports **onnxruntime-react-native**, **react-native**,
onnxRuntime, executionProviders. · consumers: **GatherProvider**. · native: **yes**.
· owner: **ONNX engine native seam** (`.native`). · confidence: **high**. · move now?
**no**.

**`runtime/executionProviders.js`** — platform → EP list (nnapi/coreml/xnnpack/cpu).
· imports none. · consumers: onnxReactNativeAdapter. · native: none (platform strings).
· owner: **ONNX engine config**. · confidence: **high**. · move now? **no**.

**`runtime/openCvImageAdapter.js`** — OpenCV decode/resize/mask-write. · imports
**react-native-fast-opencv**, **react-native-nitro-image**, `contracts`, `debug`. ·
consumers: **GatherProvider** (imageAdapter), openCvMeasurementAdapter. · native:
**yes**. · owner: **OpenCV image engine (shared by inference + measurement)**. ·
confidence: **high**. · move now? **no**. · notes: shared infra — placement must
serve both `image.*` decode and `measure.*`.

**`runtime/openCvMeasurementAdapter.js`** — OpenCV mask/image measurements
(area/perimeter/bbox/centroid/color/sharpness). · imports **react-native-fast-opencv**,
openCvImageAdapter. · consumers: **GatherProvider** (measurementAdapter, the
`adapter` for measure.*). · native: **yes**. · owner: **`measure.*` execution backend
(OpenCV)**. · confidence: **high**. · move now? **no**.

**`runtime/performance.js`** — perf trace helper. · imports none. · consumers:
modelExecutor. · native: none. · owner: **generic runtime helper**. · confidence:
**high**. · move now? **no** (trivial; travels with the backend).

**`runtime/debug.js`** — dev-only stats logging (stripped in release). · imports none.
· consumers: modelExecutor, openCvImageAdapter. · native: none. · owner: **generic
dev helper**. · confidence: **high**. · move now? **no**.

### C. Generic asset / storage infrastructure

**`assets/imageAssetService.js`** — persists a camera capture into storage and mints
an `ImageAsset`; fs injected. · imports `contracts` (createImageAsset, sha256For,
error). · consumers: **GatherProvider** (`persistScientificCapture`). · native: none
(fs injected). · coupling: only `contracts`. · owner: **generic media/asset storage**
(candidate: `gather-storage`), **not scientific**. · confidence: **high**. · move now?
**no** (needs storage-package API alignment). · notes: **mislabeled** — nothing
scientific here beyond producing an `ImageAsset`.

### D. Provenance

**`provenance/receipt.js`** — `createExecutionReceipt` (capability, model, inputs,
outputs, runtime, timestamp, content revision). · imports `contracts`
(assertSerializable, revisionFor). · consumers: modelExecutor. · native: none. ·
owner: **capability-generic provenance** (any capability could emit a receipt). ·
confidence: **medium-high**. · move now? **no**. · notes: currently only the ONNX
backend emits receipts, but the shape is capability-generic; likely belongs beside
capabilities (or a shared contracts module) rather than "scientific".

### E. Tool / workflow code

**`workflows/segmentAndMeasure.js`** — `createSegmentAndMeasureResult`: assembles the
typed Segment & Measure result (image + segmentation + measurements + classification
+ provenance). · imports `contracts` (assertSerializable, error). · consumers:
**capabilityActionAdapter.js** (the ToolFlowController). · native: none. · owner:
**the Segment & Measure Tool** (not scientific infra). · confidence: **high**. ·
move now? **no** (Tools packaging/location is Phase 5/7). · notes: this is a **Tool**
result contract; its home should be wherever Tools live.

### F. Ambiguous / requires design decision

> **Followed up 2026-09-01:** the `contracts.js` split question is answered in
> [contract-ownership-audit.md](./contract-ownership-audit.md), which verified the
> import graph and found the generic helpers have **zero** cross-package
> consumers (so no shared package is justified for them yet), plus three
> already-live schema drifts.


**`contracts.js`** — mixes three concerns: (1) generic **serialization/hashing/error**
(`ScientificContractError`, `sha256For`, `revisionFor`, `canonicalJson`,
`assertSerializableScientificValue`); (2) **asset contracts** (`createImageAsset`,
`createMaskAsset`); (3) is the universal base (imported by ~all scientific files). ·
native: none. · owner: **split needed** — generic hashing/error → shared native-free
util; asset contracts → shared asset-contract module (used by capabilities *and*
components). · confidence: **high that it should split; undecided where**. · move now?
**no** (Option B; 12 consumers). · notes: the "Scientific" naming is generic.

**`runtime/modelExecutor.js`** (also listed in B) — **ownership fork**: is it part of
the **Models subsystem** (it resolves models, knows preprocessing/postprocessing
steps) or the **`image.*` capability backend** (it is the injected `execute`)?
Recommended reading: it is the *image-inference backend that depends on the Models
subsystem* — i.e., capability implementation, not model lifecycle. Decide before
moving, because it determines whether ONNX execution ships inside `gather-models` or
inside `gather-capabilities/image/*/implementation.native.js`.

## Proposed target ownership map

```
Models subsystem (future `gather-models`, native-free core + native source seam)
  models/modelPackage.js         ModelPackage/ModelRef/TASK_PROFILES/validation
  models/modelStore.js           immutable install/resolve/verify (fs injected)
  models/modelAvailability.js    resolve-or-install
  models/bundledModelPackages.js bundled catalog data
  models/bundledModelInstaller.js  → .native source-adapter seam (expo-asset/fs)

image.* capability backend  (gather-capabilities/image/*/implementation[.native])
  runtime/modelExecutor.js       ONNX inference orchestration (depends on Models)
  runtime/modelTransforms.js     pre/post numeric transforms
  runtime/onnxRuntime.js         ONNX session core (portable)
  runtime/onnxReactNativeAdapter.js → .native ONNX seam
  runtime/executionProviders.js  EP config
  runtime/openCvImageAdapter.js  OpenCV decode/resize/mask (shared w/ measure)

measure.* capability backend  (gather-capabilities/measure/implementation.native)
  runtime/openCvMeasurementAdapter.js  OpenCV measurements

Generic / shared
  contracts.js (split): hashing/error → shared util; ImageAsset/MaskAsset → asset contracts
  provenance/receipt.js → capability-generic provenance (beside capabilities/shared)
  runtime/performance.js, runtime/debug.js → generic helpers (travel w/ backend)
  assets/imageAssetService.js → gather-storage (generic media persistence)

Tools
  workflows/segmentAndMeasure.js → Segment & Measure Tool (Tools home, Phase 5/7)
```

## 1. Safe cleanup we could make now (low risk)

- **Fix the stale receipt capability ids** in `runtime/modelExecutor.js`:
  `'vision.segment'` → `'image.segment'`, `'vision.classify'` → `'image.classify'`.
  This is a correctness fix (provenance records a non-existent id) and is independent
  of any file move. *(Recommended; not performed in this analysis-only task.)*
- Add a short **README/header note** in `src/scientific/` pointing to this audit and
  labeling the three mislabeled files (see §4) — documentation only.

## 2. Moves to explicitly defer (until the model architecture is finalized)

- Extracting **`gather-models`** (see §5).
- Splitting/moving **`contracts.js`** and **`modelPackage.js`** — Option B holds.
- Moving **`modelExecutor` + ONNX/OpenCV engines** — blocked on the §F ownership fork
  (Models vs image-capability backend).
- Moving **`imageAssetService.js`** into `gather-storage` — needs storage-package API
  alignment.
- Moving **`workflows/segmentAndMeasure.js`** — needs the Tools packaging decision
  (Phase 5/7).
- Relocating **`provenance/receipt.js`** — follows the contracts split.

## 3. Misleading names / responsibilities

- `assets/imageAssetService.js` — **generic media persistence**, not scientific.
- `workflows/segmentAndMeasure.js` — a **Tool**, not scientific infrastructure.
- `contracts.js` + the `Scientific*` prefix (`ScientificContractError`,
  `validateScientificModelPackage`, `createScientificModelRef`) — the hashing/error
  and model-contract pieces are **generic/Models**, not "scientific."
- `runtime/modelExecutor.js` — specifically an **ONNX image-inference backend**, and
  its receipts still say `vision.*` (stale).
- `runtime/` — conflates ONNX engine + OpenCV engine + pure transforms + generic
  helpers (perf/debug) under one folder.

## 4. Is a future `gather-models` package justified?

**Yes, eventually — but not forced by the current graph.** The cluster
`modelPackage` + `modelStore` + `modelAvailability` + `bundledModelPackages`
(+ `bundledModelInstaller` as a native source seam) is genuinely cohesive, native-free
at its core (only the installer touches native asset/fs), and maps directly to the
design's **Models = versioned scientific dependencies** pillar. It depends only on the
generic contracts (hashing/error).

However, today its **only consumers are the app (`GatherProvider`) and the ONNX
executor**, and Option B keeps `ModelRef` computation app-side — so capabilities do
**not** depend on the model subsystem. Nothing outside the app reuses it yet, so
extraction is not required for correctness or for `gather-capabilities`.

**Minimal responsibility if/when extracted:** ModelPackage schema + validation,
`ModelRef` + revision hashing, `TASK_PROFILES`, the immutable ModelStore
(install/resolve/verify), resolve-or-install availability, and a **source-adapter
seam** for bundled/downloaded bytes (native behind `.native`). It should **not** own
ONNX execution (that is the image-capability backend that *depends on* the store) —
resolving the §F fork is the prerequisite. Extraction also depends on first splitting
`contracts.js` (its hashing/error base).

**Recommendation:** keep the Models cluster in place under Option B; revisit
extraction once (a) the `contracts.js` split is decided and (b) the `modelExecutor`
ownership fork (§F) is resolved — likely alongside Phase 3 (camera-session/runtime
work), when the "runtime engines vs Models vs capability backends" boundary is being
drawn anyway.
