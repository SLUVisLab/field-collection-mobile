# B-standard: conventions for Gather-enhanced standard fields

**Date:** 2026-09-02
**Status:** conventions settled; verified against `@getodk/xforms-engine@1.0.3-gather.1`
**Scope:** the small set of authoring conventions a **standard** Gather-enhanced
field needs. Arbitrary composition results (`_result`, result schema, retention
× projection) are **B-custom** and deliberately out of scope.

`MultiImageCapture` needs **none** of B-custom: no `_result`, no result schema,
no composition artifact, no projection machinery, no Tool packaging.

## Why this split exists

Standard Gather-enhanced controls can remain **directly valid XLSForm** —
additive appearance metadata over ordinary structures, so other ODK clients see
a plain repeat containing an image question. Custom authored compositions need a
publish pipeline and a result contract. Only the first is required to make the
collection path concrete.

## 1. Recognition — appearance token on the repeat

Canonical expanded shape:

```xml
<group ref="/data/photos" appearance="gather-multi-image min=2 max=6">
  <label>Photos</label>
  <repeat nodeset="/data/photos">
    <upload ref="/data/photos/photo" mediatype="image/*"><label>Photo</label></upload>
  </repeat>
</group>
```

Gather sees `gather-multi-image` on the repeat-range node and substitutes
`MultiImageCapture`. Any other client renders an ordinary repeat of an image
question.

## 2. Cardinality — appearance parameters, not `jr:count`

`minItems` / `maxItems` are carried as `key=value` appearance tokens and passed
to the Component as configuration.

**Not** a controlled (`jr:count`) repeat: the interaction we want is `0..N`
instances the user adds and removes, which is naturally *uncontrolled*.
Exact-four is simply `min=4 max=4` from the Component's point of view. If
exact-count forms should later also carry conventional `jr:count` for non-Gather
clients, authoring tooling can generate that representation without the renderer
depending on it.

**One authoring source.** UI cardinality and any XForms validation must derive
from the same declaration, so `appearance` and a `constraint` can never
disagree. That is a tooling obligation, not a runtime one, and does not block
implementation.

### Verified behaviour

Driven headlessly through the real engine
([experiments/appearance-parameters/](../experiments/appearance-parameters/)):

| Placement | `appearances` on the repeat-range node |
| --- | --- |
| `<repeat appearance="gather-multi-image min=2 max=6">` | `["gather-multi-image","min=2","max=6"]` |
| `<group appearance="gather-multi-image min=1 max=3">` | `["gather-multi-image","min=1","max=3"]` |
| **both** (group `field-list gather-multi-image`, repeat `… min=2 max=6`) | `["field-list","gather-multi-image"]` — **the group wins; the repeat's tokens are dropped** |

So:

- **`key=value` tokens survive verbatim**, in source order — appearance
  parameters need no host or engine change.
- Custom tokens survive too (`gather-custom` came through alongside the standard
  `multiline`), so the engine does not filter to a known vocabulary.
- **Put the tokens on the `<group>`.** Either placement works alone, but the
  group wins when both carry appearances, which makes it the unambiguous slot.
  (Confirm which element pyxform's `begin_repeat` appearance column emits to
  before relying on the sugar path.)

### Trap worth knowing

Raw engine `node.appearances` is a **Set-like iterable with a null prototype**:
`constructor` is `undefined`, `.size` is falsy, and `JSON.stringify` yields `{}`.
It must be spread or `Array.from`-ed. This cost the spike two wrong conclusions
before it was spotted.

The WebView sidecar already normalizes it (`Array.from(appearances, String)`), so
the **mobile renderer receives a real `string[]`** — the trap only bites in
raw-engine contexts. The app renderer does not read `appearances` yet.

## 3. Runtime targets the canonical expanded form, not the sugar

The runtime contract is defined against the shape above — something a
knowledgeable author can write directly. A future friendly row:

```text
multi_image | photos | Photos | min=2 max=6
```

is **authoring sugar that compiles to that canonical representation**. This
postpones "where does XLSX expansion run" without postponing the collection
field.

> **Principle:** runtime features target canonical ordinary XLSForm/XForm
> structures. Gather-specific authoring sugar is a separate compilation concern.

That is what keeps Central boring.

## 4. Binding invariant — the repeat *is* the data model

`ImageAsset[]` is a Component **value view** over the repeat. Nothing serializes
an array into a hidden node.

```text
XForms                        adapter                 Component
/data/photos[1]/photo   ↕                       [ ImageAsset,
/data/photos[2]/photo   ↕   repeat<ImageAsset>     ImageAsset,
/data/photos[3]/photo   ↕                          ImageAsset ]
```

- **capture** → persist attachment → create repeat instance → set its image node
- **remove** → remove repeat instance → clean up the now-orphaned local media

The Component knows nothing of XPath or repeat APIs; the XForms control/adapter
owns both.

## Prerequisite already satisfied

The repeat-media identity spike is **done and fixed** — see
[repeat-media-identity-characterization.md](./repeat-media-identity-characterization.md).
It found references unique but **not stable**: deleting an item made the survivor
inherit the deleted item's row and file, because `instance_media` was keyed on
`binding_reference`. Fixed by migration 10 plus `imageFilenameForCapture`,
covered by unit tests, an Android device gate, and the M5.5 live regression on
both platforms.

So the concern that "positional references as persistent identity is an
A/storage problem" was real, was hit, and is closed. Reorder remains untested,
but position is no longer identity at all, which greatly reduces its risk.

## Roadmap position

```text
B-standard (this document)  →  A: collection binding  →  B-custom
  appearance recognition         repeat-range adapter      result schema
  appearance cardinality         add/remove instances      retention × projection
  canonical-form target          attachment persistence    canonical _result
  repeat↔ImageAsset[] invariant  orphan cleanup            readonly projections
                                 cardinality UI            composition publishing
```
