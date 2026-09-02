# Gather Camera, Components, and Capabilities Architecture

**Status:** implementation design  
**Date:** 2026-09-01  
**Audience:** Gather coding agents and maintainers  
**Scope:** camera/media components, capability packaging and Composer exposure, Flow/View composition, platform seams, and migration of existing app-local implementations

---

## 1. Purpose

Use the camera/media subsystem as the reference implementation for a clean Gather platform boundary between:

```text
Components
→ reusable presentation and interaction

Capabilities
→ reusable device/computational operations

Flow
→ presentation primitive that renders one active View

ToolFlowController
→ lightweight host-side orchestration seam

Tools
→ compositions of Components + Capabilities + Flow

ODK/XForms
→ surrounding form lifecycle and final typed Tool result
```

Canonical shorthand:

> **Components render. Capabilities do work. Flow shows. Controller drives. Tools compose. ODK records.**

The implementation should make these boundaries visible in both code ownership and the vocabulary exposed to Gather Tool Composer.

This work should **not** introduce a general workflow engine and should **not** migrate Gather from A2UI v0.9 to v1.0.

---

## 2. Decisions at a glance

1. **Composer-visible platform primitives are package-owned.**  
   App `src/` consumes them; it does not own their canonical implementation.

2. **`gather-catalog` declares Composer-visible A2UI UI vocabulary.**

3. **`gather-components` implements Composer-visible reusable UI using React Native primitives + React Native Web.**

4. **`gather-capabilities` owns both portable capability definitions and reusable capability implementations.**

5. **Organize by concept first, platform second.**  
   Use `.native.js` / `.web.js` only for irreducible platform seams; do not create parallel `/native` and `/web` trees.

6. **Collapse the old `vision.*` / `image.*` distinction into `image.*`.**  
   ML vs OpenCV vs heuristic implementation belongs in metadata/implementation, not the public capability namespace.

7. **Use separate photo and video UI primitives.**  
   `CameraView` is the standard still-photo camera surface. `VideoView` is the standard video recording surface. They share one underlying camera subsystem/session abstraction.

8. **`MediaGallery` is a reusable Composer-visible Component.**

9. **Single-photo, video, and multi-image capture are standard compositions/recipes, not giant new monolithic runtime Components.**

10. **Multi-image capture is composed with `Flow` + `View` + `CameraView` + `MediaGallery`.**

11. **Use `View`, not `Step`.**  
    `Step` implies a linear wizard; `View` works for branching, retries, loops, and non-linear workflows.

12. **Keep `Flow` intentionally simple.**  
    Given an externally controlled active View, render that View.

13. **Establish `ToolFlowController` now, but do not build generic orchestration yet.**

14. **Watch the camera-session seam carefully.**  
    `CameraView` / `VideoView` and `camera.*` Capabilities must share the same underlying live device session without exposing native objects or duplicating camera acquisition.

---

# 3. Package ownership

Target architecture:

```text
packages/
├── gather-catalog/
│   └── A2UI declarations + authoring metadata
│
├── gather-components/
│   └── shared RN / RN Web presentation implementations
│
├── gather-capabilities/
│   └── capability definitions + executable implementations
│
├── gather-storage/
├── odk-central-client/
├── odk-xforms-host/
├── odk-xforms-react/
└── odk-xforms-webview/

src/
├── components/
│   └── Gather-app-specific UI only
│
├── capabilities/
│   └── app-specific registration/wiring only, if anything remains
│
├── a2ui/
│   └── thin app/renderer adapters
│
├── screens/
├── navigation/
├── forms/
├── instances/
└── ...
```

### Ownership rule

> **If a primitive is part of the reusable Gather vocabulary exposed to Tool authors, its declaration and canonical implementation belong in a package.**

Examples:

```text
ProjectSwitchCard
→ src/components

SetupHome UI
→ src/components

Flow
→ gather-catalog + gather-components

CameraView
→ gather-catalog + gather-components

VideoView
→ gather-catalog + gather-components

MediaGallery
→ gather-catalog + gather-components

image.segment
→ gather-capabilities

camera.capturePhoto
→ gather-capabilities
```

Audit existing `src/components` and `src/capabilities`. **Move; do not copy.** Delete stale or duplicate implementations after migration. `src/components` is still valid for app-only React UI.

---

# 4. Gather Catalog: UI vocabulary only

`gather-catalog` answers:

> **What can a Tool render and compose?**

Use A2UI Basic Catalog components wherever they already express the concept:

```text
Text
Button
Row
Column
Card
Image
Video
...
```

Do not introduce Gather-specific aliases such as `AcceptButton` or `ResultText`.

Gather-specific Composer-visible Components should represent genuinely reusable interaction/presentation concepts.

Initial camera/flow-related vocabulary:

```text
Flow
View
CameraView
VideoView
MediaGallery
ImageOverlay
OutputReview
```

Future specialized Components may include:

```text
ImageAnnotator
MaskEditor
```

but only when a real reusable interaction requires them.

---

# 5. `Flow` and `View`

## 5.1 Why Flow exists

One ODK form field may host a Tool whose interaction contains several screen-sized views:

```text
camera
→ review
→ process
→ results
```

ODK owns progression **between form fields**.

The Tool owns progression **within the field**.

A2UI does not provide a native general-purpose conditional-rendering primitive, so Gather ships a small Composer-visible presentation abstraction.

## 5.2 Contract

Conceptually:

```text
Flow
├── View: capture
├── View: gallery
├── View: review
└── View: results
```

`Flow` receives/binds an active View identifier and renders exactly that child View.

`View` is a named presentation container.

### Rename

Replace existing `Step` terminology with **`View`** throughout:

```text
schemas
catalog metadata
component implementation
fixtures
tests
examples
docs
Composer instructions
```

Do not retain `Step` aliases unless needed temporarily for migration.

## 5.3 What Flow must NOT become

Flow does **not** own:

```text
capability execution
workflow meaning
guards
entry/exit actions
retry policy
timers
nested statecharts
parallel states
result persistence
ODK submission
```

It only renders the externally selected View.

---

# 6. ToolFlowController: establish the seam now

Introduce/retain a minimal host-side controller boundary:

```text
ToolFlowController

activeView
dispatch(event, payload)
setView(view)
reset()
```

Exact API may vary if the existing host architecture suggests a cleaner shape.

Responsibilities:

```text
receive semantic Tool events
decide which View becomes active
invoke/coordinate Capabilities where Tool-specific logic requires it
write typed capability results into Tool working data
tell Flow which View is active
```

Non-responsibilities:

```text
rendering
native camera implementation
OpenCV / ONNX implementation
ODK submission
generic workflow language
```

### Current policy

> **Establish the seam now; build orchestration later.**

Do **not** create a generic statechart language in this task.

### Tripwire for future orchestration

Promote orchestration into a reusable declarative Tool Flow/statechart only when at least two Tools independently require meaningful branching/retry logic based on user actions or Capability outcomes.

Example tripwire:

```text
Capture
→ Quality check
    ├── bad → Retake
    └── good → Segment
                  ├── confident → Review
                  └── uncertain → Manual correction
                                      ↓
                                 Calibration?
                                  ├── no → Calibrate
                                  └── yes → Measure
```

If/when this occurs:

```text
declarative ToolFlow/statechart
→ generic ToolFlowController
→ existing Flow component
```

The future orchestration layer should **drive Flow, not replace it**.

---

# 7. Camera ecosystem: architectural reference implementation

The camera subsystem should demonstrate the Component/Capability boundary.

Public concepts:

```text
CameraView
VideoView
MediaGallery

camera.capturePhoto
camera.recordVideo

ImageAsset
VideoAsset
```

Internal/native machinery stays private:

```text
VisionCamera device
VisionCamera ref / Frame
getUserMedia stream
MediaStreamTrack
canvas
ONNX tensors
OpenCV Mats
JSI/native handles
```

No native/runtime object may cross the public Tool/A2UI contract.

---

# 8. CameraView: standard still-photo camera surface

`CameraView` is the standard Gather photo-acquisition UI.

It should be shared presentation implemented primarily with React Native primitives and rendered on web through React Native Web.

It owns intrinsic camera interaction:

```text
live camera viewport
shutter
flash / torch controls
front/rear camera switch when allowed
zoom
tap focus
exposure when supported
permission state
capture count / latest-thumbnail affordance
field-friendly touch targets
daylight-readable state
```

Configuration should describe **intent**, not raw hardware implementation.

Illustrative properties:

```yaml
CameraView:
  facing: back
  allowCameraSwitch: true
  flash: true
  torch: true
  zoom: true
  focus: true
  exposure: false
  quality: high
  showCaptureCount: true
  showThumbnail: true
```

Runtime probes actual device support and gracefully hides/degrades unsupported controls.

### CameraView does NOT own

```text
gallery UI
multi-view workflow
segmentation
quality assessment
ODK persistence
form progression
Tool completion
```

It may emit semantic events such as:

```text
captureRequested / captured
openGallery
permissionRequested
cameraChanged
```

The exact event names should follow existing Gather/A2UI naming conventions and remain semantic.

---

# 9. VideoView: separate video recording surface

Do **not** add a `mode: photo | video` switch to a single giant capture Component.

Photo and video share infrastructure but have materially different interaction contracts.

`VideoView` is the Composer-visible video recording surface.

It may own:

```text
live viewport
record start/stop
recording timer/state
front/rear camera switch when allowed
torch
zoom/focus where appropriate
audio-enabled state / permission indication
stabilization/quality intent
recording duration constraints
```

It should use the same underlying camera subsystem/session abstraction as `CameraView`.

`VideoView` should not duplicate VisionCamera/getUserMedia setup independently.

Public video operation:

```text
camera.recordVideo
→ VideoAsset
```

Use the A2UI Basic Catalog `Video` component for ordinary playback/review unless a genuinely specialized Gather video-review surface becomes necessary.

---

# 10. MediaGallery: reusable capture review surface

`MediaGallery` is a Composer-visible reusable Component over a collection of durable media assets.

Initial implementation may support only `ImageAsset[]`, while keeping the name and contract extensible toward `MediaAsset[]` if future mixed-media needs justify it.

Illustrative contract:

```text
items
allowSelect
allowRemove
allowReorder
selectedItem / selectedItems
```

Semantic events may include:

```text
select
remove
reorder
back
done
```

`MediaGallery` does NOT:

```text
open the camera
capture photos
persist native camera objects
advance ODK
invoke segmentation
own Tool orchestration
```

---

# 11. Standard capture compositions / recipes

Do not create monolithic runtime Components for every capture variant.

Ship known-good **A2UI composition recipes/templates** that the Composer agent can insert or adapt.

Recommended initial recipes:

```text
Photo Capture
Video Capture
Multi-Image Capture
```

These are compositions of primitives, not replacements for them.

A sensible source location is:

```text
packages/gather-catalog/src/recipes/
├── photoCapture.js
├── videoCapture.js
└── multiImageCapture.js
```

Use the existing catalog/fixture conventions if another location is already established.

## 11.1 Photo Capture

Standard single-photo experience:

```text
Flow
├── View: capture
│   └── CameraView
│
└── View: review
    ├── Basic Catalog Image
    ├── Basic Catalog Button: Accept
    └── Basic Catalog Button: Retake
```

Runtime path:

```text
CameraView
→ camera.capturePhoto
→ ImageAsset
→ review View
→ complete/accept typed result
```

Do not introduce a custom `ImagePreview` merely to display an image if Basic Catalog `Image` + normal Buttons are sufficient.

## 11.2 Video Capture

Standard video experience:

```text
Flow
├── View: record
│   └── VideoView
│
└── View: review
    ├── Basic Catalog Video
    ├── Basic Catalog Button: Accept
    └── Basic Catalog Button: Retake
```

Runtime path:

```text
VideoView
→ camera.recordVideo
→ VideoAsset
→ review View
→ complete/accept typed result
```

## 11.3 Multi-Image Capture

This is a first-class standard composition for field workflows requiring multiple images.

```text
Flow
├── View: capture
│   └── CameraView
│       ├── latest thumbnail
│       └── capture count
│
└── View: gallery
    ├── MediaGallery
    ├── Basic Catalog Button: Back to camera
    └── Basic Catalog Button: Done
```

Expected behavior:

```text
camera remains active
→ capture image
→ ImageAsset appended to working collection
→ thumbnail/count update
→ continue capturing
→ tap thumbnail/open-gallery event
→ ToolFlowController selects gallery View
→ inspect/remove/reorder as configured
→ back returns to camera
→ done completes when count requirements are satisfied
```

Count/cardinality belongs to Tool/recipe configuration, e.g.:

```text
minItems: 1
maxItems: 1

minItems: 4
maxItems: 4

minItems: 2
maxItems: 6
```

Do not hard-code one multi-image policy into `CameraView`.

---

# 12. Capability Registry

`gather-capabilities` answers:

> **What can the Gather runtime do?**

Capabilities remain distinct from Components.

Do not create fake A2UI Components merely to expose operations to Composer.

Composer should receive:

```text
Gather/A2UI Component Catalog
→ what can I render?

Gather Capability Registry
→ what can I do?

Recipes/examples
→ how are these normally composed?
```

---

# 13. Capability namespace

Use namespaces based on semantic domain/data, not implementation technology.

## Camera / acquisition

```text
camera.capturePhoto
camera.recordVideo
```

Do not expose every low-level camera controller method as a Capability.

Flash, zoom, focus, lens switching, exposure, etc. remain intrinsic Component/session interactions unless another reusable semantic use case emerges.

## Image

Collapse the old `vision.*` / `image.*` distinction.

Use:

```text
image.segment
image.segmentPrompted
image.classify
image.detect
image.keypoints
image.embed
image.depth
image.assessQuality

image.threshold
image.morphology
image.contours
image.connectedComponents
```

Why:

- segmentation may be neural or classical;
- quality assessment may be heuristic or learned;
- implementations may change without changing the semantic contract;
- `image.*` is easier for authors and Composer agents to reason about.

Distinguish ML/inference vs OpenCV/processing with metadata, not the public ID.

Possible Composer metadata:

```text
group: Image
subcategory: Analysis
kind: inference
```

versus:

```text
group: Image
subcategory: Processing
kind: processing
```

## Measurement

Keep `measure.*` separate because it describes quantitative meaning independent of source modality:

```text
measure.area
measure.perimeter
measure.boundingBox
measure.centroid
measure.color
measure.sharpness
```

A future measurement may operate on a mask, polygon, calibrated image, depth surface, or another geometry source.

## Other domains

As implemented:

```text
text.recognize
speech.transcribe
audio.classify
```

Location/spatial/sensor namespaces should be established from real capabilities rather than guessed prematurely.

---

# 14. Capability package structure

Organize by **capability**, not by platform.

Preferred shape:

```text
packages/gather-capabilities/src/
├── camera/
│   ├── session/
│   │   ├── ...
│   │   ├── implementation.native.js
│   │   └── implementation.web.js
│   │
│   ├── capturePhoto/
│   │   ├── definition.js
│   │   ├── implementation.native.js
│   │   ├── implementation.web.js
│   │   ├── index.js
│   │   └── tests/
│   │
│   └── recordVideo/
│       └── ...
│
├── image/
│   ├── segment/
│   │   ├── definition.js
│   │   ├── preprocess.js
│   │   ├── postprocess.js
│   │   ├── implementation.native.js
│   │   ├── implementation.web.js
│   │   ├── index.js
│   │   └── tests/
│   │
│   ├── classify/
│   ├── threshold/
│   ├── morphology/
│   └── connectedComponents/
│
├── measure/
│   ├── area/
│   ├── perimeter/
│   └── centroid/
│
├── definitions.js
├── runtime.js
└── index.js
```

Capabilities with identical platform logic should simply use:

```text
implementation.js
```

not empty `.native` and `.web` wrappers.

### Platform rule

> **Shared code is the default. Platform files exist only at irreducible device/DOM seams.**

Never do:

```js
if (Platform.OS === 'web') { ... }
```

inside otherwise shared capability/component implementations when bundler platform resolution can isolate the difference.

---

# 15. Capability definitions live beside implementations

Every Composer-visible Capability should have one portable definition colocated with its implementation.

Illustrative shape:

```js
defineCapability({
  id: 'image.segment',
  version: 1,

  title: 'Segment image',
  description: 'Generate a segmentation mask for an image.',

  group: 'Image',
  subcategory: 'Analysis',
  kind: 'inference',

  input: SegmentInputSchema,
  output: SegmentationResultSchema,

  platforms: ['android', 'ios', 'web'],
  preview: 'live',

  examples: [...]
})
```

Camera definition may additionally state something like:

```text
requiresUserActivation: true
requiresContext: camera-session
recommendedComponent: CameraView
```

Use names/schema that fit the existing codebase; the point is the information boundary, not these exact property names.

`definitions.js` aggregates **definitions only**.

It must be safe for Tool Composer / agent use and must not import:

```text
VisionCamera
onnxruntime-react-native
native OpenCV
DOM camera APIs
```

`runtime.js` builds the executable registry using each capability's platform-resolved implementation.

Conceptual package entry points:

```text
@gather/capabilities/definitions
@gather/capabilities/runtime
```

Do not maintain a separate manually duplicated capability manifest tree.

---

# 16. Composer exposure

The Gather Tool Composer agent should receive machine-derived structured context from:

```text
gather-catalog
+
gather-capabilities/definitions
+
standard recipes/examples
```

The agent should be able to answer:

```text
What UI can I render?
What operations can I perform?
What does each operation accept/return?
Which platforms support it?
Does it require a camera/session/user gesture?
Which Components normally provide the needed interaction context?
How are common workflows composed?
```

Example author request:

> Let the user photograph several leaves, choose one, segment it, and review its area.

The available vocabulary should allow the agent to reason approximately:

```text
Flow
├── View: capture
│   └── CameraView
│       ↓ camera.capturePhoto → ImageAsset[]
│
├── View: gallery
│   └── MediaGallery
│       ↓ selected ImageAsset
│
├── View: segmentation-review
│   └── ImageOverlay
│       ↑ image.segment
│
└── View: results
    └── OutputReview
        ↑ measure.area
```

Do not encode this knowledge only in a large handwritten agent prompt. Definitions, schemas, Catalog metadata, and recipes should be the source of truth.

---

# 17. Component implementation structure

Continue the platform-extension pattern already established in `gather-components`.

Example:

```text
packages/gather-components/src/camera/
├── CameraView.jsx
├── CameraSurface.native.jsx
├── CameraSurface.web.jsx
├── VideoView.jsx
├── VideoSurface.native.jsx
├── VideoSurface.web.jsx
└── ...
```

or an equivalent purpose-oriented layout consistent with the current package.

Rules:

- shared visual/presentation logic is written once with RN primitives;
- web renders through React Native Web;
- `.native` / `.web` files contain only irreducible platform/device/DOM behavior;
- no platform branching inside shared Components;
- do not duplicate native and web component trees.

This is the same established pattern as the current shared `CaptureView` + platform camera seam. Evolve/rename the existing code rather than rebuilding it from scratch where possible.

---

# 18. Critical camera-session seam

This is the architectural area to treat as a deliberate spike/review point.

Problem:

```text
CameraView / VideoView
→ need the live preview and device controls

camera.capturePhoto / camera.recordVideo
→ must operate on the SAME active camera session
```

We must avoid all of these:

```text
A2UI data model contains a VisionCamera ref        ❌
A2UI data model contains MediaStream objects       ❌
camera capability imports presentation Components ❌
CameraView and capability open separate cameras    ❌
duplicate permission/session ownership             ❌
```

Desired internal shape:

```text
                 internal CameraSession
                    ↑              ↑
                    │              │
             CameraView         VideoView
                    │              │
                    └──────┬───────┘
                           │
             camera.capturePhoto
             camera.recordVideo
```

The actual implementation may use a React context/provider, internal session registry, injected adapter, or another small mechanism that fits the existing renderer architecture.

Requirements:

1. exactly one authoritative live camera session per mounted capture surface;
2. photo/video capability calls resolve against that session;
3. no native session/device object crosses the Tool/A2UI contract;
4. permission ownership is not duplicated;
5. native and web follow the same semantic contract;
6. the session seam is internal and replaceable.

### Initial ownership

Prefer keeping this internal camera runtime under the camera domain in `gather-capabilities` rather than creating a new package immediately:

```text
gather-capabilities/src/camera/session/
```

`gather-components` may consume the small internal session abstraction needed to render/control the camera surface.

If this creates awkward package coupling—or if camera, microphone, LiDAR, location, etc. converge on a shared live-device runtime—revisit and consider extracting a dedicated internal device-runtime package.

**Do not create that package preemptively.**

---

# 19. Serializable asset contracts

Capabilities and Components communicate with durable serializable data, not native objects.

At minimum establish/retain typed contracts for:

```text
ImageAsset
VideoAsset
```

Potential common information:

```text
stable/local asset reference
media type
MIME type
dimensions
capture timestamp
duration for video
optional provenance/metadata
```

Do not force base64 image/video payloads through A2UI data models.

Multi-image working state is conceptually:

```text
ImageAsset[]
```

Final Tool output may contain the collection or a selected subset according to the Tool's result schema.

---

# 20. Intrinsic controls vs workflow controls

Preserve this boundary.

Inside `CameraView` / `VideoView`:

```text
shutter / record
flash / torch
camera switching
zoom
focus
exposure
recording state
thumbnail/count affordance
```

Outside, composed with Basic Catalog + Flow:

```text
Accept
Retake
Done
Back to camera
Run model
Review result
Submit/complete Tool
```

Do not make low-level camera controls separate A2UI Buttons unless there is a real reusable authoring need.

---

# 21. Capability execution and Flow remain separate

A Capability performs an operation.

It does not decide where the UI goes next.

Example:

```text
camera.capturePhoto
→ returns ImageAsset
```

not:

```text
camera.capturePhoto
→ returns ImageAsset
→ navigates to gallery
```

Likewise:

```text
image.segment
→ returns SegmentationResult
```

not:

```text
image.segment
→ navigates to review
```

The Tool/controller owns transitions.

Canonical boundary:

```text
Component emits semantic event
→ ToolFlowController decides what to do
→ Capability executes
→ typed result enters Tool working data
→ ToolFlowController updates active View
→ Flow renders that View
```

---

# 22. Existing code migration

Before implementing new structures, inventory:

```text
src/components/
src/capabilities/
packages/gather-components/
packages/gather-catalog/
current A2UI mobile adapters
current web renderer adapters
current camera native/web seams
existing M8 capability definitions/implementations
```

Classify each file:

```text
app-only
Composer-visible reusable Component
reusable Capability
platform seam
obsolete/duplicate
```

Then move/refactor accordingly.

Specific expected cleanup:

- rename old `CaptureView` toward the new `CameraView` terminology where it represents still-photo acquisition;
- create `VideoView` separately rather than adding growing video conditionals to `CameraView`;
- rename `Step` → `View`;
- replace old `vision.*` public capability IDs with `image.*` where feasible;
- migrate reusable `src/capabilities` logic into `gather-capabilities`;
- retain `src/capabilities` only for truly app-specific wiring, or delete it;
- retain `src/components` for normal app-only React components;
- do not duplicate implementations during migration;
- preserve existing native/web behavior and tests while moving ownership.

If compatibility aliases are temporarily required, mark them deprecated and make removal explicit.

---

# 23. Implementation sequence

Recommended order:

## Phase 1 — inventory + contracts

1. Audit existing Components/Capabilities and current camera seam.
2. Write/update the component/capability ownership map.
3. Define the minimal capability definition schema.
4. Define/confirm `ImageAsset` and `VideoAsset`.
5. Confirm `Flow`/`View` contract and complete `Step` → `View` rename.

## Phase 2 — package capability ownership

6. Create/refine `packages/gather-capabilities`.
7. Move existing reusable M8 capability implementations into concept-first folders.
8. Add `definitions.js` and executable `runtime.js` aggregation.
9. Consolidate public `vision.*` names into `image.*`.
10. Keep native/web differences behind platform files.

## Phase 3 — camera runtime seam

11. Spike/implement the internal `CameraSession` boundary.
12. Ensure preview + `camera.capturePhoto` share the same active session.
13. Add/confirm `camera.recordVideo` uses the same subsystem.
14. Validate web + native permission/session behavior.

## Phase 4 — Components

15. Refine/rename `CameraView`.
16. Implement `VideoView` separately.
17. Implement `MediaGallery`.
18. Ensure all shared presentation remains RN/RN-Web and platform code stays in `.native` / `.web` seams.

## Phase 5 — compositions

19. Add Photo Capture recipe.
20. Add Video Capture recipe.
21. Add Multi-Image Capture recipe using `Flow` + `View` + `CameraView` + `MediaGallery`.
22. Wire these through the minimal ToolFlowController pattern.

## Phase 6 — Composer exposure

23. Feed capability definitions + Catalog metadata + recipes into Gather Tool Composer agent context.
24. Ensure only implemented capabilities are advertised as usable.
25. Add examples/instructions sufficient for the agent to compose the three reference capture workflows.

## Phase 7 — migrate reference Tool

26. Update Segment & Measure to use the new naming/boundaries where applicable.
27. Remove obsolete bespoke flow/camera glue that the new primitives replace.

---

# 24. Acceptance criteria

## Architecture

- [ ] Composer-visible Component implementations live in `gather-components`.
- [ ] Composer-visible Capability implementations live in `gather-capabilities`.
- [ ] `src/components` contains app-specific UI, not canonical platform Components.
- [ ] `src/capabilities` is deleted or contains app-specific wiring only.
- [ ] No duplicate `/native` and `/web` implementation trees.
- [ ] Platform variance is isolated through `.native` / `.web` resolution.
- [ ] No native camera/ONNX/OpenCV objects cross public contracts.

## Flow

- [ ] `Step` terminology is replaced with `View`.
- [ ] `Flow` renders one externally selected View.
- [ ] Flow owns no capability or workflow semantics.
- [ ] ToolFlowController remains minimal; no generic statechart engine is introduced.

## Camera

- [ ] `CameraView` and `VideoView` are distinct Composer-visible Components.
- [ ] They share one camera subsystem/session abstraction.
- [ ] `camera.capturePhoto` works against the active `CameraView` session.
- [ ] `camera.recordVideo` works against the active `VideoView` session.
- [ ] Native and web implementations follow the same semantic public contract.
- [ ] Unsupported controls degrade gracefully.

## Gallery/compositions

- [ ] `MediaGallery` is independently reusable.
- [ ] Photo Capture composition works.
- [ ] Video Capture composition works.
- [ ] Multi-Image Capture works with capture → gallery → back/done flow.
- [ ] Multi-image cardinality can be configured without changing `CameraView`.

## Capabilities

- [ ] Portable definitions are colocated with implementations.
- [ ] Composer can load definitions without loading native dependencies.
- [ ] Public image capabilities use `image.*`, not a split `vision.*` namespace.
- [ ] ML/OpenCV distinctions are metadata/implementation details.
- [ ] Only implemented capabilities are advertised to Composer.

## Tests / gates

- [ ] package tests green;
- [ ] renderer build green;
- [ ] Expo/Android Hermes export green;
- [ ] browser camera preview path tested;
- [ ] physical-device photo capture tested;
- [ ] physical-device video capture tested;
- [ ] multi-image capture/gallery tested;
- [ ] Segment & Measure regression flow tested.

---

# 25. Non-goals

Do not turn this implementation into:

```text
a generic statechart/workflow engine
an A2UI v1 migration
a full media asset manager
a photo editor
a video editor
a generalized device-runtime package
a mirror of the VisionCamera API
a second component system beside A2UI
a Composer-specific hard-coded capability prompt
```

Build the smallest reusable seams that prove the architecture.

---

# 26. Documentation updates

Update the working architecture/design notes as part of implementation.

At minimum record:

1. `Step` → `View`;
2. `Flow` is a simple presentation selector;
3. `ToolFlowController` is the orchestration seam;
4. orchestration is intentionally deferred until the branching tripwire is met;
5. Composer-visible primitives are package-owned;
6. capability folders are concept-first with `.native` / `.web` seams;
7. `vision.*` + `image.*` are consolidated under `image.*`;
8. `CameraView` and `VideoView` are separate;
9. `MediaGallery` is reusable;
10. Photo Capture, Video Capture, and Multi-Image Capture are standard compositions/recipes;
11. the camera-session seam is explicitly documented as a boundary to watch;
12. current A2UI v0.9 remains in place.

Where older notes describe the previous frozen-tree or host `root.children` reshaping approach as the active design, mark them superseded by the current `Flow`/`View` decision rather than deleting historical reasoning.

Where older notes describe `CaptureView` as a single photo/video/multi-capture monolith, update them to the new decomposition.

---

# 27. Architecture north star

The camera implementation should make this architecture tangible:

```text
CameraView           Component
VideoView            Component
MediaGallery         Component
Flow / View          Composition primitives

camera.capturePhoto  Capability
camera.recordVideo   Capability
image.segment        Capability
measure.area         Capability

ToolFlowController   Lightweight orchestration seam

Photo Capture        Standard composition
Video Capture        Standard composition
Multi-Image Capture  Standard composition
```

The Composer should ultimately operate over a finite, typed vocabulary:

> **These are the UI concepts you can render. These are the operations the runtime can perform. These are the known-good ways they can be composed.**

That is the intended Gather platform boundary.
