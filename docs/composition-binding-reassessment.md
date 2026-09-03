# Reassessing the binding manifest against ODK's own patterns

**Question.** Before canonizing `gather-bindings.json` as a Gather artifact, can
most or all of its job be done by ordinary XForms structure the form already
carries?

**Status: landed 2026-09-02.** The manifest is gone —
`src/xforms/compositions/manifest.js` is deleted and
`compositionBinding.js` derives every binding from the XForm group. What remains open is
narrower and separable — how the opaque composition bundle claims a Central
attachment slot.

**Answer.** Yes — all of it. Every field in the manifest is either already
present in the XForm subtree, a duplicate of the appearance token that named the
composition, or one of two small facts that fit existing XForm extension points.
The manifest can be deleted rather than shrunk.

Revised 2026-09-02 after review: the remaining metadata rides **namespaced
`body::` / `bind::` attributes**, not appearance tokens; retention **defaults**
for a media projection; and a separate packaging question — how Central learns
the composition resource is an expected attachment — is split out below. Both
implementation caveats raised in review have been spiked
([experiments/namespaced-gather-attributes](../experiments/namespaced-gather-attributes/)).

## The precedent

ODK Collect's external-app integration populates several fields at once from one
external interaction, and the mapping is by **name inside the containing group**:

> "If the `Intent` extras returned by the external application contains values
> with keys that match **the type and the name** of fields in the group, then
> the values from the `Intent` extras overwrite the current values of those
> fields."
> — [docs.getodk.org/collect-external-apps](https://docs.getodk.org/collect-external-apps/)

```text
begin_group   mygroup           field-list
  body::intent  org.mycompany.myapp(my_text='Some text')
  text        some_text
  image       some_image
end_group
```

No aliasing, no side-car mapping document, no XPaths. Binary questions are
handled by *type*: the app returns a content URI and Collect does the attachment
work. Two things are worth taking from this beyond the shape: matching is on
**name and type together**, and the group is the namespace.

The second precedent is resource reference. XLSForm names an attached file
**inline, in the type column** — `select_one_from_file lgas.csv`,
`csv-external people` — rather than in a separate discovery document.

Neither is being reused literally. Gather runs compositions internally and
cross-platform, so `body::intent` is irrelevant; what transfers is the
**data model**.

## What the manifest actually contains

Per binding, today: `{ path, reference, required, projection, retention }`.

| manifest field | derivable from the XForm subtree? | from what |
| --- | --- | --- |
| `reference` | **Yes** | the child's own reference. `RenderNode.parentReference` gives the group's children directly — no prefix matching |
| `path` | **Yes**, in the normal case | the child's name (last path segment) |
| `required` | **Yes, and better** | `RenderNode.required` is the engine's *live* evaluation of the bind, so a conditionally-required output works. A static manifest flag cannot express that at all |
| `projection` | **Yes** | `nodeType === 'upload'` with `valueType: 'binary'` and `mediaType: 'image'`. The XForm already says `<upload ref="/data/photo/image" mediatype="image/*">` |
| `retention` | **No** | not an XForms concept |

Per field: `{ reference, composition, definition, bindings }`.

| manifest field | derivable? | from what |
| --- | --- | --- |
| `reference` | **Yes** | it *is* the composition group node |
| `composition` | **Yes** | already in the `gather-composition` appearance. The manifest copy exists only so the two can be cross-checked against each other |
| `definition` | No | but expressible as `body::gather:composition` on the group row |
| `bindings` | **Yes** | per the table above |

Both real compositions in the tree already match by name, exactly:

```text
quadrat_tally_v1   outputs count, note   →  /data/quadrat/count,  /data/quadrat/note
authored_photo_v1  outputs image, note   →  /data/photo/image,    /data/photo/note
```

The manifest is currently restating what the group already says.

### The manifest is the redundant copy — the other two are not

`required` and `type` appear in three places today. Only one of them is
redundant, and it is the manifest's.

The other two are **different contracts that happen to share a word**:

```text
composition.result.outputs.foo.required
    producer contract — can this composition legitimately complete without foo?

RenderNode.required
    form contract — does this particular form require foo right now?
```

The second can vary with instance state, because XForms `required` is an
evaluated XPath expression. So they are not two statements of one fact, and
reconciling them means combining them rather than checking they agree:

```text
required now =  composition output intrinsically required
             OR XForms node currently required
```

| composition says | XForm says now | absent output |
| --- | --- | --- |
| required | anything | Accept fails |
| optional | not required | fine |
| optional | required | Accept fails *now* |

Type divides the same way — producer type versus destination type — so the
loader validates that the pair is **projectably compatible**, not that the two
strings match. `int` into `int`, `ImageAsset` into `binary`/`upload`.

The manifest's copy is the one that carries no independent meaning, and today
nothing reconciles it with either: a `string` output bound to an `int` node
loads happily and fails later, during coercion. Deleting it leaves two contracts
with a real check between them — exactly ODK's "type and name".

## The proposal

```text
survey
  begin_group  flower_analysis   appearance: gather-composition
    image      image
    decimal    area
    integer    petal_count
  end_group

body::gather:composition   flower_v1.gather      ← on the group row
bind::gather:retention     keep                  ← exceptional, on the image row
bind::gather:output        petalCount            ← exceptional, on the child row
```

Ordinary XLSForm group, ordinary typed children. No side-car document.

Binding is **group-relative and by name**: a composition's declared output names
must be names of the group's **body-backed** children. The artifact still
carries no XPaths, so reuse across forms is unaffected — a form chooses the
group's reference and its place in the tree, and only gives up the freedom to
name the children arbitrarily. That is precisely ODK's own constraint for
external apps, and it holds in practice.

The load-time contract is then:

```text
composition  result.outputs
        ↕ validate: name matches (unless overridden), type is compatible
XForm        body-backed children of the composition group

requiredness comes from XForms, at runtime
```

### Appearance marks rendering; namespaced attributes carry data semantics

`appearance` is a body/UI property in XForms. "Substitute a composition UI for
this group" belongs there. Which resource supplies it, where an output lands,
and whether working bytes survive are **data-binding semantics**, and XLSForm
has a sanctioned mechanism for exactly this: `body::`, `bind::` and `instance::`
columns emitting custom attributes in a namespace declared on the settings
sheet.

The precedent is Entities: `entities:saveto` is a namespaced *bind* attribute
saying that a form node maps to a named Entity property. `gather:output` is
almost the same class of relationship.

| carries | mechanism |
| --- | --- |
| Gather should render a composition here | `appearance = gather-composition` |
| which resource supplies it | `body::gather:composition` on the group |
| where an output lands | ordinary child name + XForms type |
| exceptional output mapping | `bind::gather:output` |
| exceptional storage lifecycle | `bind::gather:retention` |

**Verified, not assumed** ([experiments/namespaced-gather-attributes](../experiments/namespaced-gather-attributes/)):
the engine exposes all three through the live definition objects —
`node.definition.bodyElement.element.getAttributeNS(ns, 'composition')` and
`node.definition.bind.bindElement.getAttributeNS(ns, 'retention')`, the second
being exactly how the vendored `entity-effects.js` already reads
`entities:saveto`. Our **render model** does not project them yet; the sidecar's
`buildRenderModel` has to read them inside the WebView and emit plain strings,
as it already does for `appearances` and `mediaType`.

### Body-backed children, not all children

The spike also showed something the earlier draft of this document got wrong. A
node with a bind and **no body control** still appears as a child of the group —
as `nodeType: 'model-value'`, with no `bodyElement` at all:

```text
model-value  /data/flower_analysis/hidden_note  <no bodyElement>
```

So the degradation guarantee is not automatic. Binding must filter to
body-backed children **explicitly**; without that filter, name-based binding
would write into a node no other ODK client can see or fill — the exact failure
the manifest was accused of permitting.

## What stays Gather-specific, and where it goes

**1. Which resource carries the composition.** `body::gather:composition` on the
group row. The artifact is then the authority on its own `id`, and a registered
handler is looked up by that id rather than by the appearance.

**2. Retention.** `bind::gather:retention` on the child whose asset it governs —
and, per the rule below, only ever as an exception.

**3. Exceptional name mapping.** `bind::gather:output` on the child, naming the
output it takes. This also covers the two things plain name matching cannot: a
nested result path (`gather:output="color.name"`) and one output feeding two
fields (two children naming the same path). So even the escape hatch needs no
JSON.

There is exactly one thing the manifest can express that this cannot: binding to
a node with **no body control**. That should not be expressible — it is the case
that breaks ODK degradation, because another client cannot fill by hand what it
cannot see.

## Retention: default only where the XForm proves another owner exists

Landed 2026-09-02, superseding "required on every media binding".

```text
binary XForms media destination exists   →  default: discard the working duplicate
no durable media destination             →  retention must be explicit
```

Once promotion and the XML commit have succeeded, an asset bound to an ordinary
`<upload>` has a durable owner that is not Gather: `instance_media` holds the
submission copy and the XForms node holds its filename. The Gather working copy
is then simply a duplicate, so `discard` is the honest default and `keep` is the
deliberate request to retain a project-local copy. That is what gives the
ordinary image case **zero** Gather metadata.

The same default would be unsafe anywhere else. For an asset output with no
durable XForms destination, `keep` versus `discard` decides whether the bytes
survive at all, so that case must state it. Gather cannot author such an output
today, and the manifest parser refuses one rather than guessing —
`GATHER_COMPOSITION_BINDING_RETENTION_WITHOUT_MEDIA`.

## Effect on degradation

It improves. Under the manifest, a form can bind a composition output to a
model-only node another ODK client can neither see nor populate, and nothing
refuses it. Name-based binding makes the group's ordinary typed children the
*only* possible destinations, so the guarantee that "another ODK client sees a
plain group it can fill by hand" becomes structural rather than a convention
authors are asked to honour.

## Appearance survival is no longer the risk

The earlier draft flagged two unknowns. Both are settled without a spike:
ODK's own external-app documentation shows a `begin_group` with
`appearance=field-list` becoming `<group … appearance="field-list">`, and ODK
documents `annotate`, `new`, `new-front`, `draw`, `signature` and `external-app`
appearances on **image** questions. Combined with the custom-token pyxform check
already recorded in [b-standard §3](./b-standard-field-conventions.md), this is
not a meaningful blocker.

It also **removes** a risk. The manifest was a `.json` form resource, and Central
may serve `.json` as `application/octet-stream`, which makes `isTextResource`
false and the manifest silently never found — the Step 5b hazard. Deleting the
manifest halves that surface.

## The real open question is packaging, not binding

Central will not accept an attachment it did not expect, and it decides what to
expect by scanning the XForm. Its scan
(`central-backend lib/data/schema.js`, `expectedFormAttachments`) covers
`<instance src>`, itext `<value form="image|audio|video|big-image">`, instance
default values, `<input query>` and select `search()` appearances, matching
`^jr://(?:images|audio|video|file|file-csv)/([^/]+)$`. It does **not** scan
arbitrary attributes.

So `body::gather:composition="flower_v1.gather"` names the resource for *Gather*
but creates no attachment slot in Central. `select_one_from_file` works because
pyxform turns it into a standard external secondary instance with a `jr://file…`
reference — that is what Central recognises.

This is a distribution problem, not a binding problem. If it is unsolved, the
answer is a sanctioned way to make the composition bundle a recognised form
resource — **not** the return of the binding manifest, which would face exactly
the same attachment question.

### Two routes rejected

Neither of these is acceptable, and both were tempting:

- **Disguising the bundle as CSV or XML** so an external secondary instance will
  parse. `<instance src="jr://file/flower.gather"/>` would then mean *"do not
  interpret this as an instance; I am exploiting it to make Central notice a
  file."* That is exactly the clever coupling this whole reassessment removes,
  and it could fail the form in another conforming client.
- **Patching the engine** to ignore an opaque unreferenced secondary instance.
  Same problem, moved into our fork.

Problem **A** — what a Gather composition artifact *is* — must not be dictated
by problem **B** — how an XForm tells Central the file is one of its resources.

### What the resource spike found

[experiments/opaque-resource-declaration](../experiments/opaque-resource-declaration/)
ran both remaining candidates against the real engine.

**The binary node default pollutes submissions.** The engine never fetches it
and it surfaces as `model-value` with no body control, so nothing renders — but
the value is in the primary instance and therefore in every submission:

```text
<data id="binary_default"><site_name>North ridge</site_name>
  <gather_composition_bundle>jr://images/flower_v1.gather</gather_composition_bundle>
  <meta>…</meta></data>
```

A resource-distribution detail becomes a permanent fake answer in the collected
data. Rejected.

**An inline secondary instance is clean on every axis.**

```xml
<instance id="gather_resources">
  <root><item><name>composition</name><uri>jr://images/flower_v1.gather</uri></item></root>
</instance>
```

Nothing is fetched (an inline instance has no `src`, which is the whole
difference from the external one the engine refused); the primary instance is
untouched, so submissions are unaffected; and it makes no false claim about
being loadable, because an inline secondary instance genuinely *is* static model
data. Another conforming client ignores an unused one.

The residual dishonesty is confined to a **URI scheme prefix**. Central's
default-value scan matches `^jr://images/` only — `jr://file/` is accepted for
`<instance src>` and itext but *not* for instance defaults — so the bundle has
to be announced as `jr://images/flower_v1.gather`. Nothing about the artifact's
format, the form's behaviour, or the submission changes.

### The remaining choice

| | cost | buys |
| --- | --- | --- |
| inline secondary instance, `images/` prefix | one misleading scheme on one URI | ODK-native declaration, zero submission impact, no constraint on `.gather` |
| a narrow Gather publishing convention | a Gather-specific publishing step | total honesty |

Still unobserved: Central's behaviour above is read from its source. The
default-value traversal visits every `<instance>` element with no bind-type
filter — Central's own comment concedes *"we're cheating for now"* — but that
needs confirming against a real draft before either route is committed to.

## Next implementation steps

1. ~~Verify `@getodk/xforms-engine` exposes namespaced body/bind attributes.~~
   **Done.**
2. ~~Project those attributes through `buildRenderModel` in the WebView
   sidecar.~~ **Done** — `RenderNode` now carries `bodyBacked` and `gather`.
2b. ~~Name-based binding, body-backed filter, `manifest.js` →
   `compositionBinding.js`.~~ **Done.**
3. Confirm against a real Central draft that an inline secondary instance's
   `jr://images/…` node text claims an attachment slot — the only remaining
   unobserved link.
4. ~~Delete the manifest code and rename what survives.~~ **Done.**
5. The **Central gate**, now narrow enough to state in one sentence: can a stock
   Central form version carry our opaque composition resource using the
   `gather_resources` declaration? It decides nothing about binding, composition
   execution or XForms persistence.
6. ~~Re-run the physical-device disposition lifecycle against the rewritten
   binding path.~~ **Done — see below.**

## Device proof of the rewritten path (2026-09-02)

Physical Pixel, `gates/DevSeedAuthoredCompositionApp.js`, no binding manifest
anywhere in the form (`Version 1 · 1 resource` — the composition artifact alone).

The composition resolved and rendered from the group's own children, and the
whole disposition lifecycle held:

```text
Save photo   project_assets: image-1788403091274-…  discard  released_at=NULL
                             ↑ working, still in use — planner rule 4
                             ↑ asset_id == filename == receipt.assetId

Accept       instance_media: /data/photo/image → image-mtkx1bxezyx353.jpg
             receipts:       /data/photo/note + /data/photo/image
             XML:            <photo><note>authored</note>
                               <image>image-mtkx1bxezyx353.jpg</image></photo>
             project_assets: working row GONE, file GONE from disk
```

So both earlier defects are fixed in the field, not just in tests: the working
duplicate is released and swept once the submission owns its copy, and one
persisted asset now has exactly one Gather identity — the ledger row, the
filename and the receipt's `assetId` all agree.

Save → exit → reopen → resume → save preserved the XML, the media row and both
receipts. A draft created *before* the rewrite, under the manifest, also resumes
cleanly under name-based binding — the XForm structure is what both read.

### The defect it found

The canonical appearance is bare `gather-composition`, so `field.compositionId`
is legitimately `null` and the artifact is the authority on its own id. The
definition loader still compared the two unconditionally, and reported:

```text
authored_photo_v1.a2ui.json declares composition "authored_photo_v1"
  but /data/photo names "null".
```

Every handler-free composition — the normal case — was unavailable. The
comparison now runs only when the group actually named an id, which is the
registered-composition form. Regression tests both ways.

Worth noting what caught it: the message named the real mismatch and its two
sides, so the cause was obvious on sight. The manifest-era wording would have
said only that something had no entry.

The compatibility contract the rewrite settled is tabulated in
[b-custom §1a](./b-custom-composition-conventions.md).

## Answers to the three questions

**Which manifest fields are mechanically derivable?** All of `reference`,
`path`, `required` and `projection` — `required` more correctly than today, and
`projection` straight from `<upload>`. Group reference comes from the
composition node itself, and `composition` is already in its appearance.

**What genuinely remains Gather-specific?** Two facts: which resource carries
the composition, and retention — plus an optional output-name escape hatch. All
three ride namespaced `body::` / `bind::` attributes, the mechanism XLSForm
provides for exactly this and Entities already uses. No parallel binding
language. With retention defaulted, only the first appears in an ordinary form.

**Can the normal case be group + marker + attachment, with no manifest?** Yes —
an ordinary XLSForm group with `appearance = gather-composition` and one
`body::gather:composition` cell. Everything else is ordinary typed children.
