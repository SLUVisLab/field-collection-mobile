# A2UI v1.0 migration notes

**Date:** 2026-09-01
**Sources:** [v1.0 evolution guide](https://a2ui.org/specification/v1.0-evolution-guide/),
[v1.0 protocol](https://a2ui.org/specification/v1.0-a2ui/),
[v1.0 Basic Catalog implementation guide](https://a2ui.org/specification/v1.0-basic-catalog-implementation-guide/)
**Gather baseline:** `@a2ui/web_core@0.9.1`, catalog `gather-v0.1` at protocol `0.9`
**Status:** reference notes — no migration performed

Gather stays on A2UI v0.9 for now. This records what v1.0 changes, what it does
*not* change, and which Gather decisions depend on that, so the eventual
migration is a planned change rather than a rediscovery.

## Release status justifies staying on v0.9

v1.0 (previously v0.10 in draft) is a **release candidate**. The specification
itself recommends v0.9.1 for production use. Our existing reason for holding —
hosted Composer compatibility — is reinforced by upstream's own guidance, not
merely tolerated by it.

## The headline finding: conditional rendering is still absent in v1.0

This was the question that prompted the review, and the answer is settled across
three v1.0 documents:

- The v1.0 Basic Catalog is the **same 18 components** as v0.9 — `Text`, `Image`,
  `Icon`, `Video`, `AudioPlayer`, `Row`, `Column`, `List`, `Card`, `Tabs`,
  `Divider`, `Modal`, `Button`, `TextField`, `CheckBox`, `ChoicePicker`,
  `Slider`, `DateTimeInput`. No `Conditional`, `If`, `Switch`, `Show`, or `When`.
- `ComponentCommon` still has **no `visible` / `hidden` / `if` property**. v1.0
  adds `catalogId` and `metadata.extensions` to it, and nothing about display.
- The one new `hidden` is on `AccessibilityAttributes`, as a `DynamicBoolean`
  alongside WAI-ARIA `live` region support. Its stated concern is assistive
  technology; the guide does **not** define any rendering or layout effect.

**Do not use `accessibility.hidden` for conditional rendering.** It is
`aria-hidden` semantics. A component hidden from assistive technology while still
occupying layout is an accessibility defect, and any renderer that happened to
map it to `display: none` would be doing something the spec does not sanction.
Our own [AGENTS.md](../AGENTS.md) accessibility rules forbid this shape.

Conclusion: if an instrument needs data-driven *visibility*, a custom catalog
component is the only way to express it, in v0.9 *and* in v1.0 — the hole is
permanent, not a v0.9 wart that v1.0 closes. Gather's answer is to avoid needing
it at all; see [Design decision](#design-decision-one-stable-tree-values-vary).

## Correction to an earlier recommendation

An earlier review of `PhaseView` suggested replacing its
`phase` + `when: [...]` string-set membership with a single
`condition: DynamicBoolean`, on the reasoning that authors could then use the
expression library (`equals`, `greaterThan`, `and`, `or`, `not`) instead of only
set membership.

**v1.0 invalidates that reasoning.** The v1.0 standard function library is:

```
@index, formatString, required, regex, length, numeric, email,
formatNumber, formatCurrency, formatDate, pluralize, openUrl, and, or, not
```

The **comparison functions are gone** — no `equals`, `notEquals`, `greaterThan`,
`lessThan`, `contains`, `startsWith`, `endsWith` — as are the arithmetic ones
(`add`, `subtract`, `multiply`, `divide`), all of which exist in the installed
v0.9.1 basic functions. Confirmed independently from both the v1.0 protocol page
and the v1.0 Basic Catalog implementation guide.

So under v1.0 there is no built-in way to express "phase equals review-mask" as a
`DynamicBoolean`. A `condition`-shaped component would have forced us to ship our
own comparison function just to stay useful, while `when: [...]` needs none — the
membership test lives in the component.

**Both shapes are now moot for Gather:** the design decision below removes the
conditional component entirely rather than reshaping or renaming it. The finding
is retained because it applies to any future Gather catalog component that is
tempted to take a `DynamicBoolean` condition — under v1.0 there is no standard
function to produce one from a comparison.

## Where the agent actually is

A2UI's division of labor explains the missing conditional, and it only makes
sense once you locate the agent:

> **Structure comes from the agent** (`updateComponents`). **Values come from the
> data model** (`Dynamic*` bindings).

`updateComponents` is a first-class repeatable message, so evolving the tree over
time *is* the designed mechanism — you do not need `if` in a document the agent
simply re-sends. v1.0 sharpening the roles to **renderer** and **agent**
reinforces it: the renderer is meant to be dumb.

Gather has exactly one agent, and it is not in the field app:

| | Authoring time | Collection time |
| --- | --- | --- |
| Agent present | Yes — hosted Composer | No, by design |
| Network | Yes | No |
| What gets decided | **Structure** — the component tree | **Values** — the data model |

Composer is a real agent↔renderer loop over `postMessage`
([composerBridge.js](../apps/renderer/src/composerBridge.js)): it sends
`RENDER_A2UI`, `DATA_MODEL_CHANGE`, and `GET_CATALOG`; the renderer answers
`RENDERER_READY`, `A2UI_CATALOG`, and `SEND_TO_SERVER`. The field app has no
agent at all — `SegmentAndMeasureInstrument` replays the immutable bundle once
(`processMessages` inside a `useMemo` with `[]` deps) and thereafter only the
data model mutates, through `surface.dataModel.set`. **No `updateComponents` is
ever sent at runtime.**

This is not a gap to close. The M6 gate fails if any network request escapes its
offline section, so a live agent streaming structure is *architecturally
unavailable* at collection time and always will be. A local driver emitting
batches offline is possible, but that is Gather code simulating an agent — the
mechanism without the architecture.

## Design decision: one stable tree, values vary

> **Superseded 2026-09-01.** This section is retained as history. Segment & Measure
> now uses **Direction A (host reshapes `root.children` per phase)** — see the
> [Reassessment](#reassessment-2026-09-01-segment--measure-already-trips-the-tripwire)
> below and the [Implementation note](#implementation-2026-09-01-direction-a-shipped)
> at the end. The text below describes the earlier "one stable tree" design that
> was replaced.

This is what "structure from the agent, values from the data model" looks like
when the agent runs at authoring time instead of runtime — not a workaround for
the missing conditional. It also keeps the instrument a single surface, which is
the shape Composer can author in one pass.

How each phase is expressed without gating structure:

| Concern | Mechanism |
| --- | --- |
| Status copy | `Text.text` bound to `/gather/statusText` |
| Action labels | Button `child` `Text` bound to `/gather/primaryLabel` and `/gather/secondaryLabel` |
| Action availability | `checks` with a `DynamicBoolean` condition on `/gather/canAdvance` / `/gather/canGoBack`; upstream `GenericBinder` turns these into the `isValid` flag the Button binding maps to its disabled state |
| Action intent | `Button.action.event.name` is a **static** string in the A2UI schema, so the tree declares one `gather.advance` and one `gather.back`, and the host resolves meaning from the current phase |
| Empty regions | Components are total — they render an empty slot rather than being absent |

`SEGMENT_AND_MEASURE_PRESENTATION` in
[segmentAndMeasure.js](../packages/gather-catalog/src/segmentAndMeasure.js) is
the single phase→presentation contract, shared by the instrument's seed data
model and the host adapter, so a new phase cannot ship without its bound values.

**Accepted costs.** Presentation strings move into the data model (the adapter
computes UI copy); components carry more internal states; and during `capture`
and processing the two actions are visible but disabled. Keeping the round
centered shutter inside the camera — the M8 physically-validated UX — is why the
primary action is not the shutter.

**Tripwire.** The first instrument needing a materially different *layout* per
phase means structure genuinely varies at collection time. Revisit then, with
per-phase `updateComponents` batches re-pointing `root.children` (merge-only
semantics: there is no delete, so orphaned ids linger) — do not reach for a
conditional component.

## Reassessment (2026-09-01): Segment & Measure already trips the tripwire

A later review concluded the "one stable tree, values vary" decision above is
sound as a *principle* but **mis-applied to Segment & Measure specifically**, and
that misapplication is the direct cause of the visible symptoms (two greyed
buttons under the live camera; generic `advance`/`back` resolved by a host
`switch`; a `SEGMENT_AND_MEASURE_PRESENTATION` machine mirroring the phase
machine). The reasoning:

1. **This screen meets the tripwire as written.** Its phases are not one layout
   with different values — they are three materially different layouts: a live
   camera, an image + mask overlay with review actions, and a results summary
   with submit. That is exactly the "materially different *layout* per phase"
   condition the tripwire reserves for `root.children` reshaping.

2. **The current design already does conditional rendering — just hidden.** Every
   Gather leaf component in
   [segmentAndMeasureComponents.js](../src/a2ui/mobile/segmentAndMeasureComponents.js)
   is `if (phase !== X) return null`. "Components are total; they render an empty
   slot" is a euphemism for the renderer conditionally rendering nothing. The
   conditional wasn't removed with `PhaseView`; it was smeared across five custom
   components plus a host-side action `switch`, which is harder to see, not more
   declarative.

3. **The "offline ⇒ no runtime `updateComponents`" inference is the weak link.**
   The host is *already* the offline driver: `surface.dataModel.set(...)` in
   [capabilityActionAdapter.js](../src/a2ui/capabilityActionAdapter.js) is the
   host locally emitting `updateDataModel` with no network. Re-pointing
   `root.children` from that same host is the same local, offline, deterministic
   actor emitting a different message type. The M6 gate forbids **network**, not
   structural writes. So "structure at runtime = simulating an agent" draws an
   arbitrary line the offline architecture does not actually require.

4. **Verified the mechanism works** (protocol-level spike against upstream
   `MessageProcessor`): re-sending `root` with new `children` re-parents live and
   fires `ComponentModel.onUpdated`; `GenericBinder` rebuilds structural children
   on `onUpdated` and the mobile `InstrumentNode` reacts to
   `onCreated`/`onDeleted`, so both renderers follow. The swapped-in `Button`
   stays an upstream Basic Catalog `Button` with its real `gather.accept` action.

**Recommendation — Direction A (host reshapes `root.children` per phase).** Author
`captureGroup` / `reviewGroup` / `summaryGroup` / `errorGroup` once in the bundle
(Composer still authors every component and binding); have the adapter's
`setState` also emit a local `updateComponents` re-pointing `root.children` to the
phase's group. Restore distinct `gather.accept` / `gather.retake` (handlers still
exist), delete generic `advance`/`back` and the `SEGMENT_AND_MEASURE_PRESENTATION`
mirror, and drop the `return null` self-hiding from leaf components. Result: a pure
camera in `capture`, upstream `Button`s with distinct authored actions (restores
the M9 goal), and *less* host logic — not more. The only thing given up versus the
frozen-tree ideal is that the phase→group mapping lives in host code, but the phase
machine already lives there today.

**Fallback — Direction B (keep the frozen tree).** Only if a literally frozen
single `updateComponents` with zero runtime structure messages is a hard rule.
Then add the "total actions component" to hide the buttons during `capture`,
restore distinct accept/retake if feasible, and narrow the M9 doc's "Basic Catalog
`Button` composition" claim to match reality (`Column`, `Text`).

This reassessment records the analysis; the implementation note below records the
decision taken. Independent of that choice, two flagged items still need action:
the skipped Composer-equivalence test needs a real hosted-Composer re-authoring
session, and the pinned assembler actually fetches the basic catalog from
`refs/heads/main` rather than the revision `tooling.json` pins (diff the artifact,
don't assume).

## Implementation (2026-09-01): Direction A shipped

> **Superseded 2026-09-01 by the `Flow` component (P1).** Direction A (host
> re-points `root.children` per phase) was shipped, reviewed as heavy/coupled,
> then replaced by the general `Flow` view-selector — see
> [Implemented: Flow](#implemented-2026-09-01-flow-view-selector-p1) below. This
> section is retained as history; the phase-group / `structureForPhase` machinery
> it describes has been removed.

Direction A was chosen and implemented. Segment & Measure now authors every
component once and the **host re-points `root.children` at the phase's group** on
each transition, so structure follows the phase and the camera phase is pure.

What changed:

- **Per-phase groups** in
  [segmentAndMeasure.js](../packages/gather-catalog/src/segmentAndMeasure.js):
  `captureGroup` / `processingGroup` / `reviewGroup` / `summaryGroup` /
  `errorGroup`. `root.children` starts on `captureGroup`.
  `SEGMENT_AND_MEASURE_PHASE_GROUPS` + `segmentAndMeasureStructureForPhase` are the
  phase→structure contract.
- **The mirrored presentation state is gone** (`SEGMENT_AND_MEASURE_PRESENTATION`,
  `statusText`/`primaryLabel`/`secondaryLabel`/`canAdvance`/`canGoBack`), and so
  are the generic `gather.advance`/`gather.back` actions and their host `switch`.
- **Real upstream `Button`s** carry distinct authored actions: review →
  `gather.accept` / `gather.retake`; summary → `gather.submit` / `gather.retake`.
- **`gather.submit`** is the accepted-phase commit and the explicit
  result-delivery seam: `onAcceptedResult` fires on submit (the user gesture), not
  on entering `accepted`. It has no consumer in the field app or renderer yet, so
  it is a safe confirm today and the hook for future instance/XForms persistence.
- **The host adapter** ([capabilityActionAdapter.js](../src/a2ui/capabilityActionAdapter.js))
  gained an instrument-agnostic `structureForPhase` option; `setState` emits the
  reshape `updateComponents` only when the phase's structure actually changes.
  `acceptMask` is now `await`ed so a failure routes to the error phase.

Verified: gather-catalog + gather-components + full `test:packages` green; renderer
Vite build green; Android Hermes export green; and an end-to-end flow spike through
the real adapter + real bundle confirms `root.children` reshapes
camera→review→summary→(submit delivers)→retake→error. **Still needs a physical
device pass** (camera UX + the new submit gesture), consistent with the standing
device-gate requirement.

## Open design review (2026-09-01): naming + reduce the machinery

A review of the shipped Direction A flagged that it reads as heavy and coupled to
one instrument. Code is **unchanged** pending a decision; the concept and the
concrete cleanup are recorded here.

- **Rename `phase`.** It is non-standard jargon. The concept is a small
  **statechart** — states + transitions, each state showing a view (like a wizard
  `mode`/`step` or a route). Prefer `status` / `step` / `mode`. This applies
  whichever option below is chosen.
- **Collapse the duplicated state machine into one table (Direction A cleanup).**
  Today the capability adapter encodes the flow *and*
  `SEGMENT_AND_MEASURE_PHASE_GROUPS` separately encodes state→view — two
  representations that must agree (the same duplication smell the old presentation
  mirror had). Unify into a single `{ states: { <state>: { view, … } } }`
  declaration, and drive both the data-model write and the `updateComponents`
  reshape from **one generic, reusable host statechart driver**. Then each
  instrument is *data* (a table), not bespoke `structureForPhase`/adapter logic.
  This removes the "coupled to one tool / wrapper logic" smell without changing
  behavior. Note: nothing new is exposed to A2UI — it still only ever receives
  `updateComponents{ root.children }`; the statechart lives host-side and offline,
  where the flow already lived.
- **Alternative shape — Option X (data-only, no `updateComponents`).** Keep one
  tree; each element self-hides on `status`. Simpler single-source-of-truth model
  that matches the "the data model *is* the state" intuition. **Cost:** every
  visible element must be a self-hiding Gather component, so stock Basic Catalog
  `Button`s cannot be used in the flow (they would be wrapped) — abandoning the M9
  "use Basic Catalog `Button`" goal and reintroducing hand-rolled conditional
  rendering. This is the honest simpler-but-different fork; choose A-cleanup vs X
  by taste, not by protocol necessity.

## Multi-view workflow pattern — proposal (2026-09-01)

Design review reframed the whole question: what is the *general* pattern for
instruments with ordered/conditional multi-view micro-flows (camera → review →
summary), authorable in the hosted Composer and legible to its agent? This
supersedes the ad-hoc Direction-A machinery as the recommended end state.

**First, split "multi-step" across two layers:**

- **Form-level steps** — distinct questions with durable answers / branching
  relevance. This is XForms/ODK's native job (`relevant`, `calculate`, next-field
  nav, inter-field data flow). Model these as **separate fields**; A2UI needs
  nothing. Best for coarse, durable, branching stages.
- **In-instrument micro-flow** — ephemeral UI states producing **one** field's
  value (accept/retake a mask, live camera → immediate review). Not questions;
  transient UI. This is the part A2UI can't express and the part worth a primitive.

Decision rule for authors/agent: **durable answer or branches the form → XForms
field; transient UI producing one value → in-instrument view.**

**The missing primitive.** A2UI ships `Tabs` (one of N children by user click) and
`Modal` (content on a trigger) — client-side conditional containers. It lacks their
**data-driven sibling**: a container that shows one of N named child views selected
by a value in the data model. That single gap is what the phase-group / host-reshape
machinery works around.

**Proposals (full write-up in session history):**

- **P1 (recommended) — a data-driven view-selector component.** One new general
  Gather component, e.g. `Flow { current: DynamicString, steps: [{ when, view:
  ComponentId }], fallback? }`, rendering only the child whose `when` matches
  `current`. Transitions are ordinary actions (a button dispatches `gather.accept`;
  the host sets `/status`; the selector reflects it). The **host stays value-only**
  and the Direction-A apparatus (`SEGMENT_AND_MEASURE_PHASE_GROUPS`,
  `structureForPhase`, host reshaping) is **deleted** — net less code, stock
  `Button`s throughout, no mobile/web drift (Gather owns the one renderer),
  inactive views not mounted. It is a normal catalog component with a JSON Schema,
  a sibling of `Tabs`, so the Composer agent authors it directly. Distinct from the
  rejected `PhaseView`: one component owning a discriminated select (a `switch`),
  not scattered per-instance boolean gates (`if`s), and a new component rather than
  a redefinition of a stock one.
- **P2 — host statechart runtime that pushes views via `updateComponents`.** The
  cleaned-up Direction A (one generic driver + a per-instrument state table).
  Reserve for cases needing genuine structure injection; more machinery and less
  Composer-legible than P1 (flow lives outside the component tree).
- **P3 — decompose into XForms fields.** Native, no new concept; the right answer
  for the *form-level* kind, poor for tight ephemeral loops.
- **P4 — capability/function.** Rejected: conflates UI sequencing with the
  native/scientific capability boundary.

**Recommendation:** P1 for in-instrument micro-flows + P3 for form-level steps,
with the decision rule above advertised to the agent. Retire the Direction-A
machinery when P1 lands. **Open for the human:** pick P1 vs P2 vs P3 as primary,
and choose names — component (`Flow` / `Steps` / `Switch`) and the data field
(`status` / `step` / `mode`, replacing `phase`). No code written pending that pick.

## Implemented (2026-09-01): `Flow` view selector (P1)

Decision: **P1**, named **`Flow`** with **`views`** (renamed from `steps` —
see the ADR below), and the data field renamed `phase` → **`status`**.
Segment & Measure is now a `Flow` composition and the Direction-A machinery is
removed.

- **New general component `Flow`** (Gather catalog): `Flow { current:
  DynamicString, views: [{ when, view: ComponentId }], fallback? }` renders the one
  child View whose `when` matches `current`. Authored once in the catalog
  ([gather-v0.1.source.json](../packages/gather-catalog/catalogs/gather-v0.1.source.json)
  + assembled [gather-v0.1.json](../packages/gather-catalog/catalogs/gather-v0.1.json)),
  implemented on mobile in
  [segmentAndMeasureComponents.js](../src/a2ui/mobile/segmentAndMeasureComponents.js)
  and on web in
  [gatherComponents.jsx](../apps/renderer/src/gatherComponents.jsx) — Gather owns
  the single renderer, so no mobile/web drift; inactive views are not mounted.
- **The instrument** ([segmentAndMeasure.js](../packages/gather-catalog/src/segmentAndMeasure.js))
  authors `captureView` / `processingView` / `reviewView` / `summaryView` /
  `errorView` once; `root` mounts only `flow`, whose `current` binds
  `/gather/status`. Buttons stay stock Basic Catalog `Button`s with distinct
  `gather.accept` / `gather.retake` / `gather.submit` actions.
- **The host is value-only.** The capability adapter
  ([capabilityActionAdapter.js](../src/a2ui/capabilityActionAdapter.js)) writes
  `/gather/status` and never sends `updateComponents`. Removed:
  `SEGMENT_AND_MEASURE_PHASE_GROUPS`, `segmentAndMeasureRootChildren`,
  `segmentAndMeasureStructureForPhase`, the adapter's `structureForPhase` option,
  and the `isProcessingPhase` helper. `phase` is renamed to `status` throughout;
  `gather.submit` remains the result-delivery seam.
- **Layering rule to advertise to authors/the Composer agent:** durable answer or
  branches the form → XForms field (P3); transient UI producing one value →
  in-instrument `Flow` view (P1).

Verified: full `test:packages` green (one intentional skip — the Composer fixture,
regenerated as an honest mirror pending a real hosted-Composer session); renderer
Vite build green; Android Hermes export green; and an end-to-end spike through the
real adapter + real bundle confirms `status` drives `Flow` view selection
(capture→review→summary→submit-delivers→retake→error) while `root.children` never
changes. **Still needs a physical device pass** (camera UX + submit gesture).
**Follow-on:** advertise the action contract + `/gather` state schema so the
Composer agent can author `Flow` instruments end to end (unchanged from before).

## ADR (2026-09-01): Tool orchestration — establish the seam now, build the engine later

Two changes land together: `Flow`'s children are **Views**, not Steps, and a
minimal host-side **`ToolFlowController`** owns which View is active.

### Why `View` replaces `Step`

"Step" implies an ordered sequence with a position — step 1, then 2, then 3 —
and implies that the component knows the order. `Flow` knows neither. It matches
one externally supplied token against `views[].when` and renders that child.
Segment & Measure already breaks the sequence reading in two ways: several
working tokens (`persisting-capture`, `segmenting`, `classifying`, `measuring`)
resolve to the *same* `processingView`, and `error` is reachable from anywhere
and is not a position in any sequence.

"View" says what the child actually is — one alternative presentation — and
leaves ordering to whoever decides the active token. It also keeps the
vocabulary honest for a Composer agent reading the catalog: authoring a `Flow`
is "here are the Views; something else picks one", not "here is a wizard".

### Ownership boundary

```text
Components          render UI
Capabilities        perform operations
Flow                renders one of several Views
ToolFlowController  decides which View is active
```

- **`Flow`** ([flow.js](../packages/gather-catalog/src/flow.js)) is presentation
  only. Given an active view token it renders that View — no transitions, no
  state, no capability calls. `resolveFlowView` is shared by the mobile and web
  renderers so the two implementations cannot drift.
- **Capabilities** perform operations and return results. They do not decide
  what is shown next.
- **`ToolFlowController`** ([toolFlowController.js](../src/a2ui/toolFlowController.js))
  owns the active view token and routes Tool events to handlers. It is the only
  place a transition is decided. Its whole surface is `activeView`, `dispatch`,
  `setView`, `reset`.
- **Components** never transition the flow. A component reports an event; the
  controller decides the consequence.

The active view token lives in the surface data model at `<statePath>/status`,
because a `Flow`-bound value has to be data. The data model is therefore the
*store* and the controller is the *decider*: the controller is seeded from the
durable token (`startView`) and writes each change back, so there is no cached
copy to drift out of sync.

The token vocabulary is shared —
`SEGMENT_AND_MEASURE_VIEWS` in
[segmentAndMeasure.js](../packages/gather-catalog/src/segmentAndMeasure.js) is
used by both the authored `Flow` table and the controller, and a test asserts
every token the controller can write has a `Flow` entry.

### Deliberately not a workflow engine

The controller is a **seam, not an engine**. It has no guards, nested states,
entry/exit actions, timers, parallel states, or declarative transition schema.
Segment & Measure's transitions are bespoke handler bodies.

The reason is that one Tool is not enough evidence to design a general
orchestration language. Building a statechart now would mean inventing a
transition schema, an authoring story for it, and Composer support for it, all
against a single example — and every one of those decisions would be a guess.
Establishing the seam costs almost nothing and means orchestration already has
one obvious home when the second and third Tools arrive with real requirements.

### Tripwire for revisiting

Revisit when **two or more Tools require nontrivial branching, retry, or
conditional transitions** driven by user actions or Capability results — for
example a Tool that retries a failed inference with different parameters, or one
that routes to different Views depending on a classification score.

At that point, replace the bespoke handler bodies with a generic declarative Tool
Flow/statechart driver. **That driver should drive the existing `Flow` component,
not replace it.** The `Flow`/`View` presentation abstraction is independent of
how the active view is chosen — that is the entire point of keeping `Flow` dumb —
so a future engine changes who calls `setView`, and nothing about how Views are
authored or rendered.

Until then: if a transition rule is getting complicated, that is a signal to
check whether it belongs in the controller at all, or whether the Tool wants a
durable form-level branch (P3 / XForms) instead of an in-instrument View.

## Phase 1 (2026-09-01): components/capabilities ownership + contracts

The Camera/Components/Capabilities architecture work is proceeding phase by phase.
**Phase 1 is inventory + contracts** — no `gather-capabilities` package and no code
moves yet (those are Phase 2+). Its deliverable is
[components-capabilities-ownership.md](./components-capabilities-ownership.md),
which records:

- the **ownership rule** (Composer-visible primitives are package-owned; `src/`
  consumes them) and a **file-by-file classification** of `src/components`,
  `src/capabilities`, `src/scientific`, and `gather-components` with Phase-2+ move
  targets;
- the **capability definition schema** (`defineCapability` — native-free
  `definitions.js` vs executable `runtime.js`, colocated with implementations);
- **serializable asset contracts**: `ImageAsset` and `MaskAsset` confirmed
  (implemented in `src/scientific/contracts.js`), `VideoAsset` specified for Phase 4;
- the **`vision.* → image.*`** namespace consolidation (ML/OpenCV distinction
  becomes metadata, not a public-id split);
- confirmation that **`Flow`/`View`/`ToolFlowController`** (above) satisfy the
  Phase 1 Flow/View contract, and that **A2UI v0.9 stays**;
- the **three-abstraction** public model (below).

`CameraView`/`VideoView`/`MediaGallery`, the internal `CameraSession` seam, the
capture **Tools**, and the Segment & Measure migration are sequenced for later phases
in that document.

### Phase 2 (2026-09-01): `gather-capabilities` package (image + measure)

The reusable M8 image/measure capabilities now live in the new
[`gather-capabilities`](../packages/gather-capabilities/) package: native-free
`defineCapability` + colocated definitions/implementations in concept-first folders
(`image/segment`, `image/classify`, `measure/`), a native-free `definitions.js`
aggregate the Composer agent can load without native deps, and a `runtime.js`
(`createCapabilityRuntime`) that binds implementations to app-injected engines. The
public `vision.*` namespace is consolidated to **`image.*`** (ML/OpenCV is `kind`
metadata, not a public-id split), and only implemented capabilities are advertised.
`GatherProvider` consumes the package; `src/capabilities/{vision,measure}` are
deleted. To keep the package decoupled, capabilities receive the app-computed
serializable `modelRef` (the `src/scientific` model subsystem still owns model
resolution/validation) — so `contracts.js`/`modelPackage.js` were **not** moved (a
future contracts-relocation step). Camera capabilities + the shared `CameraSession`
seam are Phase 3. Verified: `test:packages` green (8 packages), Android Hermes export
green, renderer build green. Detail in
[components-capabilities-ownership.md](./components-capabilities-ownership.md) §7.

### `src/scientific` audit (2026-09-01, analysis only)

Before any model/runtime ownership change, every file under `src/scientific` was
audited (responsibility, imports, consumers, serializable contracts, native deps,
coupling, likely owner, confidence, move-now). Findings in
[scientific-directory-audit.md](./scientific-directory-audit.md): the directory is an
M8 vertical slice mixing a **Models subsystem** (modelPackage/store/availability/
bundled — cohesive, native-free core + one native installer seam), **capability
execution backends** (`modelExecutor` + ONNX + OpenCV adapters), **generic media
storage** (`imageAssetService`, mislabeled as scientific), **capability-generic
provenance** (`receipt`), and the **Segment & Measure Tool** (`workflows/…`,
mislabeled as scientific). One real bug surfaced: `modelExecutor` still writes
`vision.segment`/`vision.classify` receipt ids after the `image.*` rename. A future
`gather-models` package is judged justified eventually but **not forced** by the
current graph (Option B keeps `ModelRef` app-side; nothing outside the app reuses the
model cluster). No files moved.

### Phase 3 revised (2026-09-01): Component-owned camera, no `CameraSession`

The earlier Phase 3 plan — an internal shared **`CameraSession`** registry/resolver
plus public **`camera.capturePhoto`/`camera.recordVideo`** capabilities resolving an
ambient mounted session — is **superseded and will not be built**. The benefit did
not justify the added lifecycle, coupling, native dependency, and maintenance surface.

Revised boundary: **Components own interactive acquisition** (`CameraView` →
`ImageAsset`, `VideoView` → `VideoAsset`, owning permission/preview/lifecycle/
shutter/flash/zoom/capture); **Capabilities operate on serializable data** (`image.*`,
`measure.*`). A session-backed `camera.capturePhoto` would carry a hidden runtime
dependency (mounted view + live session + permissions + registry lifecycle), unlike
clean data capabilities — and *internal implementation reuse need not use the same
abstraction as public composability*. Revised Phase 3 is a **simplification/refactor
of the proven camera design**: consolidate the reusable camera machinery into
`gather-components/camera` behind the existing `.native`/`.web` seam, add `VideoView`,
consolidate permission ownership, and preserve an internal frame-processor/overlay
extension seam (VisionCamera frame processors stay owned by `CameraView`; native
`Frame`/worklet objects never cross the A2UI contract). Tripwire: introduce a
session/service abstraction only if a real non-owner must programmatically control an
already-mounted camera. Full decision + 10-step plan in
[components-capabilities-ownership.md](./components-capabilities-ownership.md) §9.

**Landed (2026-09-01):** `gather-components/src/camera/` now owns the camera surface,
resolved per platform by the bundler (Metro → `.native.jsx`, Vite → `.web.jsx`;
VisionCamera stays out of the web bundle). Shared `CameraFrame` presentation;
`CameraView` (photo, Component-owned → plain capture) + new `VideoView` (video →
plain capture) with `.native` (VisionCamera) / `.web` (getUserMedia/`MediaRecorder`)
seams; shared `CameraDevicePreview.native` with a `frameProcessor` extension seam;
shared `RecordButton`. Consumers (Segment & Measure, XFormsImageControl, renderer
`GatherCapture`) rewired; old camera files deleted; `gather-components` gains a
`react-native-vision-camera` peer dep. `test:packages` + renderer build + Android
export all green. **Device validation pending** (physical photo/video capture, browser
preview; `VideoView.native` recording + mic permission need on-device confirmation).

**Phase 3 review (2026-09-01):** three boundary clarifications recorded in
[components-capabilities-ownership.md](./components-capabilities-ownership.md) §9
("Phase 3 review"): (1) the **public output contract** is descriptor → asset service
→ typed asset today and must converge on `CameraView → ImageAsset` / `VideoView →
VideoAsset` — the Composer/Tool boundary must never see raw platform URI shapes; (2)
`CameraFrame`/`CameraDevicePreview`/`RecordButton`/`capturePhoto` are **internal, not
Composer-visible** (only `CameraView`/`VideoView` are authoring surfaces); (3) the
`src/capabilities/camera` namespace is now **misleading** — only QR/barcode result
decoding (`scannedCodeValue`) remains, a future `code.scan`/`barcode.parse`/`qr.decode`
concern, deferred (no impulsive rename).

**Phase 4 — MediaGallery landed (2026-09-01):** added `MediaGallery` (Composer-visible,
presentation-only) over mixed **photo + video** collections in `gather-components` — a
thumbnail grid (video tiles get a play badge) with optional select/remove/reorder, plus a
built-in **viewer modal** that displays photos and plays videos. The viewer's media
surface is platform-seamed (`MediaSurface.web` = raw `<video>`/`<img>`, no dep;
`MediaSurface.native` = `expo-video`); the gallery itself is one shared cross-platform
component. Items are **duck-typed** (no asset-schema import), and the render-free
`mediaModel.js` holds the tested logic — so the deferred `ImageAsset`/`VideoAsset`
convergence needs no gallery change. New native dep `expo-video ~57.0.3` (imported only in
the `.native` seam; config plugin registered; inline native playback device-validation
pending). Design-doc items 15/16/18 were already satisfied by Phase 3; the doc's
session-era acceptance lines stay superseded. Gates green: `test:packages` (8 pkgs,
`fail 0`), renderer build (837 modules, `expo-video` not pulled), Android export (1458
modules, native seam resolves `expo-video`). Full detail in
[components-capabilities-ownership.md](./components-capabilities-ownership.md) §9
("Phase 4 — landed").


### Clarification (2026-09-01): three abstractions, and Tools replace "recipes"

The public architecture is exactly three abstractions: **Components** (reusable
UI/interaction primitives), **Capabilities** (reusable operations), and **Tools**
(reusable typed data-collection workflows composed from Components, Capabilities,
**and other Tools**). Components + Capabilities are primitives; **Tools are
recursively composable workflows**.

There is **no separate "recipe" concept**. Photo Capture, Video Capture, Multi-Image
Capture, Segmented Capture, and Segment & Measure are all **Tools** — not recipes and
not monolithic component variants. A Tool that reuses another (Segment & Measure →
Segmented Capture → Photo Capture) is resolved by **authoring/build-time inlining**
of the referenced Tool into the published artifact, preserving dependency/version
provenance. **No nested-Tool runtime** is introduced now — consistent with the
"establish the seam, defer the engine" stance on `ToolFlowController`. (The unrelated
OpenCV operation "recipes" in `v2-release-planning.md` are a different concept and
untouched.) Full detail in
[components-capabilities-ownership.md](./components-capabilities-ownership.md) §0.

## Gather's v0.9 → v1.0 work, by area

### Already v1.0-shaped (no work)

- `createSurface` passes `catalogId` and **no `theme`** — v1.0 removes `theme`
  and `primaryColor` from both catalog and surface creation. Gather supplies its
  own theme through `gather-components`, so this removal costs us nothing.
- Catalog artifact already carries `catalogId`, `$schema`, `$id`, `title`,
  `description` — all supported v1.0 `Catalog` fields.
- Component and function identifiers (`GatherCapture`, `PhaseView`,
  `ImageOverlay`, `OutputReview`, `ProcessingView`, `InstrumentError`,
  `visionSegment`, …) are ASCII alphanumeric and satisfy the new
  **Unicode UAX #31** identifier constraints.
- We use no `checks`, so the `CheckRule` return-type change below does not reach us.

### Required changes

| Change | Impact on Gather |
| --- | --- |
| `protocolVersion` required in v1.0 catalogs (defaults to `"0.9"` when omitted) | Add to `gather-v0.1.json`; currently **absent**. Also bump `a2uiProtocolVersion` in [tooling.json](../packages/gather-catalog/catalogs/tooling.json). |
| Message envelopes set `version` to `"v1.0"` | Every message in `SEGMENT_AND_MEASURE_INSTRUMENT` currently declares `version: 'v0.9'`. |
| `$defs/theme` removed from basic catalog | Injected by the upstream assembler, not authored by us — regenerating with a v1.0 `assemble_catalog.py` drops it automatically. |
| `callFunction` → `callRendererFunction`; new `callAgentFunction`, `rendererFunctionResponse`, `agentFunctionResponse` | No impact today (our capabilities are event actions, not function calls). **Correction (2026-09-02):** this row previously said the rename *blocks* the M9 renderer-local-function direction. A rename blocks nothing — that direction is blocked because **`@a2ui/web_core@0.9.1` implements no function-call mechanism at all** (`callFunction`: 0 occurrences package-wide; `FunctionDefinition` exists only in the catalog schema). Adopting a runtime that implements it is therefore a *prerequisite* for authored capability invocation, not an optional migration. See [composition-behaviour-audit.md](./composition-behaviour-audit.md). |
| `updateDataModel` requires `value`; setting a path to `null` **deletes the key** | [capabilityActionAdapter.js](../src/a2ui/capabilityActionAdapter.js) writes via `surface.dataModel.set(path, value)`. Audit for any `null` write that currently means "clear the field" but would become "remove the key". |
| Renames: client→renderer, server→agent; schema files (`server_to_client.json` → `agent_to_renderer.json`); MIME `application/json+a2ui` → `application/a2ui+json` | Mechanical, but touches the Composer `postMessage` transport in [apps/renderer/](../apps/renderer/) — including our `SEND_TO_SERVER` handshake name. |
| Validation functions (`required`, `regex`, `length`, `numeric`, `email`) return `validationResult`, not boolean | Not used today. Note before adopting `checks`: the object is `{ valid, code, message, severity }`. |
| Comparison + arithmetic functions removed from the standard library | If any future instrument needs a comparison, it must ship as a Gather catalog function. Design instruments to avoid needing one. |

### New v1.0 capabilities worth adopting

- **`requiresUserActivation`** (boolean, default `false`) on `FunctionDefinition`
  declares that a function needs a user gesture, and conditionally restricts
  `allowedCallers` to `rendererOnly`. This is exactly right for
  `cameraCapture` — mark it `true`. It gives protocol-level expression to a rule
  we currently enforce only by convention.
- **`allowedCallers`** (`rendererOnly` | `agentOnly` | `rendererOrAgent`, default
  `rendererOnly`) restricts who may invoke a function. Every Gather scientific
  capability should be `rendererOnly` — which is already the default, so the
  M8/M9 boundary is protocol-aligned by default rather than by accident.
- **`allowedParents` / `allowedChildren`** on catalog component definitions
  declare parent-child composition constraints, with new `UNALLOWED_PARENT` /
  `UNALLOWED_CHILD` error codes. Directly useful for our wrapper components:
  `PhaseView` could declare what may sit inside it, giving Composer authors a
  real validation error instead of a silently empty surface.
- **`instructions`** on a catalog embeds Markdown authoring guidance in the
  catalog itself — a good home for Segment & Measure phase-flow rules that
  currently live only in these docs, and which Composer's agent cannot read.
- **`metadata.extensions`** on `ComponentCommon` carries arbitrary extension
  key-value pairs (UAX #31 keys; `a2ui_` prefix reserved). A sanctioned
  extension point if Gather ever needs per-component metadata that is not a prop.

### Multi-catalog mixing — the coupled part of the migration

v1.0 formalizes catalog mixing, which Gather relies on (upstream Basic Catalog
`Column`/`Text`/`Button` plus the Gather catalog):

- `catalogId` may be set per component; resolution order is
  **(1)** explicit component/call `catalogId`, **(2)** surface default
  `catalogId`, **(3)** error — with **no fallback to capabilities**.
- **All mixed catalogs must use the same A2UI specification version.**

That last rule is the scheduling constraint: we cannot migrate the Gather catalog
to v1.0 while rendering against a v0.9 Basic Catalog, or vice versa. The Gather
catalog, the `@a2ui/web_core` dependency, the mobile binding, and the renderer
move together in one change. Our instrument sets a surface-default `catalogId` and
relies on that default for Gather components while Basic Catalog components
resolve by name; verify under v1.0 whether the surface default plus per-component
`catalogId` is needed for the mixed tree, since resolution failure is now an error
rather than a fallback.

## Migration preconditions

Do not start until all of these hold:

1. v1.0 is **final**, not a release candidate (upstream currently recommends
   v0.9.1 for production).
2. Hosted Composer supports v1.0 — it is the reason we are on v0.9, and
   [m9-a2ui-compatibility.md](./m9-a2ui-compatibility.md) records a verified
   live authoring flow that must keep working.
3. `@a2ui/web_core` publishes a **Hermes-safe v1.0 entry point**. The existing
   [`@a2ui+web_core+0.9.1.patch`](../patches/@a2ui+web_core+0.9.1.patch) exists
   only because the stock v0.9 root entry imports a JSON schema with import
   attributes and throws under Hermes. Re-check this on v1.0 before assuming the
   patch can simply be dropped.
4. A v1.0 `assemble_catalog.py` is available to regenerate the catalog artifact —
   we do not hand-maintain it, and must not add a Gather schema assembler.

**Assembler reproducibility hazard.** The pinned assembler fetches the basic
catalog from `refs/heads/main`, **not** the revision pinned in
[tooling.json](../packages/gather-catalog/catalogs/tooling.json), so the
assembled artifact is not actually pinned. Regenerating on 2026-09-01 reproduced
the committed artifact except for `$defs/anyComponent/oneOf` ordering — content
identical, so upstream's v0.9 basic catalog had not changed. Diff the
regenerated artifact rather than assuming reproducibility, and treat an
unexpected content change as an upstream drift signal.

## Open questions

- Does hosted Composer advertise or require a protocol version, and will a
  v0.9 renderer keep working against it once Composer moves to v1.0?
- Does the v1.0 React renderer (`@a2ui/react`) ship at the same time as
  `web_core`? `apps/renderer/` depends on both.
- Is upstream aware of the conditional-rendering gap, and is anything proposed
  for a post-1.0 version? Nothing appears in the evolution guide, which has no
  roadmap or future-work section. If a native visibility property ever lands,
  revisit whether `PhaseView` should collapse onto it.
- Why were comparison and arithmetic functions dropped between v0.9.1 and v1.0 —
  deliberate scope reduction, or documentation gaps in the release candidate?
  Worth confirming before designing any instrument around their absence.

## Related documents

- [M9 A2UI compatibility](./m9-a2ui-compatibility.md)
- [M9 instrument contract](./m9-instrument-contract.md)
- [M8 substrate audit](./m8-substrate-audit.md) — records the A2UI Protocol v1.0
  Candidate revision `d9086fb73fb5ab535780b6af47a7440096d5785f` studied for M8
