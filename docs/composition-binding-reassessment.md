# Reassessing the binding manifest against ODK's own patterns

**Question.** Before canonizing `gather-bindings.json` as a Gather artifact, can
most or all of its job be done by ordinary XForms structure the form already
carries?

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

### It is also a third copy

`required` and `type` are declared in **three** places today: the composition
artifact's `result.outputs`, the binding manifest, and the XForm bind. Nothing
reconciles them — a `string` output bound to an `int` node is accepted at load
and fails later, during coercion.

Deriving the binding from the subtree collapses this to two declarations with a
real contract between them, checkable at load:

```text
artifact says:  count is int, required        (the composition's contract)
XForm says:     /data/quadrat/count is int, required=true()   (the instance)
                ↑ cross-check at load, exactly ODK's "type and name"
```

That is *stronger* validation than the manifest provides, not weaker.

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

### What the spike already settled

[experiments/namespaced-gather-attributes §2](../experiments/namespaced-gather-attributes/)
ran the secondary-instance route locally:

| resource content type | result |
| --- | --- |
| `application/json` | rejected: *Failed to determine external secondary instance format … content type: "application/json"* |
| `text/xml` | past format determination |
| `text/csv` | loads cleanly |

Two consequences:

- **Nothing needs to reference the instance.** An unreferenced
  `<instance id="…" src="jr://file/…"/>` loads fine, so declaring one purely to
  claim Central's attachment slot is viable in principle.
- **The blocker is ours, not Central's.** Central's regex accepts
  `flower_v1.a2ui.json` as a `file` attachment; it is the *engine* that fetches
  the resource eagerly and refuses JSON. Format is decided by response content
  type, not extension — the `.a2ui.json` name loaded happily as `text/csv`.

So the remaining choice is between delivering the artifact in a format the
engine parses, putting the reference somewhere else Central scans, and patching
the engine to skip unreferenced instances of unknown format. Deciding needs a
real Central draft, which the local spike cannot reach; Central's behaviour above
is read from its source, not observed.

## Next implementation steps

1. ~~Verify `@getodk/xforms-engine` exposes namespaced body/bind attributes.~~
   **Done** — it does, through `definition.bodyElement.element` and
   `definition.bind.bindElement`.
2. Project those attributes through `buildRenderModel` in the WebView sidecar,
   which is the only reason they are not already usable app-side.
3. Spike Central recognition of the composition resource reference against a
   real draft.
4. Then delete the manifest code.

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
