# M9 A2UI compatibility

## Hermes

`@a2ui/web_core@0.9.1` was validated on Android React Native Hermes using
Catalog, MessageProcessor, surface state, Data Model updates, bound-value
resolution, and action dispatch. The M90 gate recorded:

```json
{
  "ok": true,
  "engine": "@a2ui/web_core/v0_9",
  "operations": ["catalog", "processor", "surface", "data-model", "binding", "action"]
}
```

The stock `@a2ui/web_core/v0_9` root entry is not Hermes-safe: it imports a
JSON schema using import attributes. Metro bundles that entry, but Hermes
throws `TypeError: undefined is not a function` before React Native registers
the app. The core runtime modules do not require that schema import.

The version-pinned
[`@a2ui+web_core+0.9.1.patch`](../patches/@a2ui+web_core+0.9.1.patch) adds
schema-free package exports for the existing upstream Catalog, MessageProcessor,
and DataContext modules. It changes no runtime implementation code.

Remove the patch when upstream provides a Hermes-compatible v0.9 entry point
or an equivalent official schema-free runtime export. At that time, replace
Gather's compatibility imports with the upstream export and rerun the M90 gate.

## Composer web preview

The isolated [renderer](../apps/renderer/) uses the
official `@a2ui/react/v0_9` renderer and `@a2ui/web_core/v0_9` state engine.
It successfully proved custom Gather component rendering, Data Model binding,
upstream action dispatch, and the Composer iframe handshake:

- `RENDERER_READY`
- `GET_CATALOG` → `A2UI_CATALOG`
- `RENDER_A2UI`
- `DATA_MODEL_CHANGE`
- `SEND_TO_SERVER`

The Composer bridge package is currently private/unpublished, so the renderer
contains only this documented `postMessage` transport. It delegates all A2UI
protocol processing, state, binding, validation, and React rendering to the
official packages.

### Hosted Composer authoring (verified live)

The deployed renderer (`https://renderer.openfieldworks.com/`) was loaded by the
hosted Composer (`https://a2ui-project.github.io/composer/`) and passed every
Phase-1 criterion end to end: catalog handshake, Gather custom components
advertised and rendered, Basic Catalog components rendered, Data Model binding
(`phase` drove component state), and action flow (`gather.capture`,
`gather.accept`, `gather.retake`) with `context: { statePath: "/gather" }`.

Composer's agent authored a Segment & Measure instrument against the advertised
catalog that is structurally identical to the hand-authored
`SEGMENT_AND_MEASURE_INSTRUMENT` (differing only by `surfaceId` and a title
`variant`). That authored bundle is captured at
[`instruments/segment-and-measure.composer.json`](../packages/gather-catalog/instruments/segment-and-measure.composer.json).

**The equivalence test is currently skipped.** That fixture was authored against
the earlier `PhaseView`-gated tree, which has since been replaced by a single
stable tree (see
[a2ui-v1.0-migration-notes.md](./a2ui-v1.0-migration-notes.md#design-decision-one-stable-tree-values-vary)).
The fixture is kept as the record of the verified authoring session and must not
be hand-edited — re-author the current instrument in the hosted Composer and
replace it from that session to restore the assertion.

Two renderer fixes were required for hosted Composer:

- Render batches are made idempotent (`applyRenderBatch`) because Composer
  re-sends `createSurface` for existing surfaces, which upstream rejects.
- Gather components render a visible affordance/placeholder when `phase` is
  unbound (authoring) instead of returning `null`.

## Shared Segment & Measure definition

`gather-catalog` now supplies one immutable plain v0.9 message bundle,
`SEGMENT_AND_MEASURE_INSTRUMENT`. It uses upstream Basic Catalog composition
(`Column`, `Text`, `Button`) with a small Gather-specific surface (`GatherCapture`,
`ImageOverlay`, `OutputReview`, plus phase/status helpers). The same
bundle drives deterministic fixtures in the web preview and the mobile
`SegmentAndMeasureInstrument` binding.

The React Native registry maps these component IDs to the existing M8
`SegmentAndMeasureCapture`, `ImageOverlay`, `OutputReview`, and status
components. It uses upstream `ComponentContext` and
`GenericBinder` through the version-pinned schema-free exports; it does not
implement A2UI state, bindings, or action semantics itself.

### Physical-device parity (verified)

On 2026-08-29, the normal Gather app route ran on a Pixel 10 (Android 17) using
the A2UI instrument binding and a real camera capture. The existing M8
scientific capability flow completed as expected through capture, durable image
persistence, segmentation, mask review, acceptance, measurements,
classification, accepted result, and retake. The captured still remained
visible while processing.

This pass found and corrected two binding-layer regressions: A2UI `Column`
children now use stable component-ID keys, and all A2UI-owned React Native text
uses Gather theme colors so it remains readable in dark mode. The device
confirmed both fixes.

## Web deployment

[`apps/renderer/Dockerfile`](../apps/renderer/Dockerfile)
builds the isolated workspace with the repository lockfile and serves its static
output through nginx. It has no database, backend, or model registry.
The nginx policy permits framing only by the hosted Composer and limits scripts,
network access, and fixture image sources. Deploy it over HTTPS at a stable
public renderer URL before configuring that URL in Composer.

### Composer preview polish

The renderer presents each surface in a Pixel 10 `react-mockframe` and supplies
a small Gather visual layer without changing A2UI messages, bindings, or
actions. It uses the documented `MarkdownContext` extension point with a
sanitizing markdown-it renderer so Basic Catalog heading variants render as
headings rather than literal Markdown markers.

Capture, empty/processing segmentation, mask-review, and accepted-result states
retain stable media/result areas. The fixture flow was browser-verified through
capture, review, and accepted-result states on 2026-08-29.

### Cross-platform Components architecture

Gather **Components** are authored once as React Native components in
[`gather-components`](../packages/gather-components/) and rendered on the web
through [`react-native-web`](https://necolas.github.io/react-native-web/).
This keeps reusable presentation single-sourced across mobile and renderer.

Repository ownership:

- [`gather-components`](../packages/gather-components/) owns reusable
  presentation, including shared theme primitives (`palette`, `tokens`),
  semantic light/dark roles, and reusable component building blocks.
- [`gather-catalog`](../packages/gather-catalog/) is contract-only A2UI
  vocabulary and instrument definitions (no React components, palette, or theme
  implementation).
- [`src/components/`](../src/components/) remains mobile-app-specific
  presentation, and may consume shared Components.
- [`src/a2ui/mobile/`](../src/a2ui/mobile/) and
  [`apps/renderer/src/`](../apps/renderer/src/) remain thin A2UI bindings that
  resolve A2UI data and dispatch actions into Components/Capabilities.

#### Platform-extension pattern

Only irreducible device/DOM behavior differs by platform, behind `.native` /
`.web` seams. Shared Components stay free of broad platform branching.

The camera is the reference pattern:

- Shared presentation:
  [`CaptureView.jsx`](../packages/gather-components/src/components/capture/CaptureView.jsx)
- Native behavior:
  [`CameraCapture.js`](../src/components/camera/CameraCapture.js) +
  [`CameraViewport.js`](../src/components/camera/CameraViewport.js)
  (VisionCamera + `capturePhoto`)
- Web behavior:
  [`CameraSurface.web.jsx`](../apps/renderer/src/CameraSurface.web.jsx)
  (`getUserMedia` + canvas frame grab + fixture fallback)

Both paths render the same shared `CaptureView`, so structure and styling do
not drift.

Accepted outputs use the shared
[`OutputReview.jsx`](../packages/gather-components/src/components/results/OutputReview.jsx)
surface, with display rows generated from schema metadata supplied by the
instrument definition itself (for Segment & Measure:
[`segmentAndMeasure.js`](../packages/gather-catalog/src/segmentAndMeasure.js),
bound via `/gather/outputReview`).

#### Authoring convention

1. Build reusable presentation in `gather-components` with RN primitives and
   the shared theme.
2. Split by reusable purpose (`actions`, `capture`, `image`, `results`,
   `status`), not by one instrument namespace.
3. Keep A2UI binding files thin adapters that pass props/events into Components.
4. Keep Capabilities (camera/ONNX/OpenCV/etc.) separate from Components.

### Catalog artifact

[`gather-v0.1.source.json`](../packages/gather-catalog/catalogs/gather-v0.1.source.json)
defines the Gather-specific component APIs consumed by Segment & Measure
(`GatherCapture`, `ImageOverlay`, `OutputReview`, `ProcessingView`, and
`InstrumentError`). The checked-in
[`gather-v0.1.json`](../packages/gather-catalog/catalogs/gather-v0.1.json) is
assembled with upstream `assemble_catalog.py --version 0.9 --extend-basic-catalog`.
[`tooling.json`](../packages/gather-catalog/catalogs/tooling.json) pins the
upstream source revision used to produce it. Regenerate the artifact through
that tool whenever the source schema changes; do not add a Gather schema
assembler.

## Asynchronous capability actions

Camera, segmentation, classification, and measurement are not A2UI logic
functions. [`createCapabilityActionHandler`](../src/a2ui/capabilityActionAdapter.js)
receives normal upstream A2UI event actions from `MessageProcessor`, invokes
existing Gather semantic capabilities, and updates the originating surface's
Data Model with serializable state only.

| Action | Required context | Data Model outcome |
| --- | --- | --- |
| `gather.capture` | plain local camera capture | persist durable `ImageAsset`, then segment and enter `review-mask` |
| `gather.segment` | optional `image` | update proposed segmentation |
| `gather.classify` | optional `image` | update ranked generic classification |
| `gather.accept` | none | measure, classify when needed, then write the typed accepted result |
| `gather.retake` | none | reset to `capture` |

The default state path is `/gather`; an instrument can explicitly provide an
absolute `statePath` in its action event context. Failures are logged and write
`{ phase: 'error', error }` to the same Data Model path, so the declarative UI
can render them without any native object crossing into A2UI.

Native `GatherCapture` supplies its plain local capture in the event context.
The web preview may instead provide the adapter's optional `capture()` fixture,
which is used only when that context is absent; it never substitutes for mobile
camera capture.
