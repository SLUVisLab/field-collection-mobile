# First-party composition artifacts

Canonical Gather compositions, as **content**. Not a package, not app code, and
not something the mobile binary depends on.

```text
compositions/
  photo/authored-photo/authored_photo_v1.a2ui.json
  tally/quadrat/quadrat_tally_v1.a2ui.json
```

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
