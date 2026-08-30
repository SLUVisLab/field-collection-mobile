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

The isolated [instrument renderer](../apps/instrument-renderer/) uses the
official `@a2ui/react/v0_9` renderer and `@a2ui/web_core/v0_9` state engine.
It successfully proved custom `MaskReview` rendering, Data Model binding,
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
Phase-1 criterion end to end: catalog handshake, both Gather custom components
advertised and rendered, Basic Catalog components rendered, Data Model binding
(`phase` drove component state), and action flow (`gather.capture`,
`gather.accept`, `gather.retake`) with `context: { statePath: "/gather" }`.

Composer's agent authored a Segment & Measure instrument against the advertised
catalog that is structurally identical to the hand-authored
`SEGMENT_AND_MEASURE_INSTRUMENT` (differing only by `surfaceId` and a title
`variant`). That authored bundle is captured at
[`instruments/segment-and-measure.composer.json`](../packages/gather-catalog/instruments/segment-and-measure.composer.json)
and a test asserts its equivalence to the shared definition.

Two renderer fixes were required for hosted Composer:

- Render batches are made idempotent (`applyRenderBatch`) because Composer
  re-sends `createSurface` for existing surfaces, which upstream rejects.
- Gather components render a visible affordance/placeholder when `phase` is
  unbound (authoring) instead of returning `null`.

## Shared Segment & Measure definition

`gather-catalog` now supplies one immutable plain v0.9 message bundle,
`SEGMENT_AND_MEASURE_INSTRUMENT`. It uses upstream `Column` and `Text`, plus
only `GatherCapture` and `MaskReview` as Gather-specific components. The same
bundle drives deterministic fixtures in the web preview and the mobile
`SegmentAndMeasureInstrument` binding.

The React Native registry maps these component IDs to the existing M8
`SegmentAndMeasureCapture`, `MaskReview`, `MeasurementReview`, and
`ClassificationReview` components. It uses upstream `ComponentContext` and
`GenericBinder` through the version-pinned schema-free exports; it does not
implement A2UI state, bindings, or action semantics itself.

## Web deployment

[`apps/instrument-renderer/Dockerfile`](../apps/instrument-renderer/Dockerfile)
builds the isolated workspace with the repository lockfile and serves its static
output through nginx. It has no database, backend, or model registry.
The nginx policy permits framing only by the hosted Composer and limits scripts,
network access, and fixture image sources. Deploy it over HTTPS at a stable
public renderer URL before configuring that URL in Composer.

### Catalog artifact

[`gather-v0.1.source.json`](../packages/gather-catalog/catalogs/gather-v0.1.source.json)
defines only `GatherCapture` and `MaskReview`. The checked-in
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
