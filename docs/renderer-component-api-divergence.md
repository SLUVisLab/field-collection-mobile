# The renderer redefines the Gather Component APIs, and they have drifted

**Finding, 2026-09-05.** Blocks "exercise the authored Tool in the Composer
preview with real inference".

## What is wrong

`apps/renderer/src/gatherComponents.jsx` declares its **own** component API
schemas. `src/a2ui/mobile/componentApis.js` declares the ones the app uses. They
are two registries for one contract, and they no longer agree.

```js
// src/a2ui/mobile/componentApis.js — what the app runs
cameraViewApi.schema = z.object({
  statePath: z.string().optional(),
  capture: CommonSchemas.DynamicValue.optional(),   // ← the authored output
}).strict();

// apps/renderer/src/gatherComponents.jsx — what the preview runs
CameraViewApi.schema = z.object({
  statePath: z.string().optional(),
}).strict();                                        // ← no `capture`
```

The canonical Tool authors exactly the property the renderer does not accept:

```json
{ "id": "camera", "component": "CameraView", "capture": { "path": "/working/capture" } }
```

So in the Composer preview the binding is dropped. The camera is also blocked by
Permissions Policy, and `CameraView` then calls `onCapture(null)`. Between the
two, **pressing the shutter in the preview produces no capture at all**, and the
Tool cannot reach `gather_persistAsset` — let alone `image_segment`.

The device path is unaffected: it uses the shared API and the `setCapture`
writer, which is how a handler-free composition receives a capture with no
registered handler. That is the mechanism M10 proved on hardware.

## Why it matters beyond the camera

This is the "second registry" failure this project has eliminated everywhere
else — the Model Catalog, the Capability projection, the compatibility rules all
have exactly one definition and are projected outward. The renderer's component
APIs are the remaining copy, and they drifted silently because nothing compares
them.

`MediaGallery`, `MultiImageCapture`, `ImageOverlay`, `OutputReview` and the rest
are redefined the same way, so any of them may have drifted too. Nothing checks.

## What the fix needs to establish first

The renderer binds through `@a2ui/react`'s `createComponentImplementation`,
whose component context currently exposes only `dispatchAction` in our usage.
The app binds through `bindInstrumentComponent` → `GenericBinder`
(`@a2ui/web_core/v0_9/bindings`), which is what injects a `setCapture` writer for
a path-bound `DynamicValue`.

**Open question:** does `@a2ui/react` expose the same output-writer mechanism? If
it does, the renderer should import the shared `componentApis.js` and the fix is
small. If it does not, the renderer needs the `GenericBinder` path the app
already uses — a larger change to how the renderer binds every component.

Answer that before writing code. It decides whether this is an import or a
rebinding.

## Sample input, once that is settled

No new A2UI concept is needed. `CameraView` already degrades when
`getUserMedia` fails and already accepts `leading`/`trailing` slots, so the
**preview host** supplies a "Choose sample image" control that produces the same
capture descriptor the shutter would:

```text
{ uri, path, contentType, width, height }
```

From there the Tool cannot tell whether the image came from a native camera, a
browser camera or a local file — which is the property worth preserving, and the
reason not to add a `SampleImage` component or an authoring-only FunctionCall.
