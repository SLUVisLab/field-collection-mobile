# Components & Capabilities ownership map (Phase 1)

**Status:** Phase 1 artifact (inventory + contracts) for the *Gather Camera,
Components, and Capabilities Architecture* design (maintainer-provided design doc,
2026-09-01).
**A2UI version:** v0.9 stays (no v1.0 migration in this work).

This document is the **inventory + contracts** deliverable. It classifies existing
code, records the target ownership for Phase 2 moves, and pins the capability and
asset contracts. It does **not** create the `gather-capabilities` package or move
any code — that is Phase 2.

## 0. Public architecture: Components, Capabilities, Tools

The Gather public architecture has **exactly three abstractions**. Everything a Tool
author (or the Composer agent) reasons about is one of these:

- **Components** — reusable UI/interaction primitives: `Flow`, `View`, `CameraView`,
  `VideoView`, `MediaGallery`, `ImageOverlay`, `OutputReview`, Basic Catalog
  `Text`/`Button`/`Row`/`Column`/`Image`/`Video`, etc. *(package: `gather-catalog`
  declarations + `gather-components` implementations.)*
- **Capabilities** — reusable operations: `camera.capturePhoto`, `camera.recordVideo`,
  `image.segment`, `image.classify`, `measure.area`, etc. *(package:
  `gather-capabilities`.)*
- **Tools** — reusable **typed data-collection workflows** composed from Components,
  Capabilities, **and other Tools**. A Tool has a typed result and is the unit an ODK
  form field hosts.

> **Components + Capabilities are primitives; Tools are recursively composable
> workflows.**

**There is no separate "recipe" concept.** Photo Capture, Video Capture,
Multi-Image Capture, Segmented Capture, and Segment & Measure are all **Tools** —
not recipes, and not special monolithic component variants. Tools compose primitives
and smaller Tools:

```text
Photo Capture Tool
→ CameraView + Flow
→ camera.capturePhoto
→ returns ImageAsset

Segmented Capture Tool
→ reuses Photo Capture Tool
→ image.segment
→ returns { image, mask }

Segment & Measure Tool
→ reuses Segmented Capture Tool
→ measure.*
→ returns typed measurements
```

**Composition is resolved at authoring/build time, not at runtime.** A Tool that
references another Tool is resolved by **inlining** the referenced Tool's composition
into the published artifact (while recording the reference's id + version so
dependency/version **provenance** is preserved). Do **not** introduce a nested-Tool
runtime abstraction unless later requirements justify it — this stays consistent with
the "establish the seam, defer the engine" stance on `ToolFlowController`.

> Note: the OpenCV operation "recipes" discussed in `v2-release-planning.md` are an
> unrelated concept (curated multi-op CV blocks / authoring tiers), not
> capture-workflow recipes; they are unaffected by this clarification.

## 1. Ownership rule

> If a primitive is part of the reusable Gather vocabulary exposed to Tool
> authors (the Composer agent), its declaration and canonical implementation
> belong in a **package**. `src/` consumes packages; it does not own Composer-visible
> primitives.

- `gather-catalog` — Composer-visible A2UI UI vocabulary (declarations + metadata) + Tool definitions.
- `gather-components` — Composer-visible reusable presentation (RN + RN-Web).
- `gather-capabilities` *(Phase 2)* — capability definitions + executable implementations.
- `src/components` — app-only React UI.
- `src/capabilities` — app-specific wiring only, or deleted.

Organize **by concept first, platform second**: `.native.js` / `.web.js` only at
irreducible device/DOM seams — never parallel `/native` and `/web` trees, never
`if (Platform.OS === 'web')` inside otherwise-shared code.

## 2. Target package layout (Phase 2+)

```text
packages/
├── gather-catalog/         A2UI declarations + authoring metadata + Tool definitions
├── gather-components/       shared RN / RN-Web presentation
├── gather-capabilities/     capability definitions + executable implementations   (NEW, Phase 2)
│   └── src/
│       ├── camera/{session, capturePhoto, recordVideo}/
│       ├── image/{segment, classify, threshold, morphology, connectedComponents, ...}/
│       ├── measure/{area, perimeter, centroid, ...}/
│       ├── definitions.js   (native-free aggregate)
│       ├── runtime.js       (executable registry, platform-resolved)
│       └── index.js
├── gather-storage/  odk-*  ...
src/
├── components/   app-only UI
├── capabilities/  app-specific wiring only (or removed)
└── a2ui/          thin app/renderer adapters + ToolFlowController
```

## 3. Inventory & classification

Legend: **app-only** · **component** (Composer-visible reusable) · **capability**
(reusable) · **seam** (irreducible platform) · **contract** (serializable data) ·
**obsolete/review**.

### 3.1 Already package-owned (`gather-components`) — keep, some rename

| File | Class | Phase 2+ action |
| --- | --- | --- |
| `components/capture/CaptureView.jsx` | component | **Rename → `CameraView`** (still-photo surface); keep shared presentation |
| `components/image/ImageOverlay.jsx` | component | keep |
| `components/results/OutputReview.jsx` (+ `outputSchema.js`, `ResultSection.jsx`) | component | keep |
| `components/results/{MeasurementResults,ClassificationResults,SegmentationResult}.jsx` | component | keep |
| `components/status/{ProcessingView,InstrumentError}.jsx` | component | keep |
| `components/actions/Button.jsx` | component | keep (themed RN Basic-Catalog Button impl) |
| `components/primitives.jsx`, `theme/*` | component | keep |
| *(new, Phase 4)* `CameraView`, `VideoView`, `MediaGallery` | component | add |

### 3.2 App camera code — consolidated into `gather-components/camera` (Phase 3 ✅)

| File | Class | Outcome |
| --- | --- | --- |
| `src/components/camera/CameraCapture.js` | seam (native, VisionCamera) | ✅ **moved** → `gather-components/camera/CameraView.native.jsx` |
| `src/components/camera/CameraViewport.js` | seam (native) | ✅ **moved** → `gather-components/camera/CameraDevicePreview.native.jsx` (shared by photo + video; frame-processor seam) |
| `src/capabilities/camera/capturePhoto.js` | native photo logic (no native import) | ✅ **moved** → `gather-components/camera/capturePhoto.js` |
| `apps/renderer/src/CameraSurface.web.jsx` | seam (web, getUserMedia) | ✅ **moved** → `gather-components/camera/CameraView.web.jsx` |
| `gather-components/.../capture/CaptureView.jsx` | shared presentation | ✅ **moved/renamed** → `gather-components/camera/CameraFrame.jsx` |
| `src/components/camera/CameraControls.js` | app UI (XForms) | stays app-side (XForms image control) |
| `src/components/camera/ImagePreview.js` | app UI (XForms) | stays app-side; prefer Basic Catalog `Image` later |
| `src/components/camera/QrScanner.js` + `src/capabilities/camera/scanResult.js` | app scan UI/helper | stays app-side (QR provisioning; scan is a separate concept) |

`VideoView` (`.native.jsx` VisionCamera / `.web.jsx` `MediaRecorder`) + shared
`RecordButton` were **added** in the same package folder. See §9.

### 3.3 Reusable capabilities (`src/capabilities`, `src/scientific`) — move to `gather-capabilities` (Phase 2)

| File | Current public name | Target public name | Notes |
| --- | --- | --- | --- |
| `capabilities/vision/index.js` `segment` | `vision.segment` | **`image.segment`** | ✅ moved to `gather-capabilities` (Phase 2); ML/OpenCV → metadata |
| `capabilities/vision/index.js` `classify` | `vision.classify` | **`image.classify`** | ✅ moved (Phase 2) |
| `capabilities/measure/index.js` | `measure.{area,perimeter,boundingBox,centroid,color,sharpness}` | unchanged | ✅ moved (Phase 2); quantitative meaning, source-independent |
| `capabilities/camera/capturePhoto.js` | `camera.capture` / `capturePhoto` | **`camera.capturePhoto`** | native VisionCamera photo output |
| `capabilities/camera/scanResult.js` | (helper) | camera/scan capability | reusable |
| `capabilities/location/*` | `location.getCurrentLocation` | keep `location.*` | establish from real capability |
| `scientific/runtime/{onnx*,openCv*,modelExecutor,modelTransforms}.js` | (impl) | `gather-capabilities/image` + `measure` impls (`.native`/`.web`) | native; stays behind platform seams |
| `scientific/models/*` | (impl) | `gather-capabilities` image-inference model store | |
| `scientific/contracts.js` | `ImageAsset`/`MaskAsset` creators | shared serializable contracts (package) | see §5 |
| `scientific/workflows/segmentAndMeasure.js` | (Tool result builder) | Segment & Measure **Tool** | Tool-specific typed result |

Namespace consolidation: **collapse `vision.*` → `image.*`**. ML vs OpenCV vs
heuristic is `kind`/`subcategory` metadata, not a public-id split.

### 3.4 App-only (stay in `src/components`) — no move

`Screen.js`, `NavButton.js`, `buttonPresentation.js`, `entities/*`, `forms/*`,
`maps/GatherMap.js`, `scientific/SegmentAndMeasureViews.js` (Tool glue).

> Watch: `NavButton.js` / `src/components/buttonPresentation.js` overlap the
> package `Button` + `theme/buttonPresentation`. Not Composer-visible, so they may
> stay, but flag for dedup if they diverge.

## 4. Capability definition schema (contract)

Every Composer-visible capability has **one portable definition colocated with its
implementation**. Definitions are **native-free**: importable by the Composer agent
without pulling VisionCamera / onnxruntime / OpenCV / DOM camera APIs.

```js
defineCapability({
  id: 'image.segment',        // stable dotted semantic id (domain.operation)
  version: 1,                 // integer contract version

  title: 'Segment image',
  description: 'Generate a segmentation mask for an image.',

  group: 'Image',             // Composer grouping
  subcategory: 'Analysis',    // e.g. Analysis | Processing | Acquisition
  kind: 'inference',          // 'inference' | 'processing' | 'heuristic' | 'device'

  input: SegmentInputSchema,  // serializable-in contract (zod or JSON Schema)
  output: SegmentationResultSchema, // serializable-out contract

  platforms: ['android', 'ios', 'web'],
  preview: 'live',            // optional authoring hint

  examples: [/* ... */],
})
```

Camera/acquisition definitions may additionally declare:

```text
requiresUserActivation: true      // needs a user gesture
requiresContext: 'camera-session' // resolves against an active CameraView/VideoView session
recommendedComponent: 'CameraView'
```

Package split (Phase 2):

- `definitions.js` — aggregates **definitions only**; must not import native/DOM deps.
- `runtime.js` — builds the executable registry from each capability's
  platform-resolved `implementation.native.js` / `.web.js` / `.js`.
- Entry points (conceptual): `@gather/capabilities/definitions`, `@gather/capabilities/runtime`.

Field names may adapt to the codebase; the **information boundary** (native-free
definitions vs. executable runtime) is the contract.

## 5. Serializable asset contracts

Capabilities and Components exchange **durable serializable data**, never native
objects (no VisionCamera refs, MediaStream, ONNX tensors, OpenCV Mats). No base64
media payloads through A2UI data models — pass a stable local reference.

### ImageAsset — confirmed (implemented in `src/scientific/contracts.js`)

| Field | Type | Notes |
| --- | --- | --- |
| `assetId` | string | stable id |
| `uri` | string | local reference |
| `path` | string | durable local path |
| `width`, `height` | positive int | |
| `mimeType` | string | default `image/jpeg` |
| `sha256` | `sha256:<hex>` | content digest |
| `orientation` | string \| null | |
| `capturedAt` | string \| null | ISO-8601 |

### MaskAsset — confirmed

`assetId, uri, path, width, height, format (default binary-png), sha256,
sourceImageAssetId`.

### VideoAsset — specified (implement when video capture lands, Phase 4)

Mirror `ImageAsset` for parity; add duration, make pixel dims optional:

| Field | Type | Notes |
| --- | --- | --- |
| `assetId` | string | stable id |
| `uri` | string | local reference |
| `path` | string | durable local path |
| `mimeType` | string | default `video/mp4` |
| `durationMs` | positive int | recording length |
| `width`, `height` | positive int \| null | optional |
| `sha256` | `sha256:<hex>` | content digest |
| `capturedAt` | string \| null | ISO-8601 |

Multi-image working state is conceptually `ImageAsset[]`; final Tool output carries
the collection or a selected subset per the Tool's result schema.

Ownership: **resolved 2026-09-01** — see
[contract-ownership-audit.md](./contract-ownership-audit.md). The interim owner is
`gather-capabilities` (hermetic, already holds the schemas, already an app
dependency); a separate `gather-contracts` package is deferred until
`gather-models` is extracted, which is the point the Models↔Capabilities edge
becomes unavoidable. Components stay duck-typed and must not import the schemas.
Until the moves land, the constructors remain in `src/scientific/contracts.js`
alongside the package schemas, guarded by parity tests.

## 6. Flow / View / ToolFlowController — confirmed (implemented)

The `Step → View` rename is complete and green:

- **`Flow`** (`gather-catalog` + `gather-components`): given an externally
  controlled active token, renders exactly one child View. Schema
  `Flow { current: DynamicString, views: [{ when, view: ComponentId }], fallback? }`;
  selection is the shared, drift-proof
  [`resolveFlowView`](../packages/gather-catalog/src/flow.js). Flow owns no
  capability execution, transitions, guards, or persistence.
- A **View** is any named presentation container the `views[]` table points at
  (today: `Column`s such as `captureView` / `reviewView`). No separate `View`
  component is introduced unless a reusable need appears.
- **`ToolFlowController`** ([toolFlowController.js](../src/a2ui/toolFlowController.js)):
  the minimal orchestration seam — owns the active view token, routes Tool events
  to bespoke handlers, and tells `Flow` which View is active. **Not** a statechart;
  no generic engine is built until the branching tripwire (≥2 Tools needing
  meaningful branching/retry) is met.

Canonical boundary: *Component emits semantic event → ToolFlowController decides →
Capability executes → typed result enters Tool working data → controller sets the
active View → Flow renders it.*

## 7. Phase 2 — landed (2026-09-01): `gather-capabilities` (image + measure)

The `gather-capabilities` package now owns the reusable M8 image/measure
capabilities.

- **Package** `packages/gather-capabilities` with `defineCapability`, native-free
  `contracts.js` (zod io schemas + `IMAGE_TASK_PROFILES`), and `errors.js`
  (`CapabilityError`). Added to the root `test:packages` loop and app deps.
- **Concept-first folders**: `image/segment`, `image/classify` each with
  `definition.js` + `implementation.js` + `index.js`; `measure/` with
  `definitions.js` (six facets) + `implementation.js`. (Measure uses one folder
  rather than six micro-folders — the facets share one geometry adapter; still
  concept-first.)
- **`vision.* → image.*`** consolidation: `image.segment`, `image.classify`.
- **`definitions.js`** aggregates native-free definitions;
  `describeCapabilities()` yields plain metadata (no zod/functions) for the
  Composer agent. Only implemented capabilities are advertised, and a test asserts
  the advertised ids equal the executable `runtime.js` keys.
- **`runtime.js`** (`createCapabilityRuntime`) binds implementations to
  app-injected engines (`segmentExecute`/`classifyExecute` inference runners,
  `measurementAdapter`); no native module is imported by the package.
- **App rewire**: [GatherProvider.js](../src/context/GatherProvider.js) imports
  `segment`/`classify`/`measureMask`/`measureImage` from `gather-capabilities`;
  `src/capabilities/vision` and `src/capabilities/measure` are deleted.

**Key decision — model handling (Option B).** To keep the package decoupled from the
`src/scientific` model subsystem, the capability receives the app-computed
serializable **`modelRef`** (produced by `createScientificModelRef`, still owned by
the app) and echoes it into the result for provenance; the opaque `model` is passed
only to the injected `execute`. This preserved the exact result shape **without**
moving `src/scientific/contracts.js` / `modelPackage.js` (their 12 consumers are
untouched). Relocating the shared asset/model contracts into a package remains a
**future** step (§5), not required for Phase 2.

Verified: `test:packages` green (8 packages, incl. 14 new capability tests);
Android Hermes export green (Metro resolves the app's `gather-capabilities` import);
renderer build green.

## 8. Explicitly deferred (later phases)

- Relocate shared **asset/model contracts** (`ImageAsset`/`MaskAsset`/`VideoAsset`,
  model ref/validation) into a package-owned native-free contracts module (future;
  §5). See the **[`src/scientific` ownership & dependency audit](./scientific-directory-audit.md)**
  for a file-by-file map of the model lifecycle, execution backends, provenance,
  generic asset storage, and the Segment & Measure Tool that currently live under
  `src/scientific`, plus whether a future `gather-models` package is justified.
- **Camera consolidation (Phase 3, revised — see §9).** Move the reusable camera
  presentation + `.native`/`.web` seams into `gather-components/camera`; keep
  acquisition **Component-owned** (`CameraView` → `ImageAsset`, `VideoView` →
  `VideoAsset`); add `VideoView`; consolidate permission ownership; preserve an
  internal frame-processor extension seam. **No** `CameraSession` registry and **no**
  session-backed `camera.*` capabilities (superseded — §9). `src/capabilities/location`
  stays app-side.
- `MediaGallery` (Phase 4).
- Photo Capture, Video Capture, and Multi-Image Capture **Tools** (Phase 5) —
  composed from Components + Capabilities (+ smaller Tools), resolved by
  authoring/build-time inlining with dependency/version provenance.
- Composer exposure of definitions + catalog + **Tool** definitions (Phase 6).
- Migrate the Segment & Measure **Tool** onto the new naming/boundaries; it reuses
  the Segmented Capture Tool, which reuses the Photo Capture Tool (Phase 7).

## 9. Phase 3 decision (2026-09-01): Component-owned camera; no `CameraSession`

**Superseded:** the earlier plan for an internal shared `CameraSession`
registry/resolver and public `camera.capturePhoto` / `camera.recordVideo`
capabilities that resolve an ambient mounted session. It is **not** being built —
the benefit did not justify the extra lifecycle, coupling, native dependency, and
maintenance surface.

**Boundary (revised):**

```
Components   own interactive acquisition experiences
CameraView   owns live photo camera lifecycle → emits serializable ImageAsset
VideoView    owns live video lifecycle        → emits serializable VideoAsset
Capabilities reusable semantic ops over data (image.* / measure.*), serializable in/out
```

The mounted camera Component keeps owning permission, live preview, the
VisionCamera/`getUserMedia` lifecycle, shutter/recording, flash/torch, focus/zoom,
lens switching, and capture, and emits **plain serializable assets**.

**Do NOT build:** a global/module `CameraSession` registry; session-id lookup through
Tool state; camera session handles in A2UI; `camera.capturePhoto` / `camera.recordVideo`
resolving an ambient mounted session.

**Why.** A session-backed `camera.capturePhoto` would carry a hidden runtime
dependency (`serializable request + mounted CameraView + correct live session +
permissions + registry lifecycle → ImageAsset`), materially unlike clean data
capabilities (`image.segment(ImageAsset, ModelRef) → SegmentationResult`). Guiding
principles:

> Internal implementation reuse and public composability do not have to use the same
> abstraction.

> Interactive acquisition that intrinsically depends on a mounted device surface
> belongs to the Component; reusable operations over resulting data belong to
> Capabilities.

> A reusable algorithm does not imply reusable ownership of the live device resource.

**Revised Phase 3 plan:**

1. Consolidate reusable camera implementation into package ownership
   (`gather-components/camera`).
2. Preserve the established `.native` / `.web` platform seam (VisionCamera vs
   `getUserMedia`/`MediaRecorder`).
3. Keep photo acquisition Component-owned; `CameraView` emits `ImageAsset`.
4. Add a separately composed `VideoView` that emits `VideoAsset` (new;
   implements the Phase-1 `VideoAsset` contract).
5. Share underlying camera implementation between `CameraView`/`VideoView` where
   natural (no public/global session abstraction).
6. Consolidate permission ownership rather than duplicating it.
7. Preserve an internal extension seam for future VisionCamera frame
   processors / live overlays (structure only; no live-analysis API yet).
8. Do **not** introduce a cross-component `CameraSession` registry/resolver.
9. **Tripwire:** introduce a session/service abstraction only if a real non-owner
   consumer must programmatically control an already-mounted camera.
10. Validate: browser preview + physical iOS/Android photo & video capture.

**Future live-CV extension point (not built now).** VisionCamera frame processors
stay owned/attached by the mounted `CameraView`; native `Frame`/worklet objects must
never cross the Tool/A2UI contract. A future declarative shape may look like
`CameraView { liveAnalysis: { capability: image.detect, model: $models.detector,
overlay: boundingBoxes } }`, internally: `CameraView → frame processor → reusable
image-analysis impl → lightweight result → live overlay`. That semantic CV impl may
**share code/models/contracts** with `image.*`, but `CameraView` remains owner of the
frame stream and live invocation lifecycle. Phase 3 only ensures the internal camera
architecture leaves a clean attach point.

Camera files to consolidate (from the audit + camera code): `src/components/camera/{CameraCapture,CameraViewport}.js`
and `src/capabilities/camera/capturePhoto.js` → `gather-components/camera` `.native`
seam; `apps/renderer/src/CameraSurface.web.jsx` → the `.web` seam; the shared frame/
shutter/permission presentation (today `gather-components` `CaptureView.jsx`) becomes
the shared `CameraView` presentation.

### Phase 3 — landed (2026-09-01)

`gather-components/src/camera/` now owns the camera surface, resolved per platform by
the bundler (Metro → `.native.jsx`, Vite → `.web.jsx`; VisionCamera is kept out of the
web bundle):

- **`CameraFrame.jsx`** — shared presentation (moved/renamed from `CaptureView`), with
  an optional `control` slot so video reuses the frame.
- **`CameraView.native.jsx`** (VisionCamera permission + photo output + capture; from
  `CameraCapture`) and **`CameraView.web.jsx`** (getUserMedia + canvas; from the
  renderer's `CameraSurface.web`). Photo acquisition stays **Component-owned** and
  emits a plain serializable capture via `onCapture` (durable `ImageAsset` is the
  storage layer's job). `capturePhoto.js` (no native import) moved alongside.
- **`CameraDevicePreview.native.jsx`** — shared native `<Camera>` preview for photo +
  video, with a `frameProcessor` **extension seam** (no live-analysis API wired).
- **`VideoView.native.jsx`** (VisionCamera ref recording) + **`VideoView.web.jsx`**
  (`MediaRecorder`) + shared **`RecordButton`** — new; emit a plain video capture via
  `onRecord` (durable `VideoAsset` is the storage layer's job).
- Barrel `camera/index.js` exports `CameraView`/`VideoView` via **extensionless**
  specifiers (that is what triggers platform resolution). `gather-components` gains a
  `react-native-vision-camera` peer dep.
- Consumers rewired to the shared `CameraView`: `SegmentAndMeasureViews`,
  `XFormsImageControl`, and the renderer's `GatherCapture`. Old native/web camera
  files deleted; `src/capabilities/camera` keeps only `scanResult` (QR).

**No `CameraSession` registry, no `camera.*` capabilities** (per the decision above).
Verified: `test:packages` green (8 packages); renderer Vite build green (web seam, no
VisionCamera pulled); Android Hermes export green (native seam bundles VisionCamera).
**Device validation still required** — physical iOS/Android photo capture and video
recording, plus a browser preview check. The `VideoView.native` recording path uses
the standard VisionCamera ref API and builds cleanly but is **device-validation
pending** (also needs microphone-permission handling on device).

#### Phase 3 review — three boundary clarifications to converge in the next pass

These do not change Phase 3 behavior; they pin down the *contracts* so Phase 4/5
(Tools + Composer exposure) land on an unambiguous boundary.

**1. Public output contract — descriptor → asset service → typed asset (current), converging on `ImageAsset` / `VideoAsset`.**
Today the components emit a **raw platform capture descriptor**, and the app's asset
service materializes the durable, typed asset one layer later:

```
CameraView.onCapture  → { uri, path, contentType, width, height }
VideoView.onRecord    → { uri, path, mimeType, durationMs, width, height }

raw capture descriptor
  → imageAssetService.persistCapture()  (reads capture.path, hashes bytes)
  → ImageAsset            (createImageAsset in src/scientific/contracts.js)

(video has no producer yet → VideoAsset is specified but unmaterialized)
```

This "descriptor → asset service → asset" split is the deliberate, temporarily-fine
model. The **eventual Tool-facing boundary must be unambiguous**:

```
CameraView → ImageAsset
VideoView  → VideoAsset
```

> The Composer and Tool contracts must never see raw, platform-specific URI shapes
> (`data:` URLs, `file://` temp paths, object URLs). Those are private to the
> component↔asset-service seam. A Tool consumes `ImageAsset` / `VideoAsset` only.

Open items feeding this convergence (tracked in `contract-ownership-audit.md`):
`VideoAsset` has **no producer** yet (don't relocate a producer-less contract);
`ImageAsset` has a constructor (`src/scientific`) and an unparsed zod schema
(`gather-capabilities`) that still need a parity test. When video capture lands
(Phase 4/5), add a `videoAssetService.persistRecording()` mirroring the image path so
`VideoView` converges on `VideoAsset` the same way `CameraView` converges on `ImageAsset`.

**2. `CameraFrame` / `CameraDevicePreview` / `RecordButton` / `capturePhoto` are internal, NOT Composer-visible.**
Only the acquisition Components are authoring surfaces; the rest are shared
implementation/presentation primitives with no independent authoring use case:

```
Composer-visible (Tool-authorable)      internal / shared implementation
  CameraView                              CameraFrame          (frame + shutter slot)
  VideoView                               CameraDevicePreview  (native <Camera> preview)
                                          RecordButton         (video shutter control)
                                          capturePhoto         (photoOutput → descriptor)
```

Phase 6 (Composer exposure) must advertise **only** `CameraView` / `VideoView` from the
camera folder. Do not expose `CameraFrame` unless a concrete authoring case appears
(a Tool that needs the frame chrome without owning acquisition — none known today).

**3. Cleanup radar — the `camera` capability namespace is now misleading.**
After Phase 3, `src/capabilities/camera` retains only `scannedCodeValue` (picks the
first string `rawValue`/`displayValue` from native barcode objects — pure QR/barcode
result decoding, no camera acquisition). Acquisition is entirely Component-owned now,
so the surviving concern is really code/barcode processing. Not renaming impulsively,
but a future home is likely a scan/code namespace rather than `camera`:

```
scannedCodeValue  →  code.scan / barcode.parse / qr.decode  (capability, when scanning is generalized)
```

Defer until scanning is treated as a first-class capability; revisit alongside the
`gather-models` / contracts-split work.

### Phase 4 — landed (2026-09-01)

**Components.** Design-doc items 15/16/18 were already satisfied by Phase 3 (`CameraView`
consolidated, `VideoView` distinct, `.native`/`.web` seams clean). The one new build was
item 17: **`MediaGallery`**.

`MediaGallery` (`gather-components/src/components/media/`) is a **Composer-visible,
presentation-only** surface over a collection of durable media assets — **photos and
videos**:

- **Thumbnail grid** (`MediaThumbnail.jsx`, shared): photo/poster still, a **play badge**
  for video items, optional per-tile **select** (checkbox), **remove** (✕), and
  **reorder** (‹ ›) affordances.
- **Built-in viewer modal** (`MediaViewer.jsx`, shared RN `Modal` chrome) with a
  **platform-seamed media surface** (`MediaSurface.web.jsx` = raw `<video controls>` /
  `<img>`, no dep; `MediaSurface.native.jsx` = `expo-video` playback / RN `<Image>`).
  Photos display; videos play.
- **Props:** `items`, `allowSelect`, `allowRemove`, `allowReorder`, `selectedItem` /
  `selectedItems`, `columns`, plus `onSelect` / `onRemove` / `onReorder` / `onBack` /
  `onDone` and label/empty-state overrides.
- **Events:** `select`, `remove`, `reorder` (emits the reordered array + `{from,to}`),
  `back`, `done` — plus internal viewer open/close it owns itself.
- **Does NOT:** open the camera, capture, persist native objects, advance ODK, invoke
  segmentation, or own Tool orchestration (per design-doc §10).

**Duck-typed, not contract-coupled.** Items are read for display only (`uri`, optional
`width`/`height`/`mimeType`/`durationMs`/`posterUri`/`mediaType`); the render-free model
helpers (`mediaModel.js`: `normalizeMediaItems`, `selectionKeySet`, `moveItem`,
`mediaKind`, `mediaPosterUri`) carry the testable logic. This honors the contract-audit
rule that **Components stay duck-typed and must not import the asset schemas** — so the
deferred `ImageAsset`/`VideoAsset` convergence (Phase 5) requires no gallery change.

**New native dependency:** `expo-video ~57.0.3` (SDK-pinned via `expo install`), added as a
`gather-components` peer dep, config plugin registered in `app.config.js`. It is imported
**only** in `MediaSurface.native.jsx`, so the web bundle never pulls it. **Non-blocking**
(you OK'd necessary native deps in Phase 3); inline native video playback is
**device-validation pending**, mirroring `VideoView.native`.

**Superseded criteria explicitly skipped.** The design doc's session-era acceptance
lines (`camera.recordVideo` against an active `VideoView` session; a shared live-device
session abstraction) were killed in Phase 3 and are not implemented.

**Composer visibility (extends the Phase 3 review table):** `MediaGallery` is
**Composer-visible**; `MediaThumbnail` / `MediaViewer` / `MediaSurface` (+ `mediaModel`)
are **internal** implementation primitives.

**Verified:** `test:packages` green (8 packages, `fail 0`; +8 `mediaModel` tests, 14 in
`gather-components`); renderer Vite build green (837 modules; `expo-video` not pulled —
web seam used); Android Hermes export green (1458 modules; native seam resolves
`expo-video`). **Deferred to Phase 5:** `CameraView → ImageAsset` / `VideoView →
VideoAsset` convergence + `videoAssetService`, and the `ImageAsset` ctor↔zod parity test.

## 10. Phase 5 decisions (2026-09-01): Tools, hosting, and the ODK proof gate

> **Partly superseded — see [§11](#11-architecture-reconciliation-2026-09-01-tool-is-not-a-runtime-species).**
> The ownership calls, the URI-portability semantics, and the mobile Basic
> Catalog decision all stand. What is superseded is treating ordinary Photo
> Capture as a first-class Tool, the `ToolHost`/`ToolFlowController` naming, and
> the ODK gate hosting the Photo Capture Tool. The revised gate proves the
> Phase 3 boundary directly: `XFormsImageControl` → package-owned `CameraView` →
> serializable capture → `ImageAsset` → existing attachment path. End-to-end
> composition→ODK integration becomes a separate gate using a workflow that is
> unquestionably one, with Segment & Measure the reference candidate. Retained
> below as the reasoning that led there.

Settled before implementation, after a review that found three things the design
doc (2026-09-01) predates. Recorded here so they are not implicit in the code.

### Three architectural clarifications

**1. Upstream Basic Catalog implementations are renderer-owned.** The
"package-owned" rule in §1 applies to **Gather-defined Composer primitives**
(`Flow`, `CameraView`, `VideoView`, `MediaGallery`, `ImageOverlay`,
`OutputReview`). `Image`, `Video`, `Text`, `Button`, `Column` are **upstream A2UI
vocabulary** that our mobile renderer must support:

```text
gather-components      canonical implementations of Gather-specific Components
src/a2ui/mobile        mobile renderer implementations of upstream Basic Catalog
```

The upstream catalog already declares `Image { url, description, fit }` and
`Video { url }`; the web renderer gets both from `@a2ui/react`. Mobile
implemented only `Column`/`Text`/`Button`, so a review View using Basic `Image`
would render on web and **blank on device**. The fix is a mobile implementation,
**not** a Gather `ImagePreview` — inventing a Gather component because mobile
lacks an upstream one would work directly against the abstraction.

**2. `ToolHost` generalizes hosting, not orchestration.** Tool-specific
controllers keep workflow meaning until the orchestration tripwire is met:

```text
Generic ToolHost                 A2UI/runtime machinery (catalog, processor,
        ↓                        surface, action-handler wiring, result delivery)
Tool-specific controller         what this Tool's events mean
        ↓
minimal ToolFlowController       which View is active
```

The host must **not** grow a declarative transition table or workflow schema —
that would cross the tripwire deferred in the
[orchestration ADR](./a2ui-v1.0-migration-notes.md#adr-2026-09-01-tool-orchestration--establish-the-seam-now-build-the-engine-later)
by the back door.

**3. The Tool architecture is not proven until a typed Tool result crosses back
into a real ODK/XForms field.** `XFormsImageControl` today is a hand-coded Photo
Capture Tool (`CameraView` → app-local `ImagePreview` → Accept/Retake). Until it
hosts the real Tool and its accepted `ImageAsset` enters the existing attachment
path, the central integration claim stays conceptual. This is an explicit gate,
not a cleanup task.

### Ownership calls

| Question | Decision |
| --- | --- |
| Mobile Basic `Image`/`Video` | Implement in `src/a2ui/mobile` (renderer-owned). No Gather display shim. |
| Multi-image cardinality | **Tool configuration**, immutable, passed to the controller (`createMultiImageCaptureController({ minItems, maxItems })`) — not mutable data-model state, and never known to `CameraView`. |
| `CameraView` affordances | May later gain `captureCount`, `latestCapture`, `showCaptureCount`, `showThumbnail`, `onOpenGallery` — intrinsic camera interaction. It must never learn `minItems`/`maxItems`/gallery contents/Tool completion. Multi-Image is therefore a real Component change, not pure composition. |
| `onAcceptedResult` | Becomes real at the ODK gate. `ToolHost` **owns delivery**; the embedding host owns **interpretation/persistence**. |
| `VideoAsset` producer | Not solved opportunistically inside `VideoView`. It keeps emitting a raw serializable capture descriptor until the generic media-asset persistence seam is established deliberately (see [contract-ownership-audit.md](./contract-ownership-audit.md)). |
| Tool home | `packages/gather-catalog/src/tools/` mirroring the Segment & Measure reference (instrument definition + its `VIEWS` constant). These are **Tools**, not the design doc's "recipes". |
| `camera.*` capabilities | Stay dead. Phase 3 made acquisition Component-owned; Phase 5 must not reintroduce them. The real path is `CameraView.onCapture` → controller persists → typed asset. |

### Asset URI portability — intended, not a defect

`ImageAsset.uri` is a **runtime-local renderable locator**, not a portable value:

```text
native   file://...
web      blob:... / data:...
```

What is portable is the **shape and meaning** of the contract, not the URI
string. Composer preview operates on a browser-local asset; the device operates
on a durable one. **Semantic parity ≠ identical URI values.** Recorded so nobody
later "fixes" the difference; the parity test should assert the shape and
explicitly not the locator.

### Sequence (gates are hard stops)

```text
0. Mobile Basic Catalog Image                     renderer-owned
1. ImageAsset ctor↔zod parity test                cross-runtime shape
2. Extract/generalize ToolHost                    hosting only
3. Photo Capture Tool                             Flow ├ CameraView
                                                       └ review ├ Basic Image
                                                                ├ Accept
                                                                └ Retake
4. Verify typed ImageAsset completion through ToolHost
   ── PAUSE / REVIEW ──
5. ODK integration gate: XFormsImageControl hosts the Photo Capture Tool;
   accepted result enters the existing attachment/submission path;
   full M5 regression + device tests
   ── PAUSE / ARCHITECTURE REVIEW ──
6. Then choose Multi-Image or Video Capture
```

Multi-Image and Video are comparable follow-ons, not one obviously cheaper:
Multi-Image needs `CameraView` affordances + `MediaGallery` catalog registration
+ cardinality + list state; Video needs a `VideoAsset` producer + mobile Basic
`Video` + review/accept. Slight preference for **Multi-Image first** (exercises
composition more deeply while staying in the proven image-asset domain), but not
an architectural requirement. Order decided after the ODK gate.

**Why the ODK gate comes before both:** if Photo Capture cannot cleanly replace
the existing XForms path, we want to know that before building a larger Tool
ecosystem on the same assumptions.

### Phase 5 steps 0–4 — landed (2026-09-01); PAUSE before the ODK gate

**Step 0 — mobile Basic Catalog `Image`.** `InstrumentSurface.js` (122 lines) split
three ways: surface/binding machinery (58), `basicCatalog.js` (upstream A2UI
implementations), and render-free `basicCatalogModel.js`. The third split was
forced — Node cannot parse JSX, so testable helpers must sit outside the
component module, the same `mediaModel.js` convention `gather-components` uses.
`fit` maps to RN `resizeMode` (`scaleDown` → `contain`, a documented
approximation); the aspect ratio resolves from the load event behind a stable
placeholder. No Gather `ImagePreview` was created.

**Step 1 — contract parity.** `test/scientific/contract-parity.test.mjs` asserts
constructed `ImageAsset` / `MaskAsset` / `ModelRef` satisfy the advertised zod
schemas, and that `TASK_PROFILES` deep-equals `IMAGE_TASK_PROFILES`. Per the
recorded semantics it asserts **shape, never the locator** — one case runs
`file://`, `blob:` and `data:` URIs through the same schema to lock that in.

**Step 2 — `ToolHost`.** Split into render-free `src/a2ui/toolRuntime.js`
(catalog + processor + action routing + surface) and the thin React
`src/a2ui/mobile/ToolHost.js`. The runtime being JSX-free is what lets a Tool be
driven end-to-end in tests. Hosting only: no transition table, no workflow schema.

**Step 3 — Photo Capture Tool.**
[`packages/gather-catalog/src/tools/photoCapture.js`](../packages/gather-catalog/src/tools/photoCapture.js)
— 15 components, `Flow` over capture / working / review / error, review built
from upstream Basic `Image` + `Button`s. `CameraView` is now real Composer
vocabulary (catalog id, schema, regenerated artifact, mobile **and** web
implementations). Workflow meaning lives in
`src/a2ui/photoCaptureActionHandler.js`, curried so capabilities bind once and
the result matches the `createActionHandler({ processor, onAcceptedResult })`
shape `ToolHost` calls.

**Step 4 — verified.** `test/a2ui/photo-capture-tool.test.mjs` drives the real
Tool through the real runtime headlessly: capture → working → review, the typed
`ImageAsset` reaching `onAcceptedResult`, accept-before-capture erroring rather
than silently completing, retake recovery from the error View, and `root.children`
byte-identical across a full cycle (host stays value-only).

**Component API/implementation split.** Component *declarations* moved to
render-free `src/a2ui/mobile/componentApis.js`; `basicCatalog.js`,
`gatherComponents.js`, and `segmentAndMeasureComponents.js` now hold
implementations only. The generic Gather components moved out of the
S&M-named module into `gatherComponents.js`, so Segment & Measure composes the
shared set plus its own legacy `GatherCapture` rather than owning them.

**Verified:** `test:unit` 317 tests / 316 pass / 0 fail (1 known skip); Expo
config; renderer Vite build; Android Hermes export; `git diff --check`; and a
parity check that all seven Gather component ids resolve in catalog + mobile +
web. **Not verified:** on-device rendering of the Tool — `ToolHost`'s React
wrapper and the mobile `Image` are exercised only on a device, which the ODK gate
(step 6) will do.

**Next: the ODK integration gate.** Nothing is proven end-to-end until
`XFormsImageControl` hosts this Tool and its accepted `ImageAsset` enters the
existing attachment path.

## 11. Architecture reconciliation (2026-09-01): Tool is not a runtime species

Steps 0–4 are kept. What changes is the **framing**: we were forcing every
reusable interaction upward into the highest-level abstraction available, and
drifting toward a mini application framework (`ToolHost`, `ToolController`, a
Tool package, Tool instances). This backs that out without discarding the work.

### The rule

> **Components are code; composition *structure* is data.**

Deliberately not "compositions are data" — see the known limitation below.

| | |
| --- | --- |
| **Components** | Reusable interaction/presentation shipped as **code**. May contain other Components, hold internal state, have multiple internal screens, use semantic processing, and use runtime/platform services. Emit typed values. |
| **Capabilities** | Reusable semantic operations with portable contracts. **Not** a taxonomy mechanism — whether something invokes a Capability does not decide its category. |
| **A2UI compositions** | Declaratively **authored** structure: Components, `Flow`/Views, bindings, actions. |
| **`Flow`** | The A2UI authoring primitive for selecting among authored Views. **Not** a general React view-switching primitive. |
| **A2UI host/runtime** | Generic machinery for executing an A2UI surface. Says nothing about what the hosted definition *is*. |
| **Tool** | Optional **product language** for a useful reusable authored composition. It has no distinct runtime, package, or artifact model. |

### Why the earlier criteria failed

- **"Multiple Views ⇒ Tool"** keys on structure, which is an implementation
  property. A date-range picker has internal navigation and is still one input.
- **"Invokes Capabilities ⇒ Tool"** breaks on real cases: a `CameraView` running
  live detection for a bounding-box overlay is still a camera, and
  `MultiImageCapture` must not change category because we renamed a host service
  into a Capability. A taxonomy that flips on a rename is not describing anything.

What survives is **ownership and authorability**: a Component is shipped
behavior an author configures; a composition is authored structure.

### Consequences

**`CameraView` / `MediaGallery` / `MultiImageCapture` are all Components.**
A Component using semantic processing or platform services internally is normal.

**Convenience Components must not hide the primitives beneath them.**
`MultiImageCapture` (if added) is a convenience over `CameraView` +
`MediaGallery`, which stay independently Composer-visible. That is the escape
hatch: the common case configures one Component; a custom interaction composes
the primitives in an authored surface. It is what keeps the choice reversible.

**Promotion signal.** If authors repeatedly need structural variants of a
Component that require us to ship code, that behavior is no longer stable enough
to encapsulate and should move into authored composition.

**Cardinality.** `minItems`/`maxItems` are Component *inputs* because they affect
interaction (max reached → disable capture; min reached → allow completion).
Ownership of the underlying rule belongs to the host — a composition's config, or
XForms constraint/repeat semantics via an adapter — so there is one source of truth.

**Ordinary photo capture is not an architectural species.** A photo field uses
`CameraView` directly (`XFormsImageControl`).

### Known limitation — composition behavior is not yet declarative

Composition *structure* is data. Composition *behavior* is still partly code:
Segment & Measure relies on a composition-specific handler
(`capabilityActionAdapter.js`).

**The orchestration tripwire has NOT fired.** Segment & Measure is currently the
only genuine production authored composition; the Photo Capture handler belongs
to a test fixture and must not be counted as a second instance — that would be
using a fixture to justify the infrastructure the fixture caused us to build.

> **Deferred:** when a second genuine authored composition requires substantial
> bespoke view/action orchestration, compare the handlers and extract the
> smallest common declarative behavior model. Not before — we do not yet know
> whether the answer is a few generic action primitives or something larger.

### Observed possible simplification — deferred

Action routing currently has three layers:

```text
MessageProcessor → composition-specific handler → FlowController.dispatch → handlers[event]
```

`FlowController`'s own `dispatch` is a one-line map lookup; the only state it
owns is the active view. **Reassess when another production authored composition
exists; do not alter the production Segment & Measure path for theoretical
cleanup.**

### Naming applied

| Was | Now | Why |
| --- | --- | --- |
| `ToolHost` | `A2UIHost` | hosts an A2UI surface, whatever product concept it represents |
| `createToolRuntime` / `toolRuntime.js` | `createA2uiRuntime` / `a2uiRuntime.js` | same |
| `createToolFlowController` / `toolFlowController.js` | `createFlowController` / `flowController.js` | owns only active View selection for a `Flow` |
| `PHOTO_CAPTURE_TOOL` in `gather-catalog/src/tools/` | `PHOTO_CAPTURE_DEFINITION` in `test/fixtures/photo-capture/` | deterministic test material, not published vocabulary |
| `src/a2ui/photoCaptureActionHandler.js` | `test/fixtures/photo-capture/actionHandler.mjs` | travels with the fixture; leaving it in `src/` preserved the implication we are removing |

`CameraView` stays production and Catalog-visible — its value does not depend on
Photo Capture existing.

### Not a real system yet

`.gather` has **zero references in the repo**. A published-artifact format is a
possible future requirement, not existing architecture, and no format name is
canonized. "Tool" costs nothing precisely because nothing implements it; keep it
that way until packaging is a real requirement.

## 12. Multi-image capture + camera slots — decision (2026-09-01)

Multi-image capture is a **known downstream collection requirement**, not a
speculative addition. This pins *how* it is constructed. Implementation deferred
until after the ODK gate.

### `MultiImageCapture` is a compound Component

In `gather-components`, alongside its constituents. Internal view switching uses
ordinary React state — **not `Flow`**, which is the A2UI authoring primitive and
would mean embedding an A2UI surface inside a Component to toggle two children.

### Contract: controlled collection + injected persistence

```text
value: ImageAsset[]                    onChange(next)
persistCapture(descriptor) → Promise<ImageAsset>
minItems, maxItems, allowRemove, allowReorder
```

The Component owns **view state only**; the host owns the array.

**Why controlled.** `instanceLifecycleService.resume()` reloads drafts
mid-instance. If the collection lived in component state, a researcher who
captured three of four photos and left the form would lose them. The value has
to be owned outside the Component — a field requirement, not a preference. It
also matches `MediaGallery`, which is already fully controlled (`items` +
`onRemove`/`onReorder`/`onDone`, owning no collection state).

**Why `persistCapture` injection is not "storage in a presentation Component".**
`CameraView`'s job is acquisition, so minting an `ImageAsset` would give it a
durability concern it does not need. `MultiImageCapture`'s job *is* managing a
collection of durable assets, so durability is intrinsic to its contract. It
receives a **function** — no file keys, no `gather-storage`, no knowledge of
where bytes go — and awaiting it is what lets it show per-photo progress.
`persistCapture` is environment/service injection and stays out of serialized
Component props.

Rejected: *uncontrolled, emits on done* (loses drafts); *descriptor-only* (every
host reimplements append, with no boundary gain).

### Camera slot architecture

`CameraFrame`'s existing `control` prop **replaces** the shutter — it is what
`VideoView` uses to swap in `RecordButton`. Multi-image needs the capture count
and latest thumbnail **alongside** the shutter, so:

- add an **additive** slot to `CameraFrame` (accessory position, not a replacement);
- have `CameraView` forward it.

`CameraView` gains a presentation slot, not knowledge of galleries. It still
must never learn `minItems`/`maxItems`, gallery contents, or completion.

### Why this route needs nothing from the deferred orchestration work

**The handler gap is a composition problem, not a Component problem.** A
composition needs bespoke host code because its behavior is authored per
instance; a Component's action semantics are fixed and ship *with* it. So
`MultiImageCapture`'s A2UI action handler is written once, by us, alongside the
Component — the orchestration tripwire stays untouched.

### Build order (after the ODK gate)

> **Unblocked 2026-09-02** — the storage fix has landed (migration 10 +
> `imageFilenameForCapture` + regression tests); step 0 below is done. Original
> finding: the repeat-media identity spike
> found that media identity derived from the XForms binding reference is unique
> but **not stable** under repeat mutation: deleting an item makes the survivor
> inherit the deleted item's attachment filename and media row — a silent wrong
> attachment, with no collision or error. `MultiImageCapture`'s design survives,
> but the storage fix must land **first**. See
> [repeat-media-identity-characterization.md](./repeat-media-identity-characterization.md).

0. ~~**Media identity fix**~~ — **done**: the filename is minted at capture,
   written into the node value, and `instance_media` is keyed on it.
1. Catalog-register `MediaGallery` — required by the escape-hatch principle
   regardless, and the primitive `MultiImageCapture` sits on.
2. Additive slot in `CameraFrame`; forward from `CameraView`.
3. `MultiImageCapture` in `gather-components/src/image-collection/`, with
   render-free logic split for testing (`mediaModel.js` precedent).
4. Catalog-register it with its shipped action handler.

The §12 caution against implementing reorder by physically reordering repeat
instances now generalises: **deletion alone breaks identity, so XPath position
must never be treated as durable identity for anything.**

## 13. ODK image-capture gate — landed (2026-09-01); device run outstanding

Proves the Phase 3 boundary directly, without routing an ODK field through an
A2UI composition:

```text
XFormsImageControl → package-owned CameraView → serializable capture
  → attachImageMedia → existing ODK attachment/value path → submission
```

### Scope decision: no `ImageAsset` in the XForms path

The gate description said "serializable capture / `ImageAsset` → existing ODK
attachment path", which was ambiguous. Resolved from the code: **the XForms path
does not use `ImageAsset` and should not start.**

`attachImageMedia({ sourceFile, contentType, reference, … })` consumes the raw
capture descriptor and produces M5 instance media (durable file + safe filename
bound in XML). `ImageAsset` is the *scientific/capability* contract with its own
digest-addressed model, and [contract-ownership-audit.md](./contract-ownership-audit.md)
found `gather-storage` is deliberately asset-agnostic. Introducing `ImageAsset`
here would add coupling for no current need.

**Deferred:** an `ImageAsset` → attachment bridge belongs with its first real
consumer — a collection field writing `ImageAsset[]` into an XForms field
(see §12).

### What changed

The boundary already held (`XFormsImageControl` imports package-owned
`CameraView`), so this locks it and clears the residue:

- `src/components/camera/` now contains **only** `QrScanner.js`. Barcode
  scanning is the one camera concern deliberately left app-side in Phase 3;
  photo acquisition is entirely package-owned.
- `CameraControls` → `CaptureActions` in `src/components/forms/`. It was never
  camera control — the camera owns its shutter inside `CameraView`; these are
  the workflow actions that *follow* a capture, which belong outside it.
- `ImagePreview` → `CapturedImage` in `src/components/forms/`. Also **fixes a
  defect**: it hardcoded `aspectRatio: 3/4`, so a landscape capture rendered
  cropped to a portrait frame. It now uses the capture's own dimensions, which
  the descriptor already carried.

### Regression guard

`test/xforms/image-capture-boundary.test.mjs` asserts the descriptor carries
exactly what the attachment path needs (local `file://` URI + `contentType`),
that a non-local capture is rejected before reaching it, that nothing
camera-native crosses the seam, and — structurally — that **no file in `src/`
imports VisionCamera except `QrScanner.js`**. That last one turns the Phase 3
decision into something that fails a build rather than eroding quietly.

### Verified / not verified

`test:unit` 321 tests / 320 pass / 0 fail (1 known skip); Expo config; renderer
Vite build; Android Hermes export; `git diff --check`. **The submission path is
provably untouched** — zero diff across `src/instances`, `src/sync`,
`odk-central-client`, and `gather-storage`.

**Not verified:** the device run. Changes are presentation-only and the M5 path
is byte-identical, but the gate is not complete until an on-device capture →
attach → submit regression passes per
[emulator-gate-runbook.md](./emulator-gate-runbook.md).

## 14. `gather-components` layout — flattened (2026-09-02)

`src/camera/` sat as a sibling of `src/components/`, which was drift rather than
a decision. Two conventions arrived separately and were never reconciled: the
M9 shared-components work grouped by purpose *under* `components/`, and Phase 3
created `src/camera/` by following the design doc §17 path sketch literally —
even though §17 allowed "an equivalent purpose-oriented layout consistent with
the current package".

The inconsistency was real: `camera/` and `media/` are the same kind of thing —
a domain with components, `.native`/`.web` seams, internal-only parts, and one
render-free logic module — sitting at different depths. The giveaway was
`CameraFrame.jsx` importing `'../components/actions/Button.jsx'`: the camera
domain had to reach *down into* `components/` to use a sibling concept.

Inside a package named `gather-components`, everything is a component, so the
`components/` layer carried no information — and it is what made `camera/` look
like it needed to escape. Removed:

```text
src/
├── actions/  camera/  image/  media/  results/  status/
├── primitives.jsx
├── index.js
└── theme/
```

**Pure move.** 17 files relocated, `../../theme` → `../theme` in 7 of them,
`primitives.jsx`'s `../theme` → `./theme`, 11 `index.js` paths, 2 package-test
paths, and the `CameraFrame` straggler. **The public API is byte-identical** —
every consumer imports through the package index, verified by diffing the export
list against the previous commit.

Gates: `test:unit` 321/320 pass/0 fail (1 known skip), Expo config, renderer Vite
build (react-native-web seams), Android Hermes export (`.native` seams),
`git diff --check`.

## 15. Derived values without image upload — confirmed possible; seam outstanding

**The question:** can a composed workflow use the camera to *compute* a value —
masked colour, petal count, mask area, a pose — and send only that value to the
form, without uploading image bytes?

**Yes, and nothing needs to be built for the no-upload half.** Verified from the
submission path: attachments are derived entirely from instance-media rows.

```js
const media = await listInstanceMedia(instance.localInstanceId);
const attachments = media.map(...);
await client.submit({ xml, attachments });
```

Those rows are created by exactly one function — `attachImageMedia`, which
writes bytes durably, binds a safe filename into the XML, *and* records the row.
A derived-value workflow simply never calls it, and writes its scalar through
the ordinary engine binding (`question.setValue`, the same path
`XFormsInputControl` uses). The submission then carries **XML only, zero image
bytes**.

```text
CameraView → descriptor → image.segment / measure.area
                                ↓
                     setValue(reference, 12.4)
                                ↓
                        XML only, no attachment
```

An ODK image slot is required only when the pixels themselves are the datum.
This falls out of the Component/Capability split rather than needing support:
acquisition is a Component, computation is a Capability, and a form value is
just a value.

### The one missing seam

Nothing bridges a computed result into an XForms value. `onAcceptedResult` is
still unwired, and Segment & Measure already produces a typed result with no
path to `setValue`.

Framed this way it is worth more than "persist Segment & Measure's output": it
is **the general mechanism by which any computed value reaches a form field**. A
`MaskArea` or `PetalCount` field then becomes a composition plus a binding, with
no new machinery. This is the highest-value item in the composition→ODK gate.

### Three decisions to make when building it

**Does the image persist at all?** `persistScientificCapture` writes a durable
`ImageAsset` today because models read from a file path and `ExecutionReceipt`
hashes the input. A transient workflow could infer from the camera's temporary
file instead — at the cost of the digest that makes the receipt verifiable.

**"Don't upload" and "don't retain" are different.** Skipping `attachImageMedia`
keeps bytes off the wire; it does not delete them. Scientific captures land in
project media with no cleanup path outside project removal, so a high-volume
derived-value workflow would grow local storage unboundedly. A retention policy
is a prerequisite, not a follow-up.

**Provenance is weakened deliberately.** "Petal count = 7" without the image
cannot be re-audited. That may be exactly right for bandwidth-constrained
fieldwork, but it should be an explicit authoring choice (keep image / discard
after compute) rather than an accident of wiring — the same shape of decision as
cardinality in §12: the host owns the rule, the Component does what it is told.

## 16. Why `gather-components` has a `Button` when the Basic Catalog has one

They are not duplicates; they are different layers.

```text
A2UI Basic Catalog `Button`     vocabulary — ButtonApi schema + binding
        ↓ delegates to
gather-components `Button`      the actual React Native presentation
```

The mobile implementation in `src/a2ui/mobile/basicCatalog.js` renders the
package `Button` (imported as `SharedButton`). It is also used directly by three
plain-React components that are not in any A2UI surface — `CameraFrame`,
`MediaGallery`, `InstrumentError`. Removing it would leave the A2UI binding with
nothing to render and break all three.

It also carries two things the catalog needs but a naive button would not: a
`children` slot, because A2UI Buttons take their label as a *child component*,
and a `borderless` variant.

**The genuine near-duplication is elsewhere:** `ActionButton` in
`src/components/NavButton.js`, with 14 app call sites. It predates the shared
component. It is not styling drift — both already consume the same
`buttonPresentation` contract (`buttonAppearance` / `buttonHeightForVariant` /
`resolveButtonVariant`) — so they are two `Pressable` wrappers over one
presentation contract, differing only in that `ActionButton` adds `tone` and the
package `Button` adds `children`/`borderless`. Consolidating is possible but is
app-UI churn with no correctness gain today; revisit if the two drift.

## 17. Computed-value → `setValue` seam — landed (2026-09-02)

Implements the mechanism §15 identified as missing:
[`src/xforms/resultBinding.js`](../src/xforms/resultBinding.js).

```text
composition → typed result → result binding → form.setValue(reference, "12.4")
                                                    ↓
                                            XML only, no attachment
```

`createResultFieldWriter({ form, bindings })` returns a function matching the
host's `onAcceptedResult(result, context)` shape, so it can be handed straight to
`A2UIHost`: the host **delivers** the typed result, and this decides that
completion means writing XForms field values. `bindings` is a list of
`{ reference, path }`, so one result populates several fields —
`measurements.area.value` → `/data/leaf_area`, `measurements.area.unit` →
`/data/leaf_area_unit`, and so on.

### Three decisions worth knowing

**Structured values are refused.** `toXFormsValue` accepts strings, finite
numbers, and booleans; objects and arrays throw. This is the structural guard
that makes "no bytes" hold: an `ImageAsset` cannot be stringified into a text
field by a mis-authored binding. Bind a scalar path *within* a result, or use
the attachment path.

**Absent optional values clear the field rather than throwing.** A classification
that was not run writes `''` and is reported `present: false` — an optional
measurement is a legitimate outcome, not an error.

**All bindings coerce before any write.** A binding that is going to fail cannot
leave the instance half-populated; the writer resolves every value first and
only then calls `setValue`. A failure surfaces in the composition's error View
rather than reporting silent success.

### Status

The mechanism is complete and covered end-to-end through the real A2UI runtime
(composition completion → binding → `setValue`), including the failure path.

**It has no production consumer yet, by design.** The consumer is an XForms
control that hosts a composition, which is the composition→ODK gate. This lands
the mechanism so that gate is a wiring exercise rather than a design exercise.

Still open from §15 before a derived-value workflow ships at volume: the
**retention policy** for scientific captures (project media has no cleanup path
outside project removal), and making "keep image / discard after compute" an
explicit authoring choice.

## 18. Track A — `MultiImageCapture` landed (2026-09-02)

The §12 build order, implemented. Steps 1–4 done; step 5 reassigned (below).

### What landed

**Camera slots.** `CameraFrame` gains additive `leading` / `trailing` slots
beside the shutter — `control` still *replaces* it, which is how `VideoView`
swaps in `RecordButton`. Both `CameraView.native` and `CameraView.web` forward
them, so the semantic contract is identical on both platforms. The shutter stays
centred with or without accessories (equal-weight side cells).

**`MultiImageCapture`** (`gather-components/src/image-collection/`) — a compound
Component composing `CameraView` + `MediaGallery`, presenting as one field
control producing `ImageAsset[]`:

- **controlled** — the collection lives with the host, because drafts reload
  mid-instance; only `view` / `busy` / `error` are internal;
- **it never persists** — `onCapture(descriptor)` hands the plain descriptor over
  and the host materializes and appends the asset; awaiting it drives the busy
  state, so per-photo progress is visible without the Component knowing about
  storage;
- **no `Flow`** — camera↔gallery is ordinary component state, because those views
  are shipped behavior rather than authored structure;
- the camera accessory shows the latest thumbnail (tap → gallery) and a progress
  count; `Done` appears only once `minItems` is met.

Render-free rules live in `multiImageModel.js` (`canCapture`, `canComplete`,
`removeItemAt`, `appendItem`, `captureCountLabel`), mirroring `mediaModel.js`.
An exact-count field is expressible as `minItems === maxItems`.

**Catalog registration.** `MediaGallery` and `MultiImageCapture` are both
Composer-visible now, in the catalog source, the regenerated artifact, and both
renderers. Registering `MediaGallery` independently is the escape hatch: an
author needing a structurally different interaction composes
`CameraView` + `MediaGallery` + `Flow` directly instead of configuring the
convenience Component.

**Shipped collection handler** (`src/a2ui/mediaCollectionActions.js`). A
Component's action semantics ship *with* the Component, so these are written
once rather than reinvented per composition — the authored-composition handler
gap does not apply. Scope is mutation only: `gather.mediaCaptured` (persist and
append) and `gather.mediaChanged` (remove / reorder / set). Selection, `back`
and `done` are navigation and completion, which belong to the embedding
composition.

### Two decisions worth noting

**A collection capture got its own action id.** `gather.capture` already means
"capture, then advance the instrument view". Overloading it with "persist and
append" would give one action two meanings, distinguishable only by state path,
so `gather.mediaCaptured` was added instead.

**Removal carries an index, not an array.** `reorder`/`set` carry the
already-computed array, but `remove` sends only the index so a stale client list
cannot silently replace newer state.

### Step 5 reassigned — the orphan sweep has no owner here

§12 listed an orphan-media sweep with this work. On implementation that turned
out to be misplaced: `MultiImageCapture` is a Component over a controlled array
and owns neither repeats nor `instance_media`. Which store an orphan lives in
depends on the host — the scientific asset service (project media) for an A2UI
composition, `attachImageMedia` (instance media) for an XForms field. Building a
sweep now would be inventing an owner. It belongs with the **XForms collection
binding**, where the repeat-backed representation is decided.

### Also corrected

`catalog.test.mjs` asserted Segment & Measure's `hostActions` deep-equals *every*
catalog action id. That was always the wrong invariant — an instrument declares
the actions it uses — and the collection actions made it false. It now asserts
subset membership plus the specific actions S&M needs.

**Verified:** `test:unit` 348 tests / 347 pass / 0 fail (1 known skip); Expo
config; renderer Vite build; Android Hermes export; `git diff --check`; and a
parity check that all nine Gather component ids resolve in catalog + mobile +
web. **Not verified:** on-device behaviour — the camera accessories, gallery
navigation, and capture loop need a device pass.
