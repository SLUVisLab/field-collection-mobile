# M8 Scientific Capability Toolbox - Substrate Audit

**Date:** 2026-08-28 (audit), 2026-08-29 (remediation research and fix)
**Status:** GREEN -- final Android/iOS semantic capability gates and physical Pixel 10 interactive workflow passed

## Recorded baseline

| Substrate | Version |
| --- | --- |
| Expo | 57.0.16 |
| React Native | 0.86.2 |
| React | 19.2.3 |
| Hermes / New Architecture | Expo SDK 57 default configuration |
| VisionCamera | 5.2.3 |
| Nitro Modules | 0.37.1 |
| Nitro Image | 0.15.2 |
| ONNX Runtime React Native evaluated | 1.24.3 |
| React Native Fast OpenCV evaluated | 1.0.1 |

The existing `camera.capture` seam already translates VisionCamera output to a
plain local-file result and disposes the native photo. It is therefore suitable
as the starting boundary for a durable `ImageAsset`; native camera objects do
not cross into application state.

## A2UI target studied

The target is the A2UI Protocol v1.0 Candidate, revision
`d9086fb73fb5ab535780b6af47a7440096d5785f` from the `main` branch, last
updated 2026-06-08.

The relevant M8 constraints are a renderer-local data model, Catalog Components
and Catalog Functions with schemas, typed bidirectional function calls, and
identifier-safe catalog names. M8 capability identifiers may remain expressive
(`vision.segment`); M9 can map them to catalog-safe aliases
(`visionSegment`). Capability arguments and results must consequently stay
plain serializable values.

## Native compatibility result

`onnxruntime-react-native@1.24.3` installs with its declared `react` and
`react-native` wildcard peers and builds the generated iOS Simulator app
successfully under Expo SDK 57 / React Native 0.86.2.

The same dependency cannot configure the generated Android build. The precise
failure is:

```text
node_modules/onnxruntime-react-native/android/build.gradle:250
Could not get unknown property 'VersionNumber' for object of type
org.gradle.api.internal.artifacts.dsl.dependencies.DefaultDependencyHandler.
```

That line evaluates `VersionNumber.parse(REACT_NATIVE_VERSION)` in the
dependencies block. The Expo 57 generated Android build uses Gradle 9.3.1,
where this unqualified/removed API is not available. The failure occurs before
compiling app code, so neither U2-NetP nor MobileNet V3 execution can be
spiked on Android.

`react-native-fast-opencv@1.0.1` was also present for the audit, but cannot
provide an M8 completion path while the required shared ONNX substrate blocks
Android. No library types were introduced into Gather code.

## Original decision and smallest next step

In accordance with the M8.0 stop condition, ONNX-dependent M8 work is paused.
The evaluated native dependencies are removed after this audit so the normal
application build remains unbroken.

The smallest viable next step is to obtain an ONNX Runtime React Native release
that explicitly supports Gradle 9 / Expo SDK 57, or an upstream-supported
compatibility fix for the `VersionNumber` use, and re-run the Android native
spike before selecting or implementing another inference stack. Do not patch
`node_modules`, downgrade Gather's generated Android toolchain, or substitute
another ML runtime without an explicit new decision.

## Applied resolution

Gather applies the exact upstream PR #27385 change using
`patch-package`. The committed
[`onnxruntime-react-native+1.24.3.patch`](../patches/onnxruntime-react-native+1.24.3.patch)
is replayed by the root `postinstall` script after every dependency install.

The generated Expo SDK 57 Android project then built successfully with
`./gradlew :app:assembleDebug`; the prior `VersionNumber` failure and secondary
`:expo` configuration error were absent. Android Hermes Metro export also
succeeds with the patched dependencies installed.

## Follow-up native gate attempt

An Android M8.0 substrate gate was added to initialize the autolinked ONNX
Runtime and Fast OpenCV modules and emit `M80_NATIVE_SUBSTRATE_RESULT::`.
The gate build succeeded twice on the known-good Pixel AVD, but Expo could not
install the generated APK because Android's package service closed its ADB pipe:

```text
adb install ... app-debug.apk
cmd: Failure calling service package: Broken pipe (32)
```

The emulator reported boot complete but `dumpsys package` subsequently returned
`Can't find service: package`, confirming an emulator system-service failure
after installation rather than a Gather/ONNX native crash. The emulator and
all gate-owned processes/logs were shut down. Re-run this gate from a fresh
healthy emulator before claiming on-device module initialization; the successful
Gradle build remains the verified native compatibility evidence.

## M8.1 implementation status

M8.1 now provides:

- serializable `ImageAsset` and `MaskAsset` contracts with raw-byte SHA-256;
- canonical JSON revision hashing;
- constrained, declarative Scientific Model Package validation for
  `segmentation.binary.v1` and `classification.ranked.v1`;
- stable model references and immutable execution receipts;
- a durable-image service that copies camera output into Gather-owned storage;
- a bounded ONNX session adapter whose public output contains only plain
  arrays/objects; and
- semantic `vision.segment` and `vision.classify` entry points that validate
  the model profile and do not expose tensors or sessions.

Focused M8 contract/runtime/vision tests and the full existing Gather unit
suite pass. Actual model artifacts, ONNX preprocessing/postprocessing, OpenCV
measurement implementation, Segment & Measure UI, and Android/iOS model gates
remain in progress.

## ONNX substrate gate result

The temporary dependency state is:

```text
onnxruntime-react-native: 1.24.3
upstream backports:
  - #27385 (Gradle 9 VersionNumber removal)
  - #28266 (Expo/RN package registration)
removal condition:
  upgrade to the first published onnxruntime-react-native release containing both
```

The backport is applied only through
`patches/onnxruntime-react-native+1.24.3.patch` and replayed by `postinstall`.
It contains the two upstream changes plus the minimal Kotlin template selection
needed because Expo SDK 57/RN 0.86 uses `PackageList(this).packages.apply`,
whereas #28266's original Kotlin insertion targets the older
`override fun getPackages()` template. This remains package-local behavior, not
a Gather config plugin or generated-project edit.

The focused `test/scientific/onnx-dependency-state.test.mjs` gate deliberately
asserts the temporary npm version and both upstream PR references. When
upgrading ONNX Runtime, update or remove that test and the patch in the same
change after confirming the published package contains both fixes.

`npx expo prebuild --clean --platform android` generated:

```kotlin
import ai.onnxruntime.reactnative.OnnxruntimePackage
...
PackageList(this).packages.apply {
  add(OnnxruntimePackage())
}
```

The official `onnxruntime-react-native` Expo plugin generated the Gradle
dependency as well. The backported `react-native.config.js` declares the same
package import/instance for ordinary RN autolinking.

The Android and iOS gates both executed the pinned 129-byte ONNX upstream
`test_add` model at
`onnx/backend/test/data/node/test_add@990217f043af7222348ca8f0301e17fa7b841781`
(SHA-256
`93cf0438706cddabf683adc8b13c8a17c4b8b12d8bccb1b041268e1f4dff0a2d`).
Both supplied `x = 0` and `y = 1` Float32 tensors of shape `[3, 4, 5]` and
verified that all 60 `sum` output values equal `1`.

```text
Android: onnxBackends=["cpu","xnnpack","nnapi"], fastOpenCvMat=true
iOS:     onnxBackends=["cpu","xnnpack","coreml"], fastOpenCvMat=true
```

The first iOS runner timed out even though its app screen showed the success
JSON and the active Metro log recorded the iOS `coreml` result. A stale Android
Metro child inherited that console output, so the iOS-specific stdout capture
did not receive it. The gate now also persists its terminal marker in the
app's Documents directory, and `run-ios-gate.sh` can poll that marker when
explicit bundle/file environment variables are provided. This is a
capture/teardown defect, not an ONNX failure. The completed iOS simulator must
not be reloaded for this result; it should be shut down after evidence is
recorded.

## Reference model packaging progress

Both reference artifacts are reproducibly exported at ONNX opset 17 and
installed only through the revision-addressed local Model Store:

| Model | Artifact SHA-256 |
| --- | --- |
| U2-NetP salient segmentation | `571926ae339d435a039712e7a0cf15798ae29a078cae4a56d090693b47d9c31e` |
| MobileNet V3 Large ImageNet-1K V2 | `b15d8e4946ad08687f928376445f7e19af1f5d98a1525c4ab1d2d7e4ebbc3356` |

The installer verifies artifact and label digests before writing
`projects/<projectKey>/models/<immutable-revision>/`. U2-NetP provenance is
`xuebinqin/U-2-Net@ac7e1c817ecab7c7dff5ce6b1abba61cd213ff29`; MobileNet
uses Torchvision `v0.28.0@8fb87713a24951e639c494b0f2a8a81b5f8e33a6` and its
`MobileNet_V3_Large_Weights.IMAGENET1K_V2` source weights.
The ImageNet label file digest is
`e697a491aa735cc6c2aaf982f8e86e8fc7b0a1ea7750a2cc6a2bdfc1e109012f`.

The exporter script and exact conversion metadata are retained with the
application at `experiments/m8-model-export/export_reference_models.py`; local
clones, weights, and its virtual environment are intentionally ignored. Full
reference-model execution and Segment & Measure device gates remain required
before M8 can be marked complete.

Image preprocessing uses Nitro Image's native file decode, resize, and raw
pixel APIs. Fast OpenCV receives raw RGB/binary buffers only for mask encoding
and scientific measurements; no captured full-resolution image is converted to
a Base64 string or sent through a string round trip. Measurements are explicit:
area is foreground-pixel count (`px2`), perimeter is the sum of all detected
contours (`px`), bounding boxes are pixel coordinates, centroid is the largest
connected foreground component's centroid, color is masked mean sRGB, and
sharpness is masked variance of Laplacian.

Each `vision.segment` and `vision.classify` execution creates an immutable,
serializable receipt containing capability revision, ModelRef, input digest,
parameters, output identifiers, runtime adapter, timestamp, and canonical
receipt revision. The accepted Segment & Measure result retains both receipts
in its provenance.

### Android reference-model gate (2026-08-29)

After a cold boot confirmed both `sys.boot_completed=1` and `service package:
found`, the isolated Android gate installed and ran successfully on
`Pixel_3a_API_34_extension_level_7_arm64-v8a`. It loaded the exact bundled
assets and performed deterministic zero-tensor inference:

```text
backends: ["cpu","xnnpack","nnapi"]
U2-NetP:       saliency [1,1,320,320], 102400 finite values, 5034 ms
MobileNet V3:  logits [1,1000], 1000 finite values, 363 ms
```

This proves the packaged artifact assets load and execute through the native
Android ONNX substrate. The pending iOS counterpart and full authoritative
capture-to-Model-Store workflow remain required for M8 completion.

### iOS reference-model gate (2026-08-29)

The corresponding isolated iPhone 16 Pro Simulator gate completed without
reloading after terminal output:

```text
backends: ["cpu","xnnpack","coreml"]
U2-NetP:       saliency [1,1,320,320], 102400 finite values, 623 ms
MobileNet V3:  logits [1,1000], 1000 finite values, 95 ms
```

Together with the Android result, this makes reference artifact loading and
native inference GREEN on both platforms. These timings include first session
creation and inference in the isolated gate; they are observations rather than
a real-time performance target.

## Final M8 capability gate (2026-08-29)

One final sequential Android/iOS checkpoint exercised the shared local Model
Store, public `vision.segment` and `vision.classify` capabilities, durable mask
materialization, deterministic Fast OpenCV fixture measurements, and the typed
Segment & Measure accepted-result contract.

| Platform | U2-NetP | MobileNet | Verified result |
| --- | ---: | ---: | --- |
| Android / NNAPI-capable emulator | 6346 ms | 16458 ms | Model Store revisions, durable mask, top-5 classes, `3 px2` fixture area, Laplacian sharpness, accepted result |
| iOS / CoreML-capable simulator | 7677 ms | 33305 ms | Model Store revisions, durable mask, top-5 classes, `3 px2` fixture area, Laplacian sharpness, accepted result |

The gate runs the Add-model substrate probe as well as both reference models.
It uses a deterministic native PNG input and mask fixture so it can validate
the entire durable computation path without requiring an interactive camera
session. The Segment & Measure screen separately supplies the human capture,
visible mask review, explicit Accept Mask/Retake decision, and result review.

The final Model Store revisions were:

```text
U2-NetP:      sha256:671161bf631eef0afea4dc06f982a2ef0084f55c79f1c375386ebc85a46ce815
MobileNet V3: sha256:1c33213e6e1ecea72e46fff91939ab83a0679313fca4d71573e0c82a391f3592
```

### Closeout performance evidence (2026-08-29)

The prior combined reference timings included bundle asset reads, Model Store
installation, and hash verification, so they must not be interpreted as pure
inference timing. The final gate installs each model once, then executes public
semantic capabilities twice through one Model Store and ONNX runtime:

| Platform | U2-NetP cold / warm | MobileNet cold / warm |
| --- | ---: | ---: |
| Android | 6626 / 6144 ms | 994 / 372 ms |
| iOS | 3187 / 547 ms | 188 / 82 ms |

Both warm paths reported `sessionCacheLookup` with `cacheHit: true`. Android
U2-NetP remains almost entirely `sessionRun` (~5.6 s); iOS cold U2-NetP was
dominated by first native decode/resize (~2.7 s), then warmed to ~48 ms for
that phase. MobileNet warm inference was ~140 ms Android and ~9 ms iOS. These
are correctness and field-usability observations, not real-time targets.

The deterministic gate proves the capture-result computation contract without
depending on simulator camera hardware. The native Segment & Measure screen
uses `SegmentAndMeasureCapture`, `MaskReview`, `MeasurementReview`, and
`ClassificationReview`; it keeps the visible human accept/retake decision
ahead of accepted measurements. Meaningful physical-camera acceptance remains
an operational field-device check because simulator camera input is not a
scientific capture substitute.

### Physical Android device gate (2026-08-29)

The final gate ran successfully on a connected **Pixel 10**
(`61090DLCR000B3`) after confirming `sys.boot_completed=1` and `service
package: found`. The runner was updated to honor `ANDROID_SERIAL`: it used
`adb reverse` with `localhost`, did not boot or target an emulator, and left
the completed app running.

```text
backends: ["cpu","xnnpack","nnapi"]
Add model: 60/60 output values equal 1
U2-NetP:  saliency [1,1,320,320], 102400 finite values
MobileNet: logits [1,1000], 1000 finite values
Model Store: both immutable revisions verified
Capabilities: durable mask, 5 ranked classes, 3 px2 fixture area,
              variance-of-Laplacian sharpness, accepted result
```

| Execution | U2-NetP | MobileNet |
| --- | ---: | ---: |
| Cold semantic capability | 500 ms | 158 ms |
| Warm semantic capability | 447 ms | 47 ms |

Both warm calls emitted `sessionCacheLookup` with `cacheHit: true`. Segmentation
was dominated by `sessionRun` (346 ms cold; 342 ms warm); classification warm
`sessionRun` was 11 ms. This gate validates the native computational and
durable-result workflow on physical Android hardware. It does not replace a
researcher-led visual assessment of a real captured subject and its proposed
mask in the interactive screen.

### Physical Android interactive validation (2026-08-29)

The full Segment & Measure workflow was then exercised end-to-end on the Pixel
10 with a live camera: capture → durable `ImageAsset` → real U2-NetP
segmentation → visible mask overlay → accept → OpenCV measurements → MobileNet
classification → accepted structured result. This real-camera run exposed four
defects that deterministic PNG fixtures could not, all now fixed and covered by
regression tests where applicable:

- **Segmentation double activation.** The exported U2-NetP ONNX already applies
  `sigmoid` (upstream `forward()` returns `F.sigmoid(d0)`), so the executor's
  second `sigmoid` saturated every pixel above threshold — a constant filled
  rectangle regardless of subject. Activation is now driven solely by declared
  postprocessing; the redundant step was removed from the U2-NetP package.
- **Classification resize geometry.** MobileNet now uses aspect-preserving
  shortest-side-232 resize + 224 center crop (matching Torchvision) instead of a
  squashed 232×232 square, restoring plausible predictions.
- **EXIF orientation drift.** Capture converts the photo via `toImageAsync`,
  baking orientation/mirroring into the durable pixels so React Native display,
  Nitro raw decode, and the mask agree on one upright orientation; the mask no
  longer appears rotated or mis-scaled.
- **Mask overlay rendering.** The proposed mask is written as RGBA with the
  binary value in its alpha channel and reviewed at the image's real aspect
  ratio, so it aligns with the reviewed image.

Camera UX was also finalized: a round centered shutter (white with a dark grey
border), a brief capture flash, and an immediate correctly-sized still after
capture (sized from the capture result's own dimensions to avoid a layout pop).
A `__DEV__`-only `[gather-scientific]` diagnostic logger records tensor and
activation statistics; it is inert in release builds and never crosses a
capability boundary.

With these fixes the researcher-reviewed masks align with the captured subject
and classifications are plausible on device, completing the M8 interactive
validation.


---

# Remediation research (2026-08-29)

Goal: identify exactly what is required to unblock the Android ONNX Runtime
substrate so M8 can proceed. No M8 implementation performed.

## Root cause (confirmed)

`onnxruntime-react-native@1.24.3`, `android/build.gradle`:

- Line 68 reads the React Native version string.
- Line 250 gates a legacy `fbjni` dependency using Gradle's internal
  `org.gradle.util.VersionNumber` class:

  ```groovy
  if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {
    extractLibs "com.facebook.fbjni:fbjni:+:headers"
    extractLibs "com.facebook.fbjni:fbjni:+"
  }
  ```

`VersionNumber` is an internal Gradle API that was deprecated and then removed.
It is not resolvable inside a `dependencies {}` block under the Gradle 9.3.1
toolchain that Expo SDK 57 generates, producing exactly:

```
A problem occurred evaluating project ':onnxruntime-react-native'.
> Could not get unknown property 'VersionNumber' for object of type
  org.gradle.api.internal.artifacts.dsl.dependencies.DefaultDependencyHandler.
```

This is a build-configuration failure. It aborts before any app/native code is
compiled, which is why neither U2-NetP nor MobileNet V3 could be spiked on
Android. iOS is unaffected (the iOS Simulator app built successfully with the
same package installed).

## Upstream status (confirmed)

The exact bug is already fixed upstream, but only on `main`:

- Fix: microsoft/onnxruntime PR **#27385**, "Fix VersionNumber usage in React
  Native Android build with major version validation", merged
  **2026-02-25**, commit `f3a628458238047974eac7dd2114c7bb34326841`.
- The fix removes `VersionNumber` entirely and compares integer major/minor
  versions parsed from the version string (the file already parses the minor
  version this way for its CMake flags):

  ```groovy
  def versionParts = REACT_NATIVE_VERSION.split("\\.")
  if (versionParts.length < 2) {
    throw new GradleException("Invalid React Native version format: ...")
  }
  def REACT_NATIVE_MAJOR_VERSION = versionParts[0].toInteger()
  def REACT_NATIVE_MINOR_VERSION = versionParts[1].toInteger()
  ...
  if (REACT_NATIVE_MAJOR_VERSION == 0 && REACT_NATIVE_MINOR_VERSION < 71) {
    extractLibs "com.facebook.fbjni:fbjni:+:headers"
    extractLibs "com.facebook.fbjni:fbjni:+"
  }
  ```

Release gap: the fix is **not in any published npm version**. `1.24.3` (the
`latest` tag, published 2026-03-05) predates none of this by content — it was
cut from the `rel-1.24.x` patch branch and did not receive the `main`
cherry-pick, so it still ships the broken `VersionNumber` line. The only
published `dev` tag (`1.21.0-dev...`) is far older. As of 2026-08-29 there is no
`1.25.x` on npm. Therefore "just upgrade the package" is not currently an
available path.

## What is required to move forward

Ranked from smallest/most-aligned to largest.

### Option A (recommended): pin the exact upstream fix with `patch-package`

Apply PR #27385's change to
`node_modules/onnxruntime-react-native/android/build.gradle` via
[`patch-package`](https://www.npmjs.com/package/patch-package), committing the
generated patch under `patches/` and running it from a `postinstall` script.

Why this is the right unblock:

- It is the **exact merged upstream fix**, not a Gather-invented workaround.
- It is a two-hunk, self-contained change with no behavioral effect for
  RN >= 0.71 (Gather is on 0.86), so it cannot change runtime behavior.
- It is deterministic, reviewable, and trivially revertable once a fixed
  `onnxruntime-react-native` release ships (delete the patch, bump the version).
- It requires **no toolchain downgrade** and **no runtime substitution**, so it
  respects the M8.0 "do not silently substitute another stack" rule.
- Expo `prebuild`/`run:android` reads the module's `build.gradle` directly from
  `node_modules`, so patching `node_modules` is sufficient; the gitignored
  generated `android/` folder does not need to carry the change.

Requirements to implement (later, not in this task):

1. Add `patch-package` (and `postinstall-postinstall`) as devDependencies.
2. Add `"postinstall": "patch-package"` to `package.json` scripts.
3. Re-install `onnxruntime-react-native@1.24.3` and `react-native-fast-opencv@1.0.1`.
4. Edit the two hunks in the module's `build.gradle`, run
   `npx patch-package onnxruntime-react-native`, commit `patches/`.
5. Re-run the Android configure/build to confirm.

### Option B: Expo config plugin (dangerous-mod) rewrite at prebuild

A local config plugin could rewrite the offending line during
`expo prebuild`. This works but is heavier than Option A, only fixes the copy
inside a regenerated project (not the `node_modules` source Metro/Gradle reads
for library modules), and duplicates logic that `patch-package` handles more
directly. Prefer Option A unless a patch-package postinstall is undesirable.

### Option C: wait for a fixed release

Track `onnxruntime-react-native` for the first published version that contains
PR #27385 (expected in a `1.25.x` line; none exists on npm as of 2026-08-29).
When it lands, remove the Option A patch and bump the dependency. Not viable as
the near-term unblock given no ETA.

### Not recommended: substitute the inference runtime

Switching away from ONNX Runtime (e.g. to another RN ML runtime) would violate
the M8.0 "do not silently substitute another stack" rule and discard the plan's
pinned reference-model provenance strategy. Only revisit if the upstream fix
proves unshippable.

## Secondary Android error to re-verify

The failed build also reported a second configuration failure:

```
A problem occurred configuring project ':expo'.
> SoftwareComponent with name 'release' not found.
```

Assessment: almost certainly a **cascade** of the primary `VersionNumber`
failure, not an independent blocker:

- The base Expo SDK 57 Android build (the committed M6/M7 device gates) builds
  and runs without these libraries, so the Expo autolinking aggregator project
  is healthy on this toolchain.
- Neither newly added module declares a `maven-publish` / `from components.release`
  block: `onnxruntime-react-native@1.24.3`'s only `afterEvaluate` is
  `nativeBuildDependsOn(extractLibs, null)`, and `react-native-fast-opencv@1.0.1`
  has no publishing block at all. So no added module introduces the `release`
  software component the error names.
- Gradle commonly emits a secondary inconsistent-configuration error on the
  autolinking umbrella project when one autolinked module aborts configuration.

Action: after applying the Option A fix, re-run the Android configure phase. If
the `:expo` error persists once ONNX configures cleanly, investigate it
independently at that point.

## react-native-fast-opencv compatibility (green)

`react-native-fast-opencv@1.0.1` ships a modern `android/build.gradle`:
AGP `8.12.0`, `compileSdk 36`, NDK `27.1.12297006`, Kotlin `2.1.20` — matching
the versions Expo SDK 57 already resolves for this project. It uses no removed
Gradle internal APIs and no publishing block. It is not expected to block the
Android build; it could not be verified end-to-end only because the shared ONNX
substrate aborted configuration first. Re-verify alongside the Option A fix.

## Definition of "unblocked"

M8 ONNX-dependent work can resume once, on a device/emulator:

1. `onnxruntime-react-native` configures and the Android app builds (via the
   Option A patch).
2. The `:expo` secondary error is gone or resolved.
3. `react-native-fast-opencv` builds in the same app.
4. A minimal on-device spike loads and runs U2-NetP and MobileNet V3 ONNX
   graphs on both Android and iOS (M8.0 steps 7-8).

Until step 4 passes on both platforms, keep the `m8-computational-capability`
todo blocked.
