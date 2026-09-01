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

Conclusion: a custom catalog component remains the correct way to express
data-driven visibility, in v0.9 *and* in v1.0. `PhaseView` is not a workaround
for a v0.9 gap that v1.0 closes — it is filling a permanent hole in the Basic
Catalog. That materially lowers the risk of the extension becoming a fork.

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
own comparison function to stay useful. `when: [...]` needs no comparison
function at all — the membership test lives in the component. **The current
`phase` + `when` shape is the more portable design; keep it.**

The separate naming criticism still stands and is unaffected: the mechanism is a
general-purpose conditional, but `PhaseView` / `phase` is Segment & Measure
vocabulary. A generic name with generic prop names (`match` + `when` + `child`)
would keep the portable semantics while dropping the domain leak. That is a
rename, not a redesign, and is cheapest while exactly one instrument uses it.

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
