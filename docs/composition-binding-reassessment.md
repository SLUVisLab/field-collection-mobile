# Reassessing the binding manifest against ODK's own patterns

**Question.** Before canonizing `gather-bindings.json` as a Gather artifact, can
most or all of its job be done by ordinary XForms structure the form already
carries?

**Answer.** Yes — all of it. Every field in the manifest is either already
present in the XForm subtree, a duplicate of the appearance token that named the
composition, or one of two small facts that fit existing XForm extension points.
The manifest can be deleted rather than shrunk.

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
| `composition` | **Yes** | already in the `gather-composition:` appearance. The manifest copy exists only so the two can be cross-checked against each other |
| `definition` | No | but expressible inline, `select_one_from_file`-style |
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
begin_group  flower_analysis   appearance: gather-composition:flower_v1.a2ui.json
  image      image             appearance: gather-retention:keep      ← only if not the default
  decimal    area
  integer    petal_count
end_group
```

Ordinary XLSForm group, ordinary typed children, one appearance token. No
side-car document.

Binding is **group-relative and by name**: the composition's declared output
names must be child names of its group. The composition artifact still carries
no XPaths, so reuse across forms is unaffected — a form chooses the group's
reference and its place in the tree, and only gives up the freedom to name the
children arbitrarily. That is precisely ODK's own constraint for external apps,
and it holds in practice.

### What stays Gather-specific, and where it goes

**1. Which resource carries the composition.** Put the filename in the
appearance token, following `select_one_from_file lgas.csv`:

```text
appearance: gather-composition:flower_v1.a2ui.json
```

The artifact is then the authority on its own `id`, and a registered handler is
looked up by that id rather than by the appearance. The alternative — keep the
token as the id and resolve `<id>.a2ui.json` by convention — is one fewer
character but reintroduces a guess. The naming rule is that a token cannot
contain whitespace, which is the constraint `select_one_from_file` has anyway.

*Considered and rejected:* referencing the artifact as a secondary instance
(`<instance id="flower_v1" src="jr://file/flower_v1.a2ui.json"/>`), which is how
ODK reaches attached CSV/XML. The engine would try to parse it as XML.

**2. Retention.** Not an XForms concept, and it belongs to the output, so put it
on the question whose asset it governs:

```text
image  image  appearance: gather-retention:keep
```

This is the same mechanism `gather-composition:` and `gather-multi-image`
already use, and it degrades the same way: another ODK client sees an unknown
appearance on an ordinary image question and ignores it.

**3. Exceptional name mapping**, if we ever need it — an appearance token on the
child that names the output it takes:

```text
integer  petal_count  appearance: gather-output:petalCount
```

This also covers the two things the manifest can express that plain name
matching cannot: a nested result path (`gather-output:color.name`) and one
output feeding two fields (two children naming the same path). So even the
escape hatch needs no JSON.

There is exactly one thing the manifest can express that this cannot: binding to
a node with **no body control**. That should not be expressible — it is the case
that breaks ODK degradation, because another client cannot fill by hand what it
cannot see.

## Effect on degradation

It improves. Under the manifest, a form can bind a composition output to a
model-only node another ODK client can neither see nor populate, and nothing
refuses it. Name-based binding makes the group's ordinary typed children the
*only* possible destinations, so the guarantee that "another ODK client sees a
plain group it can fill by hand" becomes structural rather than a convention
authors are asked to honour.

## Risk

The whole proposal rests on **appearance tokens surviving XLSForm → pyxform →
Central → device**. That is not a new risk: it is the one
[b-standard §3](./b-standard-field-conventions.md) already verified for repeats —
pyxform passes appearance through verbatim, custom tokens included, and does not
filter to a known vocabulary. Two things still need confirming for this shape
specifically:

- a `begin_group` appearance lands on the `<group>` element (for `begin_repeat`
  pyxform puts it on the `<repeat>` and leaves the group bare — the footgun
  already documented there);
- an appearance on an `image` question survives, which is where retention rides.

It also **removes** a risk. The manifest was a `.json` form resource, and Central
may serve `.json` as `application/octet-stream`, which makes `isTextResource`
false and the manifest silently never found — the Step 5b hazard. Deleting the
manifest halves that surface: only the composition artifact still has to arrive
as a readable text resource.

## Open question for the decision

**Should `retention` default, or stay required?**

We landed on "required on a media binding" in §4b on the grounds that neither
default is safe. That reasoning was made when retention was the *only* signal.
Here the XForm itself already says the node is a binary submission field, which
is independent evidence that the bytes' destination is the submission — so
`discard` has a defensible default reading: the working copy was scaffolding,
and `keep` is the deliberate exception that asks for a duplicate.

Making it default is what lets the common case carry **zero** Gather metadata
beyond the composition marker. Keeping it required means every composition form
still needs a Gather-specific token on its media child, and the manifest
collapses to "almost nothing" rather than nothing.

## Answers to the three questions

**Which manifest fields are mechanically derivable?** All of `reference`,
`path`, `required` and `projection` — `required` more correctly than today, and
`projection` straight from `<upload>`. Group reference comes from the
composition node itself, and `composition` is already in its appearance.

**What genuinely remains Gather-specific?** Two facts: which resource carries
the composition, and retention. Plus an optional output-name escape hatch. All
three fit existing XForm extension points — the type-style inline reference and
appearance tokens — with no parallel binding language.

**Can the normal case be group + marker + attachment, with no manifest?** Yes.
And with `retention` defaulted, the normal case is an ordinary XLSForm group
with one appearance token on it and nothing else.
