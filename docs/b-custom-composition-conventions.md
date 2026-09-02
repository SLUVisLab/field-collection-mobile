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

## 7. Partial completion

```text
required output absent  → result invalid; commit nothing
optional output absent  → legitimate completion; clear any previous
                          projected value; report present: false
```

§17 already guarantees the atomicity this needs: every binding coerces before
any write, so a failing binding cannot leave the instance half-populated.

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
everything injected. `persistScientificCapture` now records each capture with
`retention: 'keep'` by default, and takes an override so an authored discard
policy can set it per output. Ledger failures never fail a capture: the bytes
are already durable, and an unrecorded asset is merely un-reclaimable, which
the conservative default already treats as "keep".

Migration 12 was executed against real SQLite 3.39.2 — apply, `created_at`
default, the retention CHECK rejecting a bad value, and the project cascade.

**Still not wired:** nothing calls `sweepProjectAssets` yet. The lifecycle
points that should are discard, successful send, and an explicit user action;
choosing them is a policy decision rather than a mechanism gap. Deliberately
lifecycle-based, with no TTLs.

## Roadmap position

```text
B-standard  →  A: collection binding  →  B-custom (this document)
  (done)          (done, device-verified)   ├── receipt store        ← prerequisite
                                            ├── asset cleanup        ← prerequisite
                                            ├── binding manifest + recognition
                                            ├── subtree ownership for groups
                                            └── composition→ODK gate
```
