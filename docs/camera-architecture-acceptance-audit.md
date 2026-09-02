# Camera / Components / Capabilities architecture — acceptance audit

**Date:** 2026-09-02
**Subject:** *Gather Camera, Components, and Capabilities Architecture*
(implementation design, 2026-09-01) — its §24 acceptance criteria and §23
implementation sequence, checked against the code.

> The source design document is **not currently in `docs/`**. It should be, for
> traceability against this audit.

**Verdict: substantially complete.** Phases 1–4 done, Phase 5 done except video,
Phase 6 outstanding, Phase 7 moot. Several decisions were **superseded** during
implementation and are marked as such — they are not debt.

## Where it sits relative to the milestone roadmap

The design document's Phase 1–7 is the *implementation sequence* for the
Components/Capabilities architecture. It is not a second project roadmap: it
sits underneath **M9** in [milestone-roadmap.md](./milestone-roadmap.md). "We
are on Phase 5" and "we are on M9" describe the same work at different
granularities.

## §24 acceptance criteria

### Architecture — ✅ met

| Criterion | State |
| --- | --- |
| Composer-visible Components in `gather-components` | ✅ `camera/`, `media/`, `image-collection/` |
| Composer-visible Capabilities in `gather-capabilities` | ✅ `image/segment`, `image/classify`, `measure/` |
| `src/components` app-specific only | ✅ |
| `src/capabilities` deleted or app-specific wiring only | ✅ only QR scan-result decoding and location remain, and the file says so |
| No duplicate `/native` + `/web` trees | ✅ `.native.jsx` / `.web.jsx` seams only |
| Platform variance isolated by resolution | ✅ |
| No native objects cross public contracts | ✅ |

### Flow — ✅ met

`Step` → `View` is complete (no `Step` identifier survives). `Flow` renders one
externally selected View and owns no capability or workflow semantics. No
statechart engine was introduced.

**Naming superseded:** `ToolFlowController` is `FlowController`, and "Tool" is no
longer a runtime species — see
[components-capabilities-ownership.md §11](./components-capabilities-ownership.md).
The *seam* the document asked for exists; only the name changed.

### Camera — ✅ met, with §13/§18 superseded

`CameraView` and `VideoView` are distinct Components sharing one preview
subsystem (`CameraDevicePreview.native.jsx`), with the same semantic contract on
native and web.

**⤺ Superseded: there is deliberately no `camera.*` capability.** The document
specifies `camera.capturePhoto` / `camera.recordVideo` as Capabilities (§13) and
devotes §18 to the "critical camera-session seam" — how a capability call would
reach the same live session a Component is previewing.

That problem **dissolved** rather than being solved: acquisition is
Component-owned. `CameraView` owns the session and emits a plain local capture
descriptor; `capturePhoto` lives in `gather-components/camera/`, not as a
capability. So there is no second consumer to share a session with, no session
registry, and no injected adapter.

This is worth stating plainly because §18 asked for a spike and the answer was
to remove the need for one. The document's requirement "exactly one
authoritative live camera session per mounted capture surface" is met trivially,
because only the surface has one.

### Gallery / compositions — mostly met

| Criterion | State |
| --- | --- |
| `MediaGallery` independently reusable | ✅ |
| Photo Capture composition works | ✅ — but **⤺ demoted to a test fixture**, not a shipped recipe |
| Video Capture composition works | ⚪ **outstanding** — `VideoView` exists; the composition does not |
| Multi-Image Capture capture → gallery → back/done | ✅ — but **⤺ as a compound Component**, not `Flow` + `View` |
| Cardinality configurable without changing `CameraView` | ✅ appearance `min=` / `max=` → Component config |

**⤺ Superseded: `MultiImageCapture` is a compound Component.** The document
(decisions #9, #10, §11.3) specifies multi-image as a `Flow` + `View` +
`CameraView` + `MediaGallery` composition. Implementation chose a compound
Component instead — see
[§12](./components-capabilities-ownership.md). It composes the same primitives
internally but presents as one field control producing `ImageAsset[]`, which is
what the XForms binding needs.

**⤺ Superseded: no `packages/gather-catalog/src/recipes/`.** Photo Capture lives
in `test/fixtures/photo-capture/` as deterministic runtime material, because
ordinary photo capture is not an architectural species (§11 reconciliation). The
recipe *concept* survives; the shipped-recipes directory does not.

### Capabilities — ✅ met

Definitions are colocated with implementations (`image/segment/definition.js` +
`implementation.js`), `definitions.js` is documented and structured to be
native-free so Composer can load it without ONNX/OpenCV/DOM, public ids are
`image.*` with no `vision.*` surviving, and ML-vs-processing is metadata.

### Tests / gates

| Gate | State |
| --- | --- |
| package tests green | ✅ |
| Expo / Android Hermes export green | ✅ |
| physical-device photo capture | ✅ interactive camera gate, 2026-09-02 |
| multi-image capture / gallery | ✅ collection field gate + interactive gate + dev seed |
| **browser camera preview path** | ⚪ **not verified** |
| **physical-device video capture** | ⚪ **outstanding** |
| Segment & Measure regression | ⚪ moot — S&M is deprecated legacy |

## §23 implementation sequence

| Phase | State |
| --- | --- |
| 1 — inventory + contracts | ✅ |
| 2 — package capability ownership | ✅ |
| 3 — camera runtime seam | ⤺ **superseded** — the seam dissolved with Component-owned acquisition |
| 4 — Components | ✅ `CameraView`, `VideoView`, `MediaGallery` |
| 5 — compositions | 🟡 Photo ✅ (as fixture), Multi-Image ✅ (as compound Component), **Video ⚪** |
| 6 — Composer exposure | ⚪ **outstanding, and the substantive one** |
| 7 — migrate Segment & Measure | ⚪ moot — deprecated legacy |

## What actually remains

1. **Phase 6 — Composer exposure.** Definitions, catalog metadata and examples
   exist; *feeding them into the Composer agent as machine-derived context* does
   not. This is the same requirement as "declarative, schema-described, and
   discoverable from catalog metadata rather than prompt prose", and the
   [behaviour audit](./composition-behaviour-audit.md) shows v1.0's
   `FunctionDefinition` metadata (`requiresUserActivation`, `allowedCallers`,
   `instructions`) is most of the vocabulary it needs. **This is the largest
   remaining piece of the design document.**
2. **Video capture** — `VideoAsset` is specified and `VideoView` exists; the
   capture path, the composition, and a device gate do not.
3. **Browser camera preview verification.**

Everything else is either met or deliberately superseded.
