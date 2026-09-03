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

> **⚠️ CORRECTED 2026-09-02 — this subsection was wrong.** `callFunction` is the
> *agent→renderer RPC message*, which v0.9.1 lacks; the **local** action shape is
> `functionCall`, and it is present and largely implemented (catalog function
> registry, argument validation, loud failure on unknown names, async
> execution). Searching for the wrong identifier produced a false negative.
> The real gap is narrower: `action.functionCall` is evaluated *eagerly* rather
> than on interaction, and there is no result destination for an action-position
> call. See [a2ui-functioncall-gap.md](./a2ui-functioncall-gap.md), which
> supersedes everything below in this subsection.

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

## Step 5 device proof: handler-free authored composition (2026-09-02)

Run on a physical Pixel (`gates/DevSeedAuthoredCompositionApp.js`), seeding
project `dev-seed-authored` with form `dev_seed_authored_photo`, its
`gather-bindings.json`, and `authored_photo_v1.a2ui.json` — all three as *form
resources*. The seed registers **no** composition handler
(`registeredHandlers: "none"`), which is the point: the form supplies the
composition.

### What the proof establishes

- The composition rendered from the form resource alone — its own title,
  `CameraView`, `Save photo`, `Accept and submit` — with the backing fields
  (`/data/photo/note`, `/data/photo/image`) hidden because the manifest declares
  the group owned.
- `gather_persistAsset` pushed its result to `resultPath: /working/image`; a
  bound `Text` showed the returned `assetId`. Push semantics for an
  action-position call, as designed.
- `gather_completeComposition` committed both outputs, promoted the `media`
  projection into instance media, and minted one receipt per written binding:

  ```xml
  <data id="dev_seed_authored_photo"><site_name/><photo><note>authored</note>
  <image>image-mtkqqk2r09y6mj.jpg</image></photo>…</data>
  ```

  `instance_media` = `/data/photo/image | image-mtkqqk2r09y6mj.jpg | image/jpeg`;
  `instance_receipts` = 2 rows under `authored_photo_v1`, revision
  `sha256:759aa6d2…`.
- Exactly **one** instance row: no stale-closure duplicate draft.
- Save → exit → reopen from Drafts → Resume → save again preserves the XML, the
  media row and both receipts unchanged.

### Defects the proof found

**1. Resume never handed the runner the form's resources.** `resume()` had
`cached.attachments` in hand (it passes them to `loadInstance`) but did not
return them, and `RunnerBody`'s resume branch left `manifest`/`formAttachments`
null. On resume — and only on resume — every composition field rendered as
*"Composition … has no entry in this form's binding manifest, so its results
have nowhere to go."* Fixed: `resume()` returns `attachments`, the runner sets
both from it. Regression assertion in
`test/instances/instance-lifecycle-service.test.mjs`.

This is the third defect in this area reachable only by driving `FormRunner`
itself, and it has the same shape as the earlier two: a value the fresh-fill
path computes and the resume path silently omits.

**2. Hermes cannot transform a conditional whose branches are destructuring
arrows in a property position.** The original
`completeComposition: field ? async ({ outputs }) => {…} : undefined` inside an
object literal failed the bundle with `Property id of VariableDeclarator …
got "ObjectExpression"` — a Metro 500, not a runtime error. Fixed by hoisting
both host implementations into named `useCallback`s.

**3. A promoted working asset is never reclaimed.** *(Resolved — see
[b-custom §4b](./b-custom-composition-conventions.md); retention moved from
`persistAsset` to the output binding, applied at completion.)* After
`completeComposition` copied the capture into
`media/<instance>/image-mtkqqk2r09y6mj.jpg`, the ledger still holds the source:

```
projects/dev-seed-authored/media/image-1788392407633-….jpg | keep | (no instance)
```

257 KB duplicated per capture, permanently, because `retention: 'keep'` and no
`local_instance_id` put it outside every sweep. The fixture asked for `keep`, so
the ledger is behaving as declared — the open question is whether
`completeComposition`, which already owns media promotion, should also release
the working assets it promoted. Not changed here; it is a semantics decision.

**4. `assetId` is minted twice.** *(Resolved — `persistCapture` now takes the
caller's id; promotion consumes the existing asset rather than creating a
second Gather identity.)* The ledger row's `asset_id` and filename
(`image-…633`) differ from the `assetId` on the returned `ImageAsset`
(`image-…694`), because `imageAssetService.persistCapture` mints its own id
rather than reusing the ledger's. The `path` (fileKey) is the only shared
truth, and it is what promotion actually keys on — so nothing is broken today,
but two ids for one asset is a trap for anything that later tries to correlate
a receipt's `assetId` with a ledger row.

### Not a defect

Taps below the composition surface appeared dead until the LogBox
"Open debugger to view warnings" toast was dismissed — a dev-build overlay, not
app behaviour. Worth remembering: it silently swallows touches over the lower
third of the screen and produces no error of any kind, which reads exactly like
a broken button.

### Cosmetic

The runner labels any draft instance `Saving draft` (`FormRunner.js`), a
progress phrase used as a state noun. It reads as a stuck spinner. Left alone
here; it belongs to the UI pass with the shutter flash.
