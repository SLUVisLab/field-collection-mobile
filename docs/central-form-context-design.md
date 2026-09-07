# Central form context — what the wrapper may know about a form

**Status: design, nothing built.** Filed at the root of `docs/` per
[docs/README.md](./README.md); it moves to `reference/` when it lands.

One question, the last architectural one in the vertical slice now that
`.gather` is proven:

> How does the web wrapper obtain enough authoritative ODK form structure to
> show a researcher exactly where this Tool's outputs will go, **without
> turning the Composer into an ODK application**?

## The rule that decides every case below

```text
the wrapper reads declarations         appearance, gather:composition, bind type
the wrapper never evaluates expressions  relevant, constraint, required XPath
```

Reading `appearance="gather-composition"` is reading something an author wrote
down. Evaluating `relevant="/data/count > 3"` requires instance state that does
not exist until someone fills the form in. Gather already owns an XForms engine
(`@getodk/xforms-engine`) and it runs in the app, where that state lives.

Stated as a product rule:

> **Review shows placement. It never predicts behaviour.**

A Composer that renders a *probably required* badge has begun becoming an ODK
application, and will be wrong the first time a `relevant` expression matters.

## What the wrapper actually has to answer

The context seam is already defined —
`openfieldworks-web/apps/wrapper/src/authoringContext.js` — and it is three
methods, not one:

```text
listProjects()                        → { id, name }
listForms(projectId)                  → { id, name, version }
listCompositionFields(project, form)  → { reference, resource }
```

The third is the interesting one. A composition field is an XForm **group**
carrying `appearance="gather-composition"` and `gather:composition="x.gather"`
— see
[conventions §1a](./reference/conventions/b-custom-composition-conventions.md).
Central publishes no projection of appearances or of Gather's namespace, so
this cannot come from a schema endpoint.

## Two sources, and neither one is sufficient alone

This is the finding that shapes the design.

### `GET /v1/projects/:id/forms/:fid/fields`

Central's own parse of the XForm, as a flat typed list:

```text
[ { name, path, type, binary }, ... ]
```

Authoritative for **types** — Central resolved the binds, so `decimal` is
`decimal` — and `binary: true` is exactly the signal `projectionFor()` uses to
decide an output is media rather than a value. It gives `name` directly, which
matters because composition binding matches **by node name, not by path**
(`compositionBinding.js:278,298`; `/data/flower/area` → `area`).

What it does not carry: `appearance`, `gather:composition`, the
`bind::gather:output` name override, `required`, labels, or whether a node has
a body control at all. That last one is not a detail — `/fields` lists
calculates alongside questions, and binding only considers **body-backed**
children (`compositionBinding.js:169`).

### `GET /v1/projects/:id/forms/:fid.xml`

The form definition. Read for exactly three things and nothing else:

```text
<group ref appearance="gather-composition[:id]"
       gather:composition="x.gather">              which groups are slots, and
                                                   which artifact fills each
<bind nodeset gather:output="name">                the name override
body controls under a slot                         which children are bindable
```

Corrected while building: `gather:composition` rides the **body group**, beside
the appearance it belongs with — not a bind. `gather:output` does ride a bind.

`DOMParser` and a walk. No XPath evaluation, no engine, no instance state.

**The recognition rules are not reimplemented here.** Gather already encodes
them — the two meanings of the appearance token, the inert trailing colon —
in `src/xforms/compositions/recognition.js`. That code is portable JavaScript
and the web repo should consume it, for the same reason the renderer consumes
`componentApis.js` and the model executor rather than keeping copies. Every
previous duplicate of a Gather semantic in the web tree drifted.

## What Review can then show

Because both sources are available, Review does not have to *approximate*
readiness. `bindCompositionOutputs({ field, definition })` is the real device
binding, and it already produces exactly the diagnostics Review wants:

```text
GATHER_COMPOSITION_OUTPUT_UNBOUND        the Tool produces a value with nowhere to go
GATHER_COMPOSITION_OUTPUT_TYPE_MISMATCH  decimal into an int, say
GATHER_COMPOSITION_NO_BINDABLE_CHILDREN  a slot with nothing under it
```

So the design goal is not "a readiness checker for the web" — it is **feed the
existing binder from Central data**. Constructing its `candidates` from
`/fields` (paths, names, types, `binary`) plus the XML (body-backed, overrides)
means Review reports what the device will actually do, in the device's own
words.

For the canonical Tool against the real M10 acceptance form, measured through
`gate:central-context`:

```text
Tool output      form field                     note
image            /data/specimen/image           media projection
area             /data/specimen/area
area_unit        /data/specimen/area_unit
model_id         /data/specimen/model_id
model_revision   /data/specimen/model_revision
```

All five bind. An earlier draft of this document showed `model_revision`
unbound against an invented form; the real one carries every output, which is
why it passed acceptance. Removing that question from the form does produce
`GATHER_COMPOSITION_OUTPUT_UNBOUND`, and that case is a unit test rather than a
claim about the acceptance form.

**Typed outputs — closed 2026-09-06.** A draft used to be a message list, so
`inspectComposition` read names off the completion call and no types existed to
check. Two things fixed it, and neither invented a vocabulary:

- **A2UI v0.9 has no result schema.** Its entire server-to-client vocabulary is
  `createSurface`, `updateComponents`, `updateDataModel` and `deleteSurface`,
  all `.strict()`. So there was nothing upstream to adopt — and nothing to
  invent either, because Gather's `result` block already *is* the contract
  `bindCompositionOutputs` consumes, and the canonical Tool has declared typed
  outputs since M10.
- **`messages` had been mistaken for the composition**, in the Library draft and
  in `.gather` packaging. Both now carry the whole object.

Types deliberately do **not** ride in the completion call's `outputs` argument:
there a value is a data-model *binding* while the document is authored, and the
*resolved value* by the time the function runs. One field cannot carry both
plus a type without the meanings colliding.

Review now renders `area:decimal → /data/specimen/area:decimal` and blocks a
real mismatch. A Tool that declares no contract still says so — an undeclared
output binds to a question of any type, and calling that "compatible" would be
inventing a pass.

Two things Review must state rather than compute:

- **`required` is an OR of two contracts** (`compositionBinding.js:333`): the
  producer's declaration, which is knowable, and the form's XPath `required`,
  which is evaluated live. Review can show the first and must name the second
  as runtime.
- **Extra form fields are fine.** Binding iterates the Tool's outputs, never
  the group's children, precisely so that hand-filled questions are not cleared
  on Accept. An unfilled sibling is not a warning.

## Measured constraint: the browser cannot call Central directly

```text
OPTIONS /v1/projects  (Origin: composer.openfieldworks.com) → 404, no CORS headers
GET     /v1/projects  (Origin: composer.openfieldworks.com) → 401, vary: Origin,
                                                               no Access-Control-Allow-Origin
```

Probed against the live instance, 2026-09-06. Upstream's API documentation says
nothing about CORS. Building on cross-origin browser access to Central would be
building on something neither documented nor observed.

### The edge we already run removes the problem

Caddy fronts both hostnames on one shared network. Routing Central's API under
the wrapper's **own origin** eliminates CORS entirely and adds no service:

```text
{$COMPOSER_HOST} {
        handle_path /central-api/* { reverse_proxy central:80 }
        handle                     { reverse_proxy wrapper:8080 }
}
```

Deployment configuration, not an application. Central stays stock and
independently deployed.

### Authentication

```text
POST /central-api/v1/sessions  { email, password } → { token, expiresAt }
then: Authorization: Bearer <token>
```

Same-origin, so the token lives in the wrapper's origin and no Gather server
handles a credential. Central's session cookie is documented as frontend-only
and GET-only, so it is not the mechanism.

`packages/odk-central-client` already implements `createSessionAuth` and most of
this endpoint map, but it is Node/React-Native oriented and its consumers all
use App User auth. Whether the wrapper imports it or uses `fetch` against four
endpoints is an implementation choice, not an architectural one — the four
endpoints are the contract.

## The write boundary, decided before anything writes

**Gather Composer must never call `POST .../draft/publish`.**

That endpoint makes the draft the live form definition. Calling it would mean a
Composer action silently changed what enumerators in the field receive on their
next sync — a study-affecting act, taken by an authoring tool, on behalf of
someone who asked to attach a file.

The workflow is therefore split, and the split is the product decision:

```text
Gather Composer                          ODK Central
──────────────                           ───────────
build .gather
download it                    →         researcher attaches it by hand

later:
build .gather
stage onto the form's DRAFT    →         researcher reviews, tests in Enketo,
stop                                     and publishes the draft themselves
```

The later action is **"Stage to form draft"**, never "Publish form". It ends at
`POST .../draft/attachments/:name` and goes no further. Naming matters here: a
button labelled *Publish* invites exactly the click that the boundary exists to
prevent.

### Built 2026-09-06, and asserted

Publish stages and stops. `centralClient.js` has no publish operation to call,
and the gate proves the negative rather than trusting it:

```text
✓ staging uploads under the name the form's group declares
    .../draft/attachments/segment_and_measure_v1.gather   4,621,033 bytes
✓ nothing ever called draft/publish
✓ a form with no open draft blocks staging
✓ no draft was created behind the scenes
```

A form with no draft says *"Create or edit the form draft in ODK Central before
staging this Tool."* and offers no button. Creating one is a form-state change
and will be an explicit operation if it is ever added, not something done
quietly to make an attachment succeed.

The attachment filename is not the Composer's to choose: the form's group
already declares the resource it expects (`gather:composition`), and staging
under any other name attaches a file nothing looks for.

Two consequences worth stating now, because they shape the Publish panel:

- **Staging is a form change, not a file upload.** Central's draft/publish
  lifecycle means the researcher must take a second, deliberate step in Central
  before anything reaches a device. The UI should say so rather than implying
  the attachment is live.
- **A form with no open draft needs one created first.** That is a Central
  state change too, and belongs to the same decision rather than being done
  quietly to make an attachment succeed.

## Read-only, deliberately

Nothing here writes. Staging a `.gather` would be
`POST .../draft/attachments/:name` and would stop there — the publish half of
that lifecycle stays with the researcher, in Central, per the write boundary
above. (`experiments/m10-vertical-slice/provision.mjs` is the only code that has
ever driven the whole sequence, and it is a provisioning script, not a product
path.) Either way it is the last step of the slice, not part of obtaining
context: a read-only context layer can be wrong without damaging anything.

## Not in scope

- Any XForms *evaluation* — `relevant`, `constraint`, `required` expressions.
- Running `@getodk/xforms-engine` in the browser.
- Form labels and itext.
- Writes of any kind, including attachment upload.
- `POST .../draft/publish`, now and later. See the write boundary above.
- Central project or user administration.
- Reimplementing recognition or binding rules in the web repo.
