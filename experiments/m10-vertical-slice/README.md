# M10 vertical slice

One uninterrupted execution across every boundary:

```text
Central → form resource → .gather Tool → A2UI FunctionCall → capability runtime
→ ModelRef resolution → native inference → measurement → XForms/media projection
→ provenance → submission → Central
```

Every one of those was already proven; no two adjacent ones were proven together
at the model-backed end ([docs/m10-acceptance-audit.md](../../docs/m10-acceptance-audit.md)).

## The distribution representation

`.gather` is, today, **the canonical `.a2ui.json` bytes under a `.gather`
filename**. There is no packaging step — a `.gather` container is M11 Phase 5 —
so this gate must not invent one, or it would prove a path the product does not
have. `provision.mjs` uploads the artifact from `compositions/` verbatim and
checks the round trip is byte-identical.

## Files

| | |
| --- | --- |
| `m10-gate-form.xml` | the form: a `gather-composition` group with ordinary typed children |
| `check-binding.mjs` | runs the real `compositionBinding` over a node model transcribed from that form |
| `provision.mjs` | publishes form + Tool to live Central, creates the device App User |
| `readback.mjs` | reads the submission back and checks what landed |

## Running it

```bash
set -a; . ./central-live.env; set +a

node experiments/m10-vertical-slice/check-binding.mjs     # no Central needed
node experiments/m10-vertical-slice/provision.mjs         # publishes, prints the token
# write gates/fixtures/centralLive.js from that output, point index.js at
# gates/CentralSyncGateApp.js, run on the device, fill the form, submit
node experiments/m10-vertical-slice/readback.mjs
```

The Central project is **Gather V3 Acceptance** (id 2) — real deployed Central,
real auth, real form-resource behaviour, and no contamination of project 1,
which holds actual Silphium study forms. Artifacts stay there for regression and
debugging; this is a test project, not a throwaway one.

## What `readback.mjs` is actually checking

The last assertion is the one that matters. `model_revision` is projected from
`/working/segmentation/model/revision` — the **capability's output** — while the
Tool's requested model sits at `/working/modelRef` as an **input**. Comparing
them tells apart "the model the author named" from "the model that executed", so
a resolution bug cannot pass by echoing the form's own intent back.

## Status — GREEN, 2026-09-05

One uninterrupted execution on a Pixel 10, no dev seeding and no registered
handler anywhere in the path:

```text
Central → device        sha256-19364c6049cacfbf…  byte-identical, ordinary form-resource path
Tool renders            "Segment and measure", from an artifact the binary has never seen
gather_persistAsset     project_assets ← image-1788595398566-….jpg
image_segment           ModelRef → models/dcbe0ccd840f…/model.onnx installed by revision
   native inference     u2netp, NNAPI 332/365 nodes, 3000x4000 → 320x320, ~5.1s
   foregroundRatio      0.242607421875
measure_area            2911897 px²  — 24.3% of 12,000,000, matching the ratio exactly
gather_completeComposition
   XML                  <image>…</image><area>2911897.0</area><area_unit>px2</area_unit>
                        <model_id>u2netp-salient-segmentation</model_id>
                        <model_revision>sha256:dcbe0ccd…</model_revision>
   instance_media       /data/specimen/image → image-mto3lf9cilwzom.jpg
   instance_receipts    5 rows, one per projected field
send                    → Central
readback                every field present, attachment exists, gather_resources absent
   authored (input)     u2netp-salient-segmentation sha256:dcbe0ccd…
   executed (output)    u2netp-salient-segmentation sha256:dcbe0ccd…
```

Submission `uuid:d1fc2aee-b0e0-411b-8050-a9c9b88c4c2d`, form version
`m10-19364c`, project 2.

## Two defects the run found

### `measure.area` produces nothing for an empty mask

The first attempt segmented a featureless surface: `foregroundRatio: 0`. The
mask was written and durable, so `requireMask` passed, but `measure_area`
returned no result at all — 45 seconds, no value, no visible error. That left
`/working/area/value` undefined, and `gather_completeComposition` correctly
refused to commit with a required output absent, so **every** field stayed
empty.

The refusal is right. The silence is not: an author sees a Tool that does
nothing when they press a button, with no indication that the segmentation
found nothing to measure. An empty mask is an ordinary field outcome — a
specimen out of frame, a bad angle — and should produce either an area of zero
or a legible failure.

Not investigated further because it did not block the run once a real specimen
was in frame. It is the first thing to characterise before this Tool goes near
a researcher.

### The mask is written at source resolution

48,081,053 bytes, for a model that works at 320×320. The mask is stored at the
source image's 3000×4000, which is why `measure_area` is measuring 12M pixels
rather than 102K. Correctness is unaffected — the area agrees with the model's
own foreground ratio to four significant figures — but 48MB per segmentation is
not a field-viable size, and it is the likely reason the empty-mask case took
long enough to look like a hang.
