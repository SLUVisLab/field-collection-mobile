# Tool analysis

One read model over an ordinary authored A2UI document, so that Models,
Validate and Publish give the same answer to *what has the researcher actually
built?*

```text
A2UI document → inspectComposition() → capabilities, model calls, outputs, issues
                                       ↓
                              Models · Validate · Publish
```

Not a Tool AST, not a DSL, not a second Capability registry. The A2UI document
remains authoritative, nothing is persisted, and **no identifier is minted
inside the artifact** — a call is addressed by where it is in the document, so a
Tool that has never been near the wrapper analyzes identically.

Capability semantics arrive as **data**: `apps/renderer/public/capabilities.json`,
projected from `CAPABILITY_DEFINITIONS` at build time beside `models.json`.

## The three authoring forms

```text
modelRef omitted           mode: default    Gather's policy chooses
modelRef literal           mode: explicit   this exact model, fixed
modelRef { path: … }       mode: bound      the Tool chooses, from its state
```

`bound` is genuinely different from `explicit`. It may resolve today to one
model, but the author expressed *indirection* — plausibly because the value can
change. Collapsing it into `explicit` would make a model picker silently alter
what a Tool is capable of.

## Resolving a binding, and only as far as is safe

For a bound call, `resolveBinding` answers one narrow question: **does exactly
one authored `updateDataModel` write this path, with nothing able to overwrite
it?**

```text
static     one authored ModelRef, no action writes the path at run time
dynamic    anything else — several writers, none, or a resultPath targeting it
```

It is deliberately **not** a dataflow evaluator. Everything it cannot establish
is `dynamic`, and `dynamic` means the wrapper reports rather than rewrites.
Building a general A2UI evaluator to do better would be a much larger thing than
the problem deserves.

## Selection syntax is not dependency certainty

Packaging needs a different question answered, and conflating them would let a
`.gather` claim a dependency a Tool can change at run time:

| authoring form | dependency certainty |
| --- | --- |
| `default` | `unresolved` — publication policy decides |
| `explicit` | `exact` |
| `bound` + static | `exact`, indirectly authored |
| `bound` + dynamic | `indeterminate` — cannot be frozen |

A statically resolved binding is an exact *current* dependency while remaining
`mode: 'bound'`. Both facts are true and packaging needs both.

## Separately addressable is not separately selectable

Two bound calls can name the same path:

```text
image_segment #1  →  modelRef: { path: "/working/modelRef" }
image_segment #2  →  modelRef: { path: "/working/modelRef" }
```

They are distinct occurrences, but they have **one model between them**. The
author coupled them deliberately, and a panel offering a per-call picker over
that would promise an independence the document does not have — changing one
silently changes the other.

`inspectComposition` reports `model.sharedWith` (the other occurrences on the same
path), and `setModelSelection` refuses a shared change unless the caller passes
`acknowledgeShared`, naming every occurrence in `affected` so a UI can say what
is about to happen rather than discovering it afterwards.

Only exact path equality counts. An ancestor/descendant relationship could alias
too, but inferring that reliably becomes the dataflow evaluator this
deliberately is not — and `resolveBinding` already calls such a path `dynamic`
when more than one message writes it.

## Changing a selection preserves the form

`setModelSelection` writes the new model without changing how the Tool expresses
the choice:

- **literal** — replace the argument, or delete it to return to the default;
- **bound + static** — write the value behind the binding, leaving
  `{"modelRef": {"path": …}}` untouched;
- **bound + dynamic** — refuse, with `GATHER_SELECTION_BINDING_NOT_STATIC`;
- **bound + "use the default"** — refuse: deciding what the binding should hold
  instead is an authoring change, not a model choice;
- **shared binding** — refuse without `acknowledgeShared`, and report every
  affected occurrence.

Every result carries `affected`, so a caller always knows how many calls moved —
one for a literal, and possibly several for a binding.

Compatibility is checked before anything is written, so a Tool never briefly
holds an incompatible model in a state somebody could save. The document is
cloned, never mutated.

## Why the canonical Tool stays bound

`gather.image.segment-and-measure` v1 binds its model. That predates the
convention in [compositions/README.md](../../../compositions/README.md) rather
than violating a runtime contract, and it is the artifact proved on hardware in
M10. It stays as it is — as the regression subject that stops us assuming every
model choice is a literal sitting in a FunctionCall. A change would be a new
revision, not a mutation of v1.


## The renderer's authoring surface is a versioned contract

The renderer serves Gather's authoring analysis to the wrapper, which deploys
independently — so a newer wrapper can meet an older renderer.

```text
/authoring/manifest.json    apiVersion, rendererRevision, catalogRevision, exports
/authoring/*.js             inspectComposition, setModelSelection, compatibilityFor, previewEvidence
/models.json                the Model Catalog projection
/capabilities.json          the Capability projection
```

The wrapper checks `apiVersion` **before importing anything** and refuses on a
mismatch, because skew that degraded quietly would show an author a
plausible-looking panel built on the wrong contract. `catalogRevision` digests
the two projections, so a catalog change is detectable even when the API has
not moved.

Bump `AUTHORING_API_VERSION` when an export's *contract* changes — a removed
function, a renamed field a caller reads, a changed meaning. Adding a field
callers may ignore does not need one.

CORS stays scoped to `RENDERER_AUTHORING_ORIGIN` rather than open, for the same
reason `frame-ancestors` is.

## Preview evidence is session-only, and precisely keyed

A Model Lab run is a fact about one execution, not durable truth about a Tool.
Nothing about it reaches the A2UI document, the draft, the Library or a future
`.gather`.

```text
capabilityId + ModelRef revision + sample digest + backend id@version
```

The backend is in the key because an ORT-Web upgrade can change what a model
does, and evidence that outlived the backend that produced it would be quietly
wrong. Preprocessing and postprocessing are **not** separate components of the
key — the ModelPackage revision already commits them, and repeating them would
invite the two to disagree.

### Previewing a default selection

A `default` call is still runnable. `previewSubjectFor` resolves the
distribution's current default and the Lab executes **that exact revision**, so
evidence names a model rather than the word "default":

```text
Tool selection     Gather default
Preview executed   U²-Net salient segmentation  sha256:…
```

Running it does not make the Tool explicit and does not change its dependency
certainty, which stays `unresolved` until publication freezes it. The default
comes from the Model Catalog's own `defaultFor`, so the wrapper never grows a
second default policy.
