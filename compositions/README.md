# First-party composition artifacts

Canonical Gather compositions, as **content**. Not a package, not app code, and
not something the mobile binary depends on.

```text
compositions/
  photo/authored-photo/authored_photo_v1.a2ui.json
  segment-and-measure/gather-image-segment-and-measure/segment_and_measure_v1.a2ui.json
  tally/quadrat/quadrat_tally_v1.a2ui.json
```

`gather.image.segment-and-measure` is the first **model-backed** artifact: it
calls `image_segment` with an explicit `ModelRef` and `measure_area` on the
resulting mask, entirely through `action.functionCall`, with no registered
handler anywhere. It is the subject of the M10 vertical-slice run
([docs/m10-acceptance-audit.md](../docs/m10-acceptance-audit.md)), and the
reason that run can exist at all — the runtime has been able to do this since
M9, and nothing had asked it to.

The dev-seeded `SEGMENT_AND_MEASURE_INSTRUMENT` in `gather-catalog` stays where
it is. It routes through registered app code and is the reference this artifact
was written against; what it can be replaced by is a question for after the
form-supplied path is proven on hardware, not before.

Categories are directories, so a catalogue with many subcategories is just
nesting.

## Why this is not under `packages/`

`packages/` is the mobile app's dependency space. An artifact there is a
standing invitation to `import` one into the app — which is exactly the
composition registry that was deleted, and which the architecture now
forbids:

> **Forms execute the exact composition artifact they were authored against.**

A composition's distribution channel is a **form attachment via Central**. The
app receives one with a form and never imports one. That was proved on
hardware: a composition unknown to the installed binary rendered, executed and
committed with zero registry entry
([composition-binding-reassessment.md](../docs/reference/architecture/composition-binding-reassessment.md)).

Directory layout is the cheapest way to keep that true.

## What makes a first-party tool special is the authoring UX, not the runtime

```text
Composer / XLSForm tooling
  [ Quadrat Tally      ▾ ]
  [ Photo Measurement    ]
  [ Custom...            ]
        ↓
inserts and validates the backing XForm group + typed children
attaches the canonical artifact as a form resource
publishes form + resource
```

To the researcher it feels built in. To the runtime it is the same
form-supplied artifact path as anything an author writes themselves. There is
no `type = gather_quadrat_tally` and no built-in implementation the binary
resolves.

If distribution is later optimized by shipping a matching artifact inside the
binary, that is a **cache / resource-resolution optimization only**: the form
still identifies the exact artifact and version it expects, and a mismatch
resolves in the form's favour.

## Consuming these

Tests and gates load these files rather than restating them, so the composition
under test is the composition that ships:

```js
// Node (tests)
import definition from '.../quadrat_tally_v1.a2ui.json' with { type: 'json' };

// Metro (gates, the app shell)
const definition = require('.../authored_photo_v1.a2ui.json');
```

A parallel copy in a fixture is what made "the artifact under test" and "the
artifact that publishes" two different things, so a new first-party tool belongs
here first and is referenced from everywhere else.

## What does *not* belong here

- **Test fixtures.** `test/fixtures/photo-capture/` exercises the A2UI runtime
  and is not a shipped tool. Scaffolding a harness drives — view ids, action
  names, form XML — stays with the test.
- **Handlers.** Quadrat Tally still ships a registered action handler; that is
  app code and lives in `src/`. Keeping it physically apart means an artifact
  never sits next to its implementation, and the handler tail should shrink
  toward zero as authored behaviour replaces bespoke code.


## Choosing a model, in three forms

A model-backed Capability takes an optional `modelRef`, and the three ways to
write it mean three different things. An authoring tool must not flatten them.

```text
omitted                    Gather's default policy chooses
literal ModelRef           this exact model, fixed
{ "path": "/some/state" }  the Tool chooses, from its own data model
```

**The convention for new Tools:** use a literal when the model is fixed, omit it
when Gather should decide, and bind it only when selection is genuinely stateful
or dynamic.

`gather.image.segment-and-measure` v1 binds — it holds its ModelRef at
`/working/modelRef` and references it from the call. That predates this
convention rather than violating any runtime contract, and it stays exactly as
it is: it is the artifact proved on hardware in M10, and it is the regression
subject that stops us assuming every model choice is a literal sitting in a
FunctionCall. If it should change, that is a **new revision**, never a mutation
of v1 under its feet.

`inspectComposition` reports the form, and for a bound call says whether the document
fixes one value behind the binding (`static`) or cannot (`dynamic`).
`setModelSelection` changes the value while preserving the form, and refuses a
dynamic binding rather than guessing — see
[docs/reference/architecture/tool-analysis.md](../docs/reference/architecture/tool-analysis.md).
