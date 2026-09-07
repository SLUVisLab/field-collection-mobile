# Milestone roadmap

**Canonical roadmap for the ODK/XForms-based Gather.** Supersedes
[v2-release-planning.md](./v2-release-planning.md), which predates that pivot.

Content preserved from
`archive/experiments/m4.7-entities-delivery-concurrency/post-m47-milestones-roadmap.md`
(promoted here 2026-09-02 — a live roadmap should not live in `archive/`).
Status columns added.

## Completed

**M0–M4.7 — ODK substrate** ✅

## Milestones

| # | Milestone | Scope | Status |
| --- | --- | --- | --- |
| 1 | **M5 — Gather application shell** | Central connection · project/form browser · native form experience · drafts/finalize/submit | ✅ [final report](./m5-final-runtime-report.md), 2026-08-28 |
| 2 | **M6 — Offline runtime** | persistent project cache · submissions/media · Entity overlay · sync manager · multi-day offline gate | ✅ GREEN, [status](./m6-offline-runtime-status.md) |
| 3 | **M7 — Survey / assignment workflow** | My Work · target Entity sets · progress/navigation · batch upload UX | ✅ [final summary](./m7-final-summary.md) |
| 4 | **M8 — Computational capability** | one real native scientific operation · writes into ordinary XForms values | ✅ GREEN, [report](./m8-scientific-capability-report.md) |
| 5 | **M9 — Declarative instruments / A2UI** | component catalog · capability catalog · instrument packaging/runtime | 🟡 **in progress — where we are** |
| 6 | **M10 — Full scientific fieldwork demo** | — | ⚪ not started |

## M9 in detail

A terminology note first: M9 says *"instruments"*, but the architecture
reconciliation ([components-capabilities-ownership.md §11](./components-capabilities-ownership.md))
established that "Tool"/"Instrument" is **not a runtime species**. What M9's
third bullet actually means in current language is **authored compositions** —
A2UI composition data hosted by a Gather field.

| M9 bullet | State |
| --- | --- |
| **component catalog** | ✅ `gather-components` + `gather-catalog` + the mobile Basic Catalog. `CameraView`, `VideoView`, `MediaGallery`, `MultiImageCapture`, `Flow`. `VideoAsset` specified, video capture outstanding. |
| **capability catalog** | ✅ `gather-capabilities` — `image.segment`, `image.classify`, `measure.*`, semantic and source-independent. |
| **packaging / runtime** | 🟡 The runtime is built and device-verified: recognition, binding manifest, subtree ownership, Accept path, commit, provenance, asset lifecycle, the composition control. **Packaging is half-achievable** — structure travels with the form, behaviour is registered app code ([b-custom §6](./b-custom-composition-conventions.md)). |

### What actually gates the rest of M9

**Corrected 2026-09-02.** An earlier audit claimed v0.9.1 implements no
function-call mechanism. It does — see
[a2ui-functioncall-gap.md](./a2ui-functioncall-gap.md). The catalog function
registry, argument validation, loud failure and async execution are all
upstream; Gather simply never registered any functions.

What remains is narrow: register capabilities as catalog functions, defer
`action.functionCall` to interaction time (it currently evaluates eagerly at
prop resolution), and settle how a function result reaches composition state.
None of the first two need an upstream change, so authored capability invocation
is **much closer than previously recorded** — the open question is result
consumption, not runtime capability.

Everything else in M9's third bullet is done and verified on device. See
[§26](./components-capabilities-ownership.md) for the working backlog.
