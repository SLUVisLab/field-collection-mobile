# B-custom: conventions for authored composition fields

**Date:** 2026-09-02
**Status:** decisions settled; §1 and §5 syntax verified against
`@getodk/xforms-engine@1.0.3-gather.1`
**Scope:** what an **authored composition** needs to act as a Gather-enhanced
field. B-standard covered *standard* fields (`MultiImageCapture`); this covers
arbitrary compositions that compute values.

Prerequisites already landed: the collection binding (A), the
computed-value → `setValue` seam (§17), and B-standard's recognition and
canonical-form conventions.

## The contract, in five principles

1. **A reusable composition owns its typed result contract; the form owns how
   those results bind into XForms.**
2. **Other ODK clients degrade to the conventional backing fields** rather than
   understanding the composition.
3. **There is no canonical JSON result envelope** until a real requirement earns
   one.
4. **Persistence of binary outputs is explicit authoring policy, never inferred
   from their type.**
5. **Gather-computed projections are output-only in Gather, but remain ordinary
   writable XForms values** for cross-client fallback.

## 1. Declaration — recognition token plus a form-owned binding table

> **Superseded 2026-09-02.** There is no binding manifest. The composition group
> already carries the whole contract — outputs bind to its direct body-backed
> children by name, and the control type supplies the projection — following
> ODK Collect's own external-app group behaviour. The remaining Gather metadata
> rides namespaced `body::` / `bind::` attributes. See
> [the reassessment](./composition-binding-reassessment.md) and §1a below. This
> section is kept for the reasoning that survived the change: the composition
> artifact must not contain XPaths, and the writer takes `{ reference, path }`
> pairs the host supplies.

An appearance token recognizes the field; a **form binding manifest**, shipped
as a form attachment, maps outputs to XPaths.

```xml
<group ref="/data/flower_analysis" appearance="gather-composition:flower_v1">
```

```text
composition artifact          form binding manifest
  output: petalCount    →       petalCount → /data/flower_analysis/petal_count
  output: color         →       color      → /data/flower_analysis/color
```

**The composition artifact must not contain XPaths.** The same composition has
to be reusable across forms, so paths are the *form's* concern. Sibling-name
conventions may be generated as authoring sugar, but the runtime contract must
never depend on guessing paths.

This is the same split §17 already implements: `createResultFieldWriter({ form,
bindings })` takes `{ reference, path }` pairs, so the binding table is data the
host supplies rather than anything the composition knows.

### Landed 2026-09-02

[`src/xforms/compositionField.js`](../src/xforms/compositionField.js) —
render-free, mirroring `collectionField.js`.

```json
{
  "version": 1,
  "fields": [
    {
      "reference": "/data/flower_analysis",
      "composition": "flower_v1",
      "bindings": [
        { "path": "petalCount", "reference": "/data/flower_analysis/petal_count", "required": true },
        { "path": "color.name", "reference": "/data/flower_analysis/color" }
      ]
    }
  ]
}
```

Shipped as the form attachment `gather-bindings.json`. `path` is a dot path
**into the typed result**; `reference` is the XForms node. Those are exactly the
`{ reference, path }` pairs `createResultFieldWriter` (§17) already consumes, so
there is no translation layer — `writerBindingsFor(field)` hands them straight
over.

Keyed by the **group's reference**, not by composition id, so one form may host
the same composition twice.

| Function | Role |
| --- | --- |
| `compositionConfigFrom(appearances)` | recognition → `{ enabled, compositionId }` |
| `parseBindingManifest(source)` | parse + validate; **throws** on anything mis-authored |
| `bindingManifestFrom(attachments)` | finds it among a form version's attachments |
| `resolveCompositionFields({ renderModel, manifest })` | matches form against manifest → `{ fields, problems }` |

**Validation refuses rather than guesses**, because three earlier defects in
this area all took the shape of a silent empty result:

- a binding must name both a `path` and a `reference`
- **a composition may only write inside its own group.** Writing outside would
  land in fields Gather does not hide (§5), so values would appear with nothing
  explaining where they came from. Checked on a path boundary, so
  `/data/flower_notes` is not inside `/data/flower`.
- two outputs may not bind one field (the last would silently win); one output
  feeding two fields is fine
- a group may not be configured twice
- an unsupported `version` is refused outright
- a present-but-empty manifest is an error, not an absent one

`resolveCompositionFields` returns **`problems`** alongside fields so every
mismatch is loud: a group declaring a composition with no manifest entry, an id
that disagrees with the manifest, an appearance on a non-group, and a manifest
entry no group declares (dead configuration, usually a renamed group).

Two couplings are asserted by test rather than assumed: the engine keeps the
colon token verbatim (the spike below), and `application/json` classifies as a
*text* resource in `formCatalogService` — if it did not, the manifest would
arrive base64-encoded and discovery would silently never find it.

**No production consumer yet**, as with §17 and the receipt store. The consumer
is the renderer dispatch, which needs the group subtree-ownership predicate
below.

### Verified (experiments/composition-appearance/)

| Question | Answer |
| --- | --- |
| Does `gather-composition:flower_v1` survive? | **Yes, verbatim as one token** — the engine does not split on `:` |
| Does a plain `<group>` expose appearances? | Yes, on its own `group` node |
| Do children inherit the token? | No — `[]` |

So recognition needs no engine change and no escaping. The group-collapse
recorded in b-standard §1 was specific to a `<group>` wrapping a `<repeat>` of
the same nodeset; an ordinary group is its own node.

## 1a. The group is the binding contract — landed 2026-09-02

```xml
<group ref="/data/flower_analysis" appearance="gather-composition"
       gather:composition="flower_v1.gather">
  <input  ref="/data/flower_analysis/petal_count"/>
  <upload ref="/data/flower_analysis/image" mediatype="image/*"/>
</group>
```

```text
composition result.outputs
        ↕  name match (or bind::gather:output), type projectable
direct BODY-BACKED children of the composition group
```

[`src/xforms/compositions/compositionBinding.js`](../src/xforms/compositions/compositionBinding.js)
replaces `manifest.js`. Everything the manifest restated now comes from the
XForm: the destination is the child's own reference, the output name is the
child's name, `<upload>` means a media projection, and requiredness is the
engine's live evaluation of the bind.

Four decisions in it are load-bearing:

- **Two phases.** `resolveCompositionFields` finds the groups and their
  *candidate* children; `bindCompositionOutputs` matches the composition's
  declared outputs against them once the definition has loaded.
- **Bindings come from declared outputs, never from children.** Deriving them
  from children would bind a question the composition does not produce, and
  then *clear* it on every Accept — destroying what another ODK client typed.
- **Only body-backed children bind.** XForms permits a bound model node with no
  presentation control and the engine surfaces one, so the filter is explicit;
  without it, §2's degradation guarantee would be a convention rather than a
  property. Verified against the real engine in
  [experiments/namespaced-gather-attributes](../experiments/namespaced-gather-attributes/).
- **Requiredness is an OR of two contracts**, not a duplicated fact: the
  composition's `required` says whether it can legitimately complete without the
  output; the node's says whether *this form* requires it right now, and that is
  an evaluated XPath expression. Type divides the same way — producer versus
  destination — and is checked for projectability, not equality.

### The compatibility contract

| # | rule | why it is that way |
| --- | --- | --- |
| 1 | **Extra XForm children are allowed and untouched.** | Another ODK client fills them by hand; §2's whole point. Bindings therefore come from declared outputs, never from children — the other way round would *clear* them on every Accept. |
| 2 | **An output with no compatible destination is a load-time problem**, unless the composition declares it `projected: false`. | A composition may legitimately produce an intermediate, or something kept only for local review. Making that opt-in keeps every *accidental* unbound output loud. |
| 3 | **`bind::gather:output` overrides the name match, and only ever targets a body-backed child.** | On a model-only node it would read as configuration that should work and silently do nothing, so it is reported instead. |
| 4 | **Effective requiredness is `compositionRequired \|\| liveXFormsRequired`.** | Two contracts, not one fact: the producer's "can I complete without this?" and the form's "do I require it right now?", the second an evaluated XPath expression. |
| 5 | **Projection comes from the destination control, never from producer type.** | `<upload>` decides. An `object` reaching a scalar control is a mismatch, not a stringification nobody would notice until they read the submission. |
| 6 | **`retention` defaults to `discard` only where the destination is a real media projection.** | Only there has the XForm named a durable owner. Elsewhere the choice decides whether bytes survive at all, so it is refused rather than guessed. |

Rules 2, 3 and 5 all exist because the failure they prevent is *silent*. That is
the through-line of every defect this area has produced.

### Errors now name authoring problems, not implementation artifacts

The manifest could only ever report its own absence:

```text
Composition "flower_v1" has no entry in this form's binding manifest.
```

What the group reports instead is something an author — or the Composer agent —
can act on:

```text
The composition produces "image" but /data/flower has no question named "image".
The composition declares "count" as string, which cannot be written to
  /data/flower/count (input/int).
flower_v1.gather is declared for /data/flower but is not among this form
  version's resources.
/data/flower/hidden carries Gather binding metadata but has no presentation
  control, so it can never receive a composition output.
```

The namespaced attributes reach the app through the render model:
`buildRenderModel` in the WebView sidecar reads them off the live definition
(`definition.bodyElement.element`, `definition.bind.bindElement`) and emits
plain strings, because the definition object graph cannot cross the RPC seam.
`RenderNode` gains `bodyBacked` and `gather` for this.

**Central attachment discovery is a separate problem** and is not solved here.
The form declares the opaque bundle through an inline secondary instance, which
is static model data the engine never resolves and which never reaches a
submission — see
[experiments/opaque-resource-declaration](../experiments/opaque-resource-declaration/).
That declaration is unverified against a real Central draft.

## 2. Cross-client degradation — the backing fields are real

```text
Collect → ordinary writable fields (manual entry)
Gather  → composition → the same fields
```

Other clients see the ordinary backing group and can fill it by hand. This does
not reproduce the Gather interaction, but **the form stays collectable and the
resulting data stays conventional**. Outputs with no meaningful standard
fallback simply remain unfilled.

## 3. No canonical `_result`

Only the **declared XForms projections** are committed — `petal_count`,
`color`, an image slot, and so on. No JSON envelope.

> **Revision of earlier thinking:** projections are canonical *because there is
> no second representation*, not merely by preference.

A `_result` envelope is added only if a concrete audit or replay requirement
earns it. Nothing should duplicate every result speculatively.

This keeps §17's guard intact: `toXFormsValue` refuses objects and arrays, which
is the structural reason an `ImageAsset` cannot be stringified into a text field.

## 4. Retention × projection — explicit per output

Disposition is authored per output. **Nothing is uploaded because of its type.**

| Projection | Retention | Meaning |
| --- | --- | --- |
| `media` | `keep` | Normal submitted attachment |
| `none` | `keep` | Local-only asset, subject to project cleanup policy |
| `none` | `discard` | Delete after accepted result, once no longer needed |
| `media` | `discard` | Kept through the attachment/submission handoff; purged only under the normal media lifecycle |

**`discard` + `media` must not mean "delete immediately after compute."** The
bytes have to survive until submission has taken them.

**A discarded file can still carry a receipt hash.** The tradeoff is only that
later byte-level re-verification becomes impossible. Record that fact rather
than preventing discard.

### Prerequisite: project-level cleanup

§15 already called this a prerequisite rather than a follow-up: scientific
captures land in project media with no cleanup path outside project removal, so
a high-volume derived-value workflow grows local storage unboundedly.
**Lifecycle-based cleanup comes first**; TTLs should not be invented before the
lifecycle rules are exhausted.

## 5. Output-only in Gather, writable everywhere else

The obvious move — emit `readonly` binds so a computed measurement cannot be
hand-edited — **directly contradicts §2**:

```text
readonly bind  → Collect cannot fill the fallback
writable bind  → Collect degrades gracefully
```

So no `readonly` is emitted. Instead:

- **Gather** hides/replaces the backing fields and offers no manual editing.
- **Other clients** see ordinary writable fields.
- **An absent composition receipt distinguishes manual fallback from
  Gather-computed data** — provenance, not the bind, is what tells them apart.

A stricter authoring mode for workflows that genuinely require immutable
computed outputs can come later. It is not the default.

### Hiding the backing fields — landed 2026-09-02

`controlKindFor` returns `'composition'` for a group carrying the appearance,
and subtree ownership is generalized: `ownedPrefixFor` gives a collection field
`` `${reference}[` `` (the `[` of a repeat instance) and a composition group
`` `${reference}/` ``, because a composition group's children have no index.
Both end at a path boundary, so `/data/photos_notes` and `/data/flower_notes`
are untouched by a `/data/photos` or `/data/flower` owner.

Generalizing removed a special case rather than adding one. The old code kept
an owning node by testing its kind; in fact **an owning node never matches its
own prefix** — `/data/photos` does not start with `/data/photos[`, nor
`/data/flower` with `/data/flower/` — so the test was unnecessary, and dropping
it makes a *nested* owning control correctly suppressed by the outer one. A
collection field inside a composition group no longer renders loose.

Recognition is additive, as in B-standard: a group with no token, or with only
`field-list`, is still an ordinary group, and a bare `gather-composition:`
naming nothing leaves it ordinary too.

**Interim rendering.** The composition runtime is not wired, so the renderer
shows an explicit placeholder naming the composition and saying its fields are
hidden here and that another ODK client can fill them. Falling through to the
default would have printed "Unsupported XForms control: group" — wrong, and
quiet about the consequence, since the suppressed subtree leaves nothing else on
screen to explain the gap.

## 6. Publishing and version pinning

```text
form version
├── XForm
├── form binding manifest
├── composition attachment
├── model / resources
└── fingerprints
```

Everything travels as ordinary form resources and is pinned by the immutable
form version. Drafts already pin `formVersionId` exactly, so a resumed draft
gets the same composition it was started with. **No separate registry.**

This also rides the existing download path unchanged: `loadVersion` already
reads text resources from the manifest
([`src/forms/formCatalogService.js`](../src/forms/formCatalogService.js)), which
is what a JSON binding manifest is.

## 4a. Media projection — completion owns it (2026-09-02)

`gather_persistAsset` makes a capture **durable local Gather data**: project
media plus an asset ledger row. It deliberately does **not** create an ODK
attachment, because those are two separate concepts:

```text
persistAsset          → make this capture durable locally
XForms media projection → include these bytes in this submission
```

Promotion is `gather_completeComposition`'s job, driven by the binding contract:

```text
/working/image  (ImageAsset)
      ↓ gather_completeComposition(outputs)
      ↓ manifest says this output is  projection: media
      ↓ attach to instance_media via the existing attachment machinery
      ↓ submission filename  IMG_1234.jpg
      ↓ XForms image node = IMG_1234.jpg
      ↓ commit
```

**There is no `gather_attachAsset`.** An authored composition never learns about
`instance_media`. It declares what an output *means*; completion owns how that
becomes a valid ODK instance.

| retention | projection | outcome |
| --- | --- | --- |
| `keep` | `media` | durable locally **and** submitted — a duplicate, deliberately |
| `discard` | `media` | released after promotion succeeds; only the submission's copy remains |
| `keep` | `none` | local-only asset, subject to project cleanup |
| `discard` | `none` | swept after completion, per the ledger lifecycle |

**One media identity.** The submission filename is the only identity written
into the XForm; the project-media/ledger id stays an internal precursor. No
Gather-specific filename is serialized alongside an ODK one.

### Ordering

Required outputs are validated, then media is attached, then scalars are
coerced and written, then media nodes receive their filenames, then provenance.
**Attachment precedes every XForms write**, so a failure leaves a recoverable
orphan rather than XML pointing at media that does not exist — the same bias as
`releaseInstanceMedia`. An attachment that yields no filename is a failure, not
a silently empty node.

Media reuses `attachImageMedia` rather than inventing a second media path, so
the identity invariant established in
[repeat-media-identity-characterization.md](./repeat-media-identity-characterization.md)
continues to hold.

## 7. Partial completion

```text
required output absent  → result invalid; commit nothing
optional output absent  → legitimate completion; clear any previous
                          projected value; report present: false
```

§17 already guarantees the atomicity this needs: every binding coerces before
any write, so a failing binding cannot leave the instance half-populated.

### Landed 2026-09-02

[`src/xforms/compositionCommit.js`](../src/xforms/compositionCommit.js) is the
Accept path:

```text
Accept
  → validate the result
  → required output missing?  yes → stay in the composition, write nothing
  → coerce all bindings
  → commit atomically
  → record provenance
```

A missing required output is a **composition completion failure**, not a
partially finalized instance — validation runs before any write, so an invalid
accepted result never crosses into XForms.

Three details worth knowing:

- **A required output of `null` is missing.** `toXFormsValue` clears the field
  for `null` as it does for `undefined`, so a required value that came back
  null is not a value. The writer's own `present` flag is narrower — it reports
  only `undefined` — and the difference is deliberate.
- **An absent optional output clears its field *and* its provenance**, since a
  receipt left behind would describe a value that is no longer there.
- **Provenance failures are reported, not thrown.** The values are already
  committed by then, so telling the host that Accept failed would be worse than
  telling it provenance is incomplete. A receipt store supplied without a
  receipt (or without an instance) *is* refused up front, because silently
  skipping provenance would quietly break principle 5.

### Where the sweep runs

At the **instance lifecycle owner**, never inside the composition runtime: a
composition declares disposition and does not know cleanup mechanics.
`GatherProvider` exposes `sweepProjectMedia`, and `FormRunner` calls it after a
successful draft save — a safe boundary, because the draft's XML is durable so
the referenced set is settled. It is best-effort and its outcome is not
surfaced: cleanup must never fail a save.

The other boundary, **after a successful composition result commit**, is
identified but unreachable until a composition control exists to reach it.

## Open dependencies

Two things B-custom depends on that **do not exist yet**, and one is load-bearing
for principle 5.

### Receipts are created but never persisted

`createExecutionReceipt` ([`src/scientific/provenance/receipt.js`](../src/scientific/provenance/receipt.js))
produces receipts, and `segmentAndMeasure` returns them inside
`provenance.executionReceipts` — but **nothing writes them to storage.** The
schema has no receipt or provenance table (`send_receipt` on `instances` is a
submission receipt, unrelated).

That matters twice over:

- §3 keeps provenance "in the existing receipt machinery", but with projections
  as the only committed representation, an unpersisted receipt means provenance
  does not survive acceptance at all.
- §5 distinguishes manual fallback from computed data by **the presence of a
  receipt** — which requires somewhere to look.

So a receipt store, keyed by instance and binding reference, is a **prerequisite
for principle 5**, not a later refinement. Its absence does not change any
decision above; it changes what has to be built first.

**Landed 2026-09-02** — migration 11, `instance_receipts`:

```text
PRIMARY KEY (local_instance_id, binding_reference)
  → one receipt per projected field
REFERENCES instances(...) ON DELETE CASCADE
  → provenance never outlives the instance it describes
receipt_json + extracted capability / capability_revision / revision / recorded_at
  → verbatim for audit, indexed for "is this computed, and by what"
```

`instances` gained `upsertReceipt` / `getReceipt` / `listReceipts` /
`deleteReceipt`. Four properties are deliberate:

- **`getReceipt` returning `null` is the load-bearing answer.** It is how a
  value typed by hand in another client is told apart from a computed one.
- **Writes are draft-only**, like `upsertMedia`: provenance is recorded while
  the value is collected. **Reads are not state-restricted** — a sent
  instance's provenance has to stay readable for audit.
- **Re-running a composition replaces the row**, so a field never carries
  provenance from a superseded run.
- **`deleteReceipt` exists because §7 clears absent optional outputs.** A
  receipt left on a cleared field would claim provenance for a value that is
  no longer there.

Verified by unit tests, and the migration was executed against real SQLite
(3.39.2) to confirm the `ON CONFLICT … DO UPDATE` upsert replaces rather than
duplicates, `recorded_at` populates, and the cascade fires — the migration test
alone only checks the SQL text.

**No production consumer yet, by design** — the consumer is the composition→ODK
gate, the same way §17 landed the `setValue` seam ahead of its caller.

### Project-level asset cleanup — landed 2026-09-02

Migration 12 adds `project_assets`, the **ledger** that makes cleanup possible
at all. The hazard it removes is concrete: `persistScientificCapture` writes
into the project media directory with **no `instance_media` row**, so the
obvious sweep — "delete every file no attachment references" — would have
deleted every scientific capture, i.e. exactly the `projection: none,
retention: keep` assets §4 says to keep.

```text
file_key PRIMARY KEY            → recording an asset is idempotent
CHECK (retention IN keep|discard)  → a closed set; no unrecognised value
                                     can reach the planner
released_at                     → what keeps "discard" from meaning
                                  "delete immediately after compute"
REFERENCES projects ON DELETE CASCADE
```

[`src/instances/assetCleanup.js`](../src/instances/assetCleanup.js) keeps the
dangerous half pure. `planAssetCleanup` is a function of three inputs — what is
on disk, what submission still needs, and what the ledger says — returning a
plan that explains every decision:

| Situation | Outcome |
| --- | --- |
| referenced by `instance_media` | **keep** — outranks the ledger, so a submitted `discard` output survives the handoff |
| `retention: keep` | keep |
| `retention: discard`, released | **delete** |
| `retention: discard`, not released | keep — still in use |
| on disk, in neither | **unledgered** — kept unless `reclaimOrphans` |
| in ledger, not on disk | prune the row; never a file delete |

Three properties are deliberate:

- **`reclaimOrphans` defaults to false.** Installs predate the ledger, and
  captures were written unrecorded for a long time, so treating unknown files
  as garbage would be data loss.
- **An unrecognised `retention` value is not permission to delete.** Only an
  explicit `discard` deletes.
- **Bytes go before the row.** A failure part-way leaves a row for a file that
  is gone, which the next sweep prunes as `missing`. The reverse strands bytes
  that nothing records — the unreclaimable case.

`sweepProjectAssets` composes enumeration, planning and execution with
everything injected. Ledger failures never fail a capture: the bytes are already
durable, and an unrecorded asset is merely un-reclaimable, which the
conservative default already treats as "keep".

Migration 12 was executed against real SQLite 3.39.2 — apply, `created_at`
default, the retention CHECK rejecting a bad value, and the project cascade.

**Still not wired:** nothing calls `sweepProjectAssets` yet. The lifecycle
points that should are discard, successful send, and an explicit user action;
choosing them is a policy decision rather than a mechanism gap. Deliberately
lifecycle-based, with no TTLs.

## The gate's composition — Quadrat Tally (2026-09-02)

The composition→ODK path needed something minimal to drive. Photo Capture could
not: its result is a single `ImageAsset`, so it never exercises scalar
coercion or a binding manifest. Segment & Measure is deprecated and drags ONNX
into a gate. So the fixture is authored:
[`test/fixtures/quadrat-tally/`](../test/fixtures/quadrat-tally/).

```text
View: tally   Text + / − + flag + Accept   →  { count, note? }
```

Deliberately the smallest thing that exercises the whole path — no camera, no
model, no capability. `count` is required; `note` appears only when the tally is
flagged uncertain, which is what covers the **absent-optional** path: clear the
field *and* delete its provenance.

Four things it establishes:

- **The composition names outputs, never XPaths.** Asserted by a test that
  serializes the definition and fails if `/data/` appears anywhere in it, so
  reusability across forms cannot rot quietly.
- **Composition-local actions are legitimate.** `+1` / `−1` / flag are this
  composition's own event names. Catalog action ids are fixed vocabulary
  because they ship with a *Component*; a composition's own buttons are its
  own business, and the runtime routes whatever name arrives to its handler.
  `hostActions` is metadata, not enforcement.
- **"Computed" means *produced by the composition*, not produced by a model.**
  A hand-driven tally still earns an execution receipt, because the receipt is
  what distinguishes this value from the same number typed straight into the
  backing field by another ODK client (principle 5). Nothing about principle 5
  requires a model to have run.
- **No `Flow`.** One View needs no view selector. `Flow` is for choosing among
  authored Views.

### A runtime characteristic worth knowing

**The A2UI surface absorbs whatever the action handler throws.** `dispatchAction`
resolves and the caller learns nothing. That is why Photo Capture writes its
failures into the data model and renders an error View rather than relying on
the throw propagating — a convention that reads as ceremony until you know the
throw goes nowhere. Any composition that can fail needs an error path in its
own state; it cannot report upward.

### Verified

The end-to-end test drives the **real** runtime: authored composition → typed
result + receipt → binding manifest resolution → `commitCompositionResult` →
XForms values and provenance, including the flagged and unflagged variants and
the required-missing refusal. No device, no model, no camera.

## The composition control — landed 2026-09-02

[`XFormsCompositionControl`](../src/xforms/controls/XFormsCompositionControl.js)
hosts an authored composition for a group carrying the appearance and commits
its result:

```text
A2UIHost → accepted result + receipt → commitCompositionResult → XForms values
```

The control owns none of that logic — resolution is the manifest's, commit and
provenance are `compositionCommit`'s, and both arrive through an injected
`composition` adapter, the same shape the collection field's `collection`
adapter has. `FormRunner` builds it: it reads the manifest from the form's
attachments at load, resolves fields against the render model, and commits.

`A2UIHost`'s prop is now `composition`, not `tool` — the last of the naming
§11 demoted. No production caller existed, so the rename touched two source
files and three test call sites.

### Two things `FormRunner` has to get right

**A draft must exist before the commit.** Provenance attaches to an instance, so
the very first composition run in a fresh form would otherwise be refused for
want of somewhere to record it. The adapter creates the draft first — better
than passing `receipts: null`, which would silently skip provenance and quietly
break principle 5.

**A commit that is not yet persisted says so.** After committing, the adapter
saves the draft, and `saveDraft` can decline while another operation holds
`busy`. The values would then live only in engine state until the next save, so
the outcome carries `persisted` and the control reports "Recorded, but not yet
saved to this draft" rather than letting "Recorded 3 values" stand for
something not on disk.

`saveDraft` now returns the saved instance rather than `true`, which is what
makes the first of those possible; callers that only tested truthiness are
unaffected.

### §6 — mostly closed (2026-09-02)

**Compositions are supplied by forms.** The definition travels as a
version-pinned form resource and is loaded by
[`definitionLoader.js`](../src/xforms/compositions/definitionLoader.js):

```text
appearance  gather-composition:<id>
        ↓
form binding manifest  → names a definition resource
        ↓
version-pinned form attachment
        ↓
parse + validate
        ↓
generic A2UIHost
        ↓
optional registered handler?
   ├─ yes → app-shipped specialization
   └─ no  → authored actions/functions only  ← the normal case
```

Gather registers **executable primitives** — Components, Capabilities, host
Functions. It no longer registers compositions. `registerCompositionHandler`
takes behaviour only and **refuses an entry carrying a definition**, because a
registry that could supply definitions would make Composer portability silently
depend on app registration.

**Failure semantics changed with it.** "Unavailable" now means the attachment is
missing, the manifest reference is invalid, the definition fails validation, or
its id disagrees with the group — *not* "Gather has no bespoke JS for this". A
handler-free composition is completely valid.

What remains of the original §6 gap is narrow: a composition whose behaviour
cannot be expressed with authored actions still needs app-shipped JS. That is
the sequencing question, not a packaging one.

That is **a perfectly valid intermediate architecture**, and it is deliberate.
Composition *structure* is portable form data; composition *behaviour* is
registered application code (the limitation recorded in
[§10](./components-capabilities-ownership.md)).

The limit only becomes a problem under a stronger requirement than we need to
assume today:

> A researcher authors a brand-new composition, attaches it to a form, and an
> already-installed Gather app executes it without any app code knowing what it
> is.

**Tripwire.** When a second or third genuine authored composition needs
substantial bespoke behaviour *and* those compositions must be distributable
without an app release, extract the smallest portable behaviour model that makes
it possible.

**Do not build that model alongside A2UI.** Extend A2UI only where Gather
behaviour cannot already be expressed through Components, bindings, actions and
registered functions — preference order: A2UI directly, then a Component API,
then a Capability contract, then a Gather extension.

Auditing the largest real handler against that order
([composition-behaviour-audit.md](./composition-behaviour-audit.md)) already
dissolves most of a candidate vocabulary:

| Candidate | Verdict |
| --- | --- |
| `setView` | **Not needed** — `Flow` binds `current: { path }`, so a transition already *is* a data-model write |
| `invokeCapability` | **Not a Gather concept** — A2UI specifies a function mechanism; the Capability Registry should expose capabilities to it |
| `persistAsset` | **Needed** — crosses into storage lifecycle |
| `completeComposition` | **Needed** — the host/XForms completion seam, and it absorbs result assembly |

One runtime blocker remains, and it is smaller than first recorded.
`@a2ui/web_core@0.9.1` **does** implement local `functionCall` — registry,
argument validation, loud failure, async
([a2ui-functioncall-gap.md](./a2ui-functioncall-gap.md) corrects the earlier
claim). What is missing is interaction-time evaluation and a result destination.
Separately, there is still **no conditional or comparison primitive**, so guards
stay host-side or get designed away.

`handlers/registry.js` being **empty in the shipped app is healthy**: nothing has
been hardwired into a supposedly generic runtime merely to make the registry look
useful. It is a registry rather than a frozen constant so a harness registers
what it drives and exercises the real `FormRunner` path — testing *around* the
screen is what let three earlier defects survive (§25), and a constant would
have forced that mistake again.

### Verified — device, 2026-09-02

Headlessly through the real runtime (both output variants and the
required-missing refusal), **and on a Pixel 10 through the real `FormRunner`**
via [`gates/DevSeedCompositionApp.js`](../gates/DevSeedCompositionApp.js).

Confirmed against the database and the authoritative XML rather than the
on-screen message:

```xml
<quadrat><count>3</count><note>uncertain</note></quadrat>
```

```text
instance_receipts:  /data/quadrat/count  gather.fixture.quadrat-tally  sha256:9a3bf5…
                    /data/quadrat/note   gather.fixture.quadrat-tally  sha256:9a3bf5…
```

An unflagged tally then wrote `<note/>` and left **only** the `count` receipt —
so §7's clear path, field *and* provenance, holds on device.

### The defect it found

Accepting threw `UNIQUE constraint failed: instances.project_key,
instances.odk_instance_id`.

`commitCompositionResult` needs a draft to exist so provenance has somewhere to
attach, so the adapter created one — but the follow-up `saveDraft()` read
`instance?.localInstanceId` from its **own closure**, which is still `null` in
the same tick because `instance` is React state. So it created a *second* draft,
and the engine's preloaded `instanceID` had not changed, so the two collided.

`saveDraft` now takes an explicit `localInstanceId`, and the adapter passes the
one it just created. Only a run through `FormRunner` could surface this: the
headless tests inject a form seam, and a harness mounting the control directly
would have supplied its own instance id — which is exactly why the composition
registry is a registry rather than a frozen constant (§25).

## 4b. Retention is an output disposition, not a capture argument (2026-09-02)

The first device run left 257 KB duplicated per capture, permanently. The ledger
row said `retention: keep` with no `local_instance_id`, which puts it outside
every sweep — while the submission already owned a copy of the same bytes.

Nothing was behaving incorrectly. `gather_persistAsset` took a `retention`
argument and the authored composition passed `keep`, so the ledger did exactly
what it was told. The mistake was **where the question was asked.**

```text
persistAsset             completeComposition + binding
"make this durable"      "this output is media + discard"
     ↑                              ↑
capture time:            completion: the role is finally known
the role is unknown
```

Retention is a property of the *output*, and an asset does not become an output
until completion. Asking at capture time forces the author to predict a role,
and any default the runtime picks for them is a guess: `keep` duplicates every
promoted capture forever, `discard` destroys a working asset someone wanted.

So:

```text
gather_persistAsset(capture)
  → a durable WORKING asset
  → ledger row: discard, unreleased  ("still in use", planner rule 4)
  → no disposition argument at all

gather_completeComposition(outputs)
  → projection: media  → promote bytes into instance_media, filename into XML
  → then, per binding retention:
       keep    → setRetention(keep)     the canonical Gather asset survives
       discard → releaseAsset()          the sweep reclaims it
```

Three consequences worth stating:

- **A `projection: media` binding defaults to `discard`** — revised 2026-09-02;
  it was briefly required. The default is safe *here specifically* because the
  XForm has already named a durable owner other than Gather: once promotion and
  the XML commit succeed, `instance_media` holds the submission copy and the
  node holds its filename, so the working copy is a duplicate. `keep` is the
  deliberate request to retain a project-local one.
- **Disposition is settled last**, after both the attachment and every XForms
  write. Releasing earlier could hand a sweep bytes the instance still needs.
  Failures are reported, never thrown — the same bias as provenance, because an
  unsettled disposition leaves bytes behind rather than losing any.
- **Retention with no media projection is refused.** The default above does not
  generalise: with no durable XForms destination, `keep` versus `discard`
  decides whether the bytes survive at all, so that case must state it. Gather
  cannot author such an output today, so the parser refuses rather than guesses.
  See [the binding reassessment](./composition-binding-reassessment.md) for
  where this metadata is headed once the manifest goes.

The ownership model the sweep now sees is clean:

| ledger state | meaning |
| --- | --- |
| `discard`, unreleased | working asset, still in use |
| `keep` | canonical Gather asset, deliberately retained |
| `discard`, released | reclaimable |

### One asset, one Gather identity

The same run showed the ledger's `asset_id` and the returned `ImageAsset.assetId`
disagreeing (`image-…633` vs `image-…694`): `persistScientificCapture` minted an
id to build the storage key and record the row, and `imageAssetService.persistCapture`
minted a *second* one for the object it returned. Only `path` — the fileKey —
was shared, which is why nothing visibly broke.

Two records are legitimate here and stay:

```text
Gather ImageAsset   → the project working asset
ODK instance_media  → the submission attachment, with its own filename
```

What is not legitimate is a second *Gather* identity for the same persisted
bytes. `persistCapture` now takes the caller's `assetId` when it has one and
mints only as a fallback, so the ledger row and the `ImageAsset` agree.
Promotion **consumes** that asset — it reads its fileKey and creates the ODK
row — rather than creating another.

## Where this code lives, and why

All composition↔XForms integration sits in
[`src/xforms/compositions/`](../src/xforms/compositions/) — recognition, the
manifest runtime, binding and commit, the control, and the handler registry.
Its README carries the ownership rules and the package test:

> Could this module make sense in another application that uses the package but
> does not know what Gather is?

`odk-xforms-*` stays generic ODK/XForms machinery and learns nothing about
`gather-composition`, manifests, receipts, retention or asset ledgers —
otherwise a nominally reusable package becomes Gather core with a generic name.

The one plausible near-term package move is the **portable** half of the
manifest — its schema and validator — if Composer, a publisher, the runtime and
tests all consume the same declaration. That is a `gather-catalog` shape. The
runtime halves stay in the app. The receipt store and asset ledger stay in
`gather-storage` (Gather's own storage layer) with composition-specific
semantics; a generic media-ownership home has to be **earned by actual reuse**.

## Roadmap position

```text
B-standard  →  A: collection binding  →  B-custom (this document)
  (done)          (done, device-verified)   ├── receipt store        ← prerequisite
                                            ├── asset cleanup        ← prerequisite
                                            ├── binding manifest + recognition
                                            ├── subtree ownership for groups
                                            └── composition→ODK gate
```
