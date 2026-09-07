# M10 acceptance audit

**Question asked:** is M10 demonstrably GREEN by its current criteria, and if
not, what concretely is missing?

**Answer at the time of writing: no — and the first finding was that M10 had no
criteria to audit against.**

> **Resolved 2026-09-05. The chain in §2 was run end to end on a Pixel 10 and
> verified from Central.** Submission
> `uuid:d1fc2aee-b0e0-411b-8050-a9c9b88c4c2d` carries the image, an area of
> 2,911,897 px², and the revision of the model that actually executed. See
> [experiments/m10-vertical-slice/README.md](../experiments/m10-vertical-slice/README.md).
> The chain below is now the M10 GREEN definition, and §5's five steps are done.

## 1. There are two roadmaps, and only one of them is real

[milestone-roadmap.md](./planning/milestone-roadmap.md) lists M10 as
"Full scientific fieldwork demo" with the scope column set to a literal `—` and
no linked document. Meanwhile
[v3-vertical-slice-roadmap.md](./planning/v3-vertical-slice-roadmap.md) contains
a fully specified plan with its own Milestones 1–4, each with a user outcome,
architectural decisions and a gate — and it plainly describes the same work.

The vertical-slice roadmap replaced the M5–M11 numbering for this stretch
without either document saying so, which is why "M10's GREEN criteria" do not
exist. **The fix is editorial, not architectural:** M10 *is* the vertical slice,
and its criteria are the end-to-end chain below.

## 2. The chain, and what is actually proven

Each link, with the evidence rather than an impression of it.

| # | Link | State | Evidence |
| --- | --- | --- | --- |
| 1 | Central form carries a `.gather` attachment | ✅ | [composition-binding-reassessment.md](./reference/architecture/composition-binding-reassessment.md); `experiments/opaque-resource-declaration/` |
| 2 | Gather sync downloads it | ✅ | `gates/CentralSyncGateApp.js`, live Central |
| 3 | A Tool unknown to the binary loads and renders | ✅ | device proof 2026-09-02 |
| 4 | `image.segment` invoked from an authored Tool | ⚠️ | proven **dev-seeded**, not Central-delivered (m9 §Physical-device parity) |
| 5 | Real `ModelRef` → real native model | ✅ | [m8-scientific-capability-report.md](./archive/milestones/m8-scientific-capability-report.md), Pixel 10 |
| 6 | Result accepted | ✅ | device proof 2026-09-02 |
| 7 | Ordinary XForms fields + media | ✅ | device proof — but for a **photo** Tool with no model |
| 8 | Provenance records the actual model revision | ⚠️ | `createExecutionReceipt` carries `model`; never observed end to end in a submission |
| 9 | Submission → Central | ⚠️ | proven for ordinary forms; never for composition + model output |

**All nine now hold in one execution** — see the banner above. The table is kept
as written because the shape of the gap is the reason the run was worth doing:
every link was proven, no two adjacent ones were.

**Everything is proven. No two adjacent things are proven together at the
model-backed end of the chain.** That is precisely the hidden-seam risk this
audit exists to find, and it is why "we have proven most of the pieces" is not
the same claim as M10 GREEN.

## 3. The concrete gaps

### Gap A — the model-backed Tool has never arrived from Central

Links 1–3 were proven with `flower_v1.gather`, a **capture-only** composition.
Links 4–5 were proven with a **dev-seeded** Segment & Measure instrument. Nobody
has run a Central-delivered Tool that invokes a model.

### Gap B — the tail has never been run for composition output

No submission carrying composition-produced XForms values, media, and a receipt
naming a real model revision has reached Central. Links 8 and 9 are inferred
from their parts.

### Gap C — the artifact required to close A and B does not exist

`compositions/` holds exactly two artifacts:

```text
compositions/photo/authored-photo/authored_photo_v1.a2ui.json   capture only
compositions/tally/quadrat/quadrat_tally_v1.a2ui.json           registered handler
```

Neither is model-backed. Segment & Measure exists as
`SEGMENT_AND_MEASURE_INSTRUMENT` in `gather-catalog` and routes through
registered app code, so it is not a form-delivered artifact either.

**This is the actual blocker, and it is content rather than architecture.** The
runtime side is already wired: `GatherProvider` builds `capabilityFunctions`
with a `resolveModel`, `FormRunner` passes them down, and
`XFormsCompositionControl` hands them to the composition — so a handler-free
authored composition can call `image.segment` through
`action.functionCall` today. What is missing is a composition that does, and a
form that carries it.

## 4. What is *not* missing

Named so that closing the gaps does not become an excuse to reopen them:

- `gather-models` — `ModelRef`, `ModelPackage`, revisions, store, availability;
- `gather-capabilities` — semantic definitions and `acceptedModelProfiles`;
- the model resolver seam — one injected `resolveModel`, already threaded;
- composition binding — namespaced `body::`/`bind::` attributes, name binding;
- the media/provenance lifecycle — working assets, promotion, receipts;
- Central packaging — `gather_resources`, the itext discovery shim.

None of these need design work to close Gap A, B or C.

## 5. Closing it

In order, and no larger than this:

1. **Author a model-backed composition artifact** — Segment & Measure as a
   handler-free authored composition calling `image.segment` through
   `action.functionCall`, with outputs bound to ordinary XForms children.
   Lives in `compositions/`, like the other two.
2. **A gate form that carries it**, following the existing
   `central-gate-form.xml` pattern: a `gather-composition` group with
   `gather:composition` naming the artifact, and typed children for the mask,
   the measurement and the image.
3. **Publish to live Central** with the artifact attached.
4. **Run it on the Pixel**: sync, fill, capture, segment with the real model,
   accept, submit.
5. **Read back from Central**: the submission XML, the media, and a receipt
   naming the model revision that actually executed.

Step 5 is the one that matters. Everything before it has been done in pieces;
only step 5 proves the pieces compose.

## 6. Recommendation on the roadmap itself

Give M10 the criteria it never had — the chain in §2 — and link
`v3-vertical-slice-roadmap.md` from its row, or fold that document into an M10
plan. A milestone whose scope column is `—` cannot be audited, and this one had
to be reconstructed from three other documents before the real question could
be asked.
