# Composition behaviour audit: what actually needs a Gather API

**Date:** 2026-09-02
**Subject:** [`src/a2ui/capabilityActionAdapter.js`](../src/a2ui/capabilityActionAdapter.js)
— the Segment & Measure handler, 182 lines, the largest and most realistic
composition behaviour we have.
**Method:** classify every behaviour into one of four buckets. Whatever survives
in the last bucket is the API we need; everything else should disappear into
machinery we already have.

## The principle this serves

> **Do not build a composition behaviour system alongside A2UI.** Extend A2UI
> only at the seams where Gather-specific runtime behaviour cannot already be
> expressed through Components, bindings, actions, and registered functions.

Preference order: **A2UI directly** → **Component API** → **Capability
contract** → and only then a Gather-specific extension.

## The classification

| Handler behaviour | Bucket | Notes |
| --- | --- | --- |
| `setData({ image, segmentation, … })` | **A2UI** | An ordinary `updateDataModel` write. Authorable today. |
| `flow.setView(X)` | **A2UI** | **Reduces to a data-model write.** See below. |
| `controller.reset()` | **A2UI** | A write of the initial view plus cleared fields. |
| `setData({ error })` + error View | **A2UI** | Writes; the *catching* is runtime (see blockers). |
| `context.capture ?? capabilities.capture?.()` | **Component** | Acquisition is Component-owned; `CameraView` emits the descriptor. The capability fallback is legacy. |
| Mask overlay / review rendering | **Component** | Already `ImageOverlay` / `OutputReview` shaped. |
| `segmentScientificImage({ image })` | **Capability** | `image.segment`. Contract exists. |
| `classifyScientificImage({ image })` | **Capability** | `image.classify`. |
| `measureScientificMask` / `measureScientificImage` | **Capability** | `measure.*`. |
| `Promise.all([mask, image, classification])` | **blocked** | Parallel fan-in is orchestration, not a capability. |
| `requireValue(...)` guards | **blocked** | Needs a conditional. |
| `if (status === accepted && result) return` | **blocked** | Idempotence needs a comparison. |
| `persistScientificCapture(capture)` | **Gather host** | Durable asset + ledger row. Crosses into storage lifecycle. |
| `createSegmentAndMeasureResult({…})` | **Gather host** | Result assembly — **absorbed** by a declarative completion (below). |
| `onAcceptedResult(result, …)` | **Gather host** | The completion seam into XForms. |

## Result: the genuinely missing API is two operations

```text
persistAsset          local capture → durable ImageAsset + ledger disposition
completeComposition   declared outputs → typed result → host/XForms lifecycle
```

Both cross into host and XForms lifecycle rather than ordinary A2UI behaviour,
which is exactly why they survive. And `completeComposition` **absorbs result
assembly**: if a composition declares its outputs the way Quadrat Tally already
does, "complete with these paths" replaces a bespoke result builder.

### The reductions hold

**`setView` is not needed.** `Flow` already binds `current: { path:
'/gather/status' }`, so a view transition *is* a data-model write. The
`FlowController` is machinery wrapped around a binding that already exists.
Instead of `setView: review`, an authored action writes
`/gather/activeView = "review"` and `Flow` reacts. Confirmed by reading the
shipped catalog, not inferred.

**`invokeCapability` should not exist as a Gather concept** — A2UI has a
function mechanism (`callFunction`, v1.0 `callRendererFunction`), and the
Capability Registry should expose capabilities *to* it rather than inventing a
parallel calling convention. But see the blocker below: it cannot be used yet.

## Two runtime blockers, neither of which is an API question

These are the real findings, and they change sequencing.

### 1. The shipped runtime has no function-call mechanism

`@a2ui/web_core@0.9.1` contains **no `callFunction` implementation at all**.
Across the whole package: `createSurface` 45 occurrences,
`updateDataModel` 30, `callFunction` **0**. `FunctionDefinition` appears only in
the catalog *schema* (`client_capabilities.json`), so a catalog can *declare*
functions that nothing can invoke.

So capability invocation cannot be authored today, however much we would like
the reduction. It is blocked by the runtime, not by the design.

> **Correction to [a2ui-v1.0-migration-notes.md](./a2ui-v1.0-migration-notes.md):**
> that document attributes the block to the v1.0 `callFunction` →
> `callRendererFunction` rename. A rename blocks nothing. The M9 direction is
> blocked because **v0.9.1 never implemented the feature**, which also means
> adopting a runtime that does is a *prerequisite* for authored capability
> invocation rather than an optional migration.

### 2. There is still no conditional or comparison primitive

Guards (`requireValue`) and idempotence (`status === accepted && result`) need a
conditional. A2UI has no conditional-rendering primitive in v0.8, v0.9 or v1.0,
and **v1.0 removed the comparison functions** from the standard library. So
either these stay host-side, or authored compositions must be designed not to
need them — the same constraint that produced `Flow` in the first place.

## Composer implications

Anything added must be **declarative, schema-described, and discoverable from
the same catalog/runtime metadata Composer already receives** — not prose in a
prompt. v1.0 supplies most of the vocabulary for that, which is a second reason
it matters here:

| v1.0 feature | Why it matters for authored compositions |
| --- | --- |
| `requiresUserActivation` on `FunctionDefinition` | Expresses "needs a user gesture" at protocol level — right for capture, currently only a convention |
| `allowedCallers` (`rendererOnly` default) | Scientific capabilities are renderer-only *by default*, so the M8/M9 boundary is protocol-aligned rather than accidental |
| `instructions` on a catalog | A home for authoring rules the Composer agent can actually read |
| `allowedParents` / `allowedChildren` | Real validation errors instead of a silently empty surface |
| `metadata.extensions` | Sanctioned per-component extension point |

So `completeComposition`'s definition should declare what it does, what inputs
it accepts, when it is valid, and what result schema it must satisfy — the same
way a Component declares its props.

### One authoring hazard to carry forward

v1.0 makes `updateDataModel` **delete a key** when a path is set to `null`.
Today's handler writes `setData({ image: null, segmentation: null, … })` meaning
*clear*. Turning those into authored writes converts a semantic difference into
an authoring trap, so a "clear" idiom has to be chosen deliberately.

## What this audit does *not* conclude

It does not justify building the vocabulary. Two of the three verbs we might
have invented dissolve on inspection (`setView` into a binding,
`invokeCapability` into a mechanism A2UI already specifies), and the two that
remain are host-lifecycle seams rather than a behaviour language. The tripwire in
[b-custom §6](./b-custom-composition-conventions.md) stands: a second and third
real composition first, then extract the smallest model their *shared* behaviour
reveals.
