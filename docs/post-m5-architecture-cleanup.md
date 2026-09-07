# Post-M5 architecture cleanup

## Structure

The application composition is now intentionally small:

```text
App.js
  └── GatherProvider
        └── startup loading/error/router composition
              └── AppNavigator
```

- `src/bootstrap.js` retains dependency-injected, storage-first startup logic.
- `src/context/` owns the Gather composition root and the canonical `useGather()`
  application hook.
- `src/xforms/` maps engine render projections to Gather presentation components.
- `src/components/forms/` contains XForms-agnostic field presentation.
- `src/capabilities/` contains trusted native operations with no XForms references.

`FormRunner` remains responsible for form-session and instance-lifecycle
orchestration. `XFormsRenderer` dispatches ordered, relevant engine nodes through
the public `odk-xforms-react` hooks. The engine remains the sole authority for
values, calculations, relevance, choices, repeats, validation, and serialization.

## Native foundations

- VisionCamera 5 + Nitro Modules provide photo capture and QR scanning.
- `camera.capture()` returns a plain local-file result, never a native VisionCamera
  object. `attachImageMedia()` owns the coordinated durable-media/XForms/XML update.
- Production image questions use camera capture. The deterministic JPEG moved to
  gate-only fixtures.
- `expo-location` supplies a foreground, one-shot `location.getCurrent()` capability.
- `GatherMap` composes MapLibre directly with the OpenFreeMap Liberty style.

The ODK Collect Settings QR parser and provisioning service remain unchanged:
camera code supplies raw text only; it does not parse, log, or persist it.

## Validation

| Check | Result |
| --- | --- |
| Package tests + app tests | PASS (50 app tests) |
| Android production bundle | PASS |
| Android native assembly | PASS |
| Android MapLibre/OpenFreeMap style + marker | PASS |
| iOS MapLibre build/install + visible map | PASS |
| Android VisionCamera preview/photo/local-file capability | PASS |
| Android VisionCamera QR scanner mount | PASS |
| iOS M5 full live regression | PASS |
| Android M5 full live regression | PASS |

Both M5 live regressions verified draft/resume, Entity selection, deterministic
image media, foreground multipart OpenRosa submission, Central XML read-back, and
test-submission deletion.

### iOS simulator limitation

iOS Simulator does not provide the rear-camera/sensor stack VisionCamera requires;
attempting to mount a camera there previously surfaced an accelerometer-unavailable
native failure. Camera and QR components now preflight `useCameraDevice('back')`.
On an iOS simulator with no device they show the explicit unavailable/paste-fallback
state instead of mounting the native scanner. No physical iOS device was connected
for a real camera/QR scan. This does not affect iOS M5 fixture-media regression,
which passed.

Device gates must run sequentially, with the prior simulator/emulator shut down
before the other platform starts.
