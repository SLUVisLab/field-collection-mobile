# M8 Scientific Capability Toolbox

**Status: GREEN — 2026-08-29**

M8 provides a reusable, native scientific-capability foundation. It does not
begin A2UI, a model registry, BYOM UI, XForms binding, or an Instrument
Composer.

## Delivered

- Immutable, revision-addressed local Model Store with artifact/label hash
  verification on installation and resolution.
- Reproducibly exported U2-NetP saliency segmentation and MobileNet V3 Large
  ImageNet-1K V2 classification packages, installed through that same store.
- Declarative resize/crop/RGB/scale/normalize/NCHW preprocessing and
  sigmoid/threshold/mask restoration and softmax/top-K postprocessing.
- Bounded ONNX session adapter with no native session/tensor types crossing
  capability boundaries.
- Fast OpenCV-backed pixel area, all-contour perimeter, bounding box,
  largest-component centroid, masked mean sRGB color, and masked
  variance-of-Laplacian sharpness.
- Native Segment & Measure reference screen: capture, proposed mask review,
  explicit accept/retake, measurements, optional generic classification, and
  one typed accepted result with immutable execution receipts.
- [M9 instrument contract handoff](./m9-instrument-contract.md).

## Model provenance

| Model | Immutable artifact SHA-256 | Upstream |
| --- | --- | --- |
| U2-NetP | `571926ae339d435a039712e7a0cf15798ae29a078cae4a56d090693b47d9c31e` | `xuebinqin/U-2-Net@ac7e1c817ecab7c7dff5ce6b1abba61cd213ff29` |
| MobileNet V3 Large | `b15d8e4946ad08687f928376445f7e19af1f5d98a1525c4ab1d2d7e4ebbc3356` | `pytorch/vision@8fb87713a24951e639c494b0f2a8a81b5f8e33a6` |

The conversion script is
`experiments/m8-model-export/export_reference_models.py`; local source clones,
weights, and its virtual environment remain intentionally untracked.

## Validation

- Focused scientific tests: **23 passed** (includes segmentation double-activation
  and oriented-capture regressions).
- Full offline package and app suite: **passed**.
- Android and iOS Hermes exports: **passed**.
- Android and iOS final capability gates: **passed**, including cold and warm
  semantic capability execution from one installed Model Store/runtime.
  - Each loaded both reference artifacts, installed/verified them through the
    Model Store, created a durable U2-NetP mask, returned five MobileNet
    classes, measured a `3 px2` fixture region, produced Laplacian sharpness,
    and constructed the accepted typed result.
- Physical Pixel 10 interactive workflow: **passed** — real camera capture,
  durable persistence, correct segmentation mask alignment, and plausible
  classification (see on-device correctness fixes below).
- `git diff --check`: **passed**.

The detailed dependency, native registration, model provenance, timings, and
device evidence are in [m8-substrate-audit.md](./m8-substrate-audit.md).

## On-device correctness fixes

The batched fixture gate proved the computational path, but the first real
interactive capture on a Pixel 10 exposed four issues that deterministic PNG
fixtures could not:

- **Segmentation double activation.** U2-NetP's upstream `forward()` already
  applies `sigmoid`, so the exported ONNX emits probabilities. The executor
  applied `sigmoid` a second time, pushing every pixel above the 0.5 threshold
  and producing a constant filled rectangle regardless of input. The redundant
  `sigmoid` postprocessing step was removed; activation is now driven only by a
  model's declared postprocessing. A regression test locks this in.
- **Classification resize geometry.** MobileNet was resized to a squashed
  232×232 square instead of Torchvision's aspect-preserving shortest-side-232
  resize followed by a 224 center crop. The package now declares
  `resize.shortestSide`, and the image adapter preserves aspect ratio.
- **EXIF orientation drift.** VisionCamera's `saveToTemporaryFileAsync` writes
  sensor-orientation pixels with a lazy EXIF flag. React Native display honored
  EXIF (upright) while Nitro's raw decode used stored pixels (rotated), so the
  model — and its mask — were 90° rotated and mis-scaled relative to the review
  image. Capture now converts the photo through `toImageAsync`, baking
  orientation and mirroring into the durable pixels so display, model decode,
  and mask share one upright orientation.
- **Opaque mask overlay.** The proposed mask is now written as RGBA with the
  binary value in the alpha channel, and the review overlay uses the image's
  real aspect ratio, so it aligns with the reviewed image instead of tinting a
  full opaque rectangle.

A `__DEV__`-only `[gather-scientific]` diagnostic logger records tensor and
activation statistics plus asset-versus-decoded dimensions; it never crosses a
capability boundary and is inert in release builds.

## Interactive UX

The Segment & Measure camera uses a round centered shutter (white with a dark
grey border) and a brief capture flash. After capture the screen immediately
shows the durable still — sized from the capture result's own dimensions to
avoid a layout pop — with a processing indicator while segmentation runs, then
the mask review.

## Performance triage

The earlier large combined timings included Expo asset loading, Model Store
installation, and artifact hashing; they were not inference-only measurements.
Normal capability calls now resolve an already verified immutable model before
loading a bundled asset. Final phase traces confirm session-cache reuse:

| Platform | U2-NetP cold / warm | MobileNet cold / warm |
| --- | ---: | ---: |
| Android | 6626 / 6144 ms | 994 / 372 ms |
| iOS | 3187 / 547 ms | 188 / 82 ms |
| Pixel 10 physical Android | 500 / 447 ms | 158 / 47 ms |

U2-NetP remains dominated by `session.run` on Android. Cold iOS segmentation
was dominated by native first image decode/resize; warm execution removed that
one-time cost. The traces retain model resolution, image preparation, session
creation/cache lookup, inference, postprocessing, and durable-result work as
separate serializable phases.

The physical Android gate used the connected Pixel 10 over USB with `adb
reverse` and `localhost` Metro access, not an emulator. It validated the
Add-model probe, both verified immutable packages, semantic segmentation and
classification, the warm session cache, OpenCV fixture measurements, and the
accepted structured result. The app was left running after its terminal marker.

## Temporary ONNX dependency

`onnxruntime-react-native@1.24.3` remains temporarily patched with Microsoft
PRs #27385 and #28266 plus the minimal Expo 57/RN 0.86 template adaptation.
The patch is reapplied by `postinstall` and is guarded by a focused test.
Remove it when the first published package includes both upstream fixes.
