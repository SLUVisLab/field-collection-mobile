# M9 instrument contract handoff

M8 supplies renderer-local components and semantic capabilities. M9 may compose
them declaratively, but must not expose ONNX Runtime, Fast OpenCV, or their
native objects to an instrument definition.

## Component candidates

`SegmentAndMeasureCapture`, `MaskReview`, `MeasurementReview`, and
`ClassificationReview` are candidates for A2UI Catalog Components. They accept
and return plain Gather scientific contracts (`ImageAsset`, `MaskAsset`,
measurement values, ranked classes, and provenance), never native frames,
`Mat`s, tensors, or sessions.

`SegmentAndMeasureCapture` emits a durable `ImageAsset`; `MaskReview` takes an
`ImageAsset` plus proposed segmentation and emits accept/retake intent;
`MeasurementReview` renders serializable measurement values; and
`ClassificationReview` renders optional ranked generic classifications. The
Segment & Measure screen only orchestrates these components and the semantic
capabilities below.

## Renderer-local functions

| Gather capability | A2UI identifier | Arguments | Result |
| --- | --- | --- | --- |
| `camera.capture` | `cameraCapture` | capture options | durable `ImageAsset` |
| `vision.segment` | `visionSegment` | image, `ModelRef` | segmentation + `MaskAsset` |
| `vision.classify` | `visionClassify` | image, `ModelRef` | ranked generic classes |
| `measure.area` | `measureArea` | mask | pixel area |
| `measure.perimeter` | `measurePerimeter` | mask | pixel perimeter |
| `measure.boundingBox` | `measureBoundingBox` | mask | pixel bounding box |
| `measure.centroid` | `measureCentroid` | mask | largest-component centroid |
| `measure.color` | `measureColor` | image, mask | masked sRGB mean |
| `measure.sharpness` | `measureSharpness` | image, mask | variance-of-Laplacian score |

Physical units require an explicit calibration supplied by the instrument; M8
returns pixel-space values only.

## Model resolution

An Instrument manifest identifies a revisioned `ModelRef`. Gather resolves it
through:

```text
Instrument manifest -> ModelRef -> local Model Store -> verified ONNX path
```

The M9 distribution path is Composer -> Central study/form resource -> Gather
download -> Model Store install. Built-in M8 models already use that same
install/resolve boundary, so this adds distribution rather than an inference
redesign.

## Accepted result

The A2UI Data Model is transient interaction and computation state. An
Instrument's Accept action returns one typed, serializable durable result
defined by that Instrument revision. Segment & Measure returns its durable
image, researcher-accepted segmentation, measurements, optional generic
classification, and execution provenance. XForms is the future authoritative
study-record integration boundary. M9 decides how an Instrument schema is
authored; it does not project the result to XLSForm in this contract.
