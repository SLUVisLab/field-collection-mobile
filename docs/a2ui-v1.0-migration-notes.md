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

Segment & Measure renders **one component tree**; phases vary bound values, never
structure. `PhaseView` is removed.

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
| `callFunction` → `callRendererFunction`; new `callAgentFunction`, `rendererFunctionResponse`, `agentFunctionResponse` | No impact today (our capabilities are event actions, not function calls). **Blocks the M9 direction** in [m9-instrument-contract.md](./m9-instrument-contract.md), which maps capabilities to renderer-local functions. |
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
