# Declaring an opaque form resource without lying to XForms

**Question.** How does an XForm tell Central that `flower_v1.gather` is one of
its attachments, without giving the file false XForms semantics, polluting
submissions, or forcing the bundle to become CSV/XML?

This is problem **B** (distribution), deliberately kept from dictating problem
**A** (what a Gather composition artifact *is*).

## Result

| route | Central slot | engine parses the bytes | submission pollution | false semantics |
| --- | --- | --- | --- | --- |
| `<instance src="jr://file/x.gather"/>` | yes, type `file` | **yes — refuses opaque JSON** | none | claims to be a loadable instance |
| binary node default `jr://images/x.gather` | only via the `images/` filter | no | **yes — in every submission** | claims to be an image, *and* is form data |
| **inline secondary instance node text** | only via the `images/` filter | **no** | **none** | the `images/` scheme prefix, nothing else |
| itext `<value form="image">` | yes | no | none | claims to be a label image; may render |

The third row is the only ODK-native route that survives every rejection
criterion except the scheme prefix.

## What Central actually scans

`central-backend lib/data/schema.js`, `expectedFormAttachments`. Four regexes:

```text
^jr:\/\/(?:images|audio|video|file|file-csv)\/([^/]+)$   ← instance @src, itext values
^\s|\s$                                                  ← basename whitespace guard
^jr:\/\/images\/.*                                       ← instance node DEFAULT text
^\s*(?:\w*\s+)?search\s*\(\s*("|')(.+)\)\s*$             ← select search() appearance
```

Two things follow, and the second is the awkward one:

- The default-value traversal visits **every `<instance>` element**, not just the
  primary one, and applies no bind-type filter. Central's own comment concedes
  the breadth: *"only binary-bound instance nodes … will do anything with a
  default media file value, but we're cheating for now."*
- That traversal matches **`jr://images/` only**. `jr://file/` is accepted for
  `<instance src>` and itext, but *not* for instance defaults. So any
  default-value route has to call the bundle an image.

Read from source, **not observed against a running Central.** That is the one
thing still needing a real draft.

## Run 1 — binary node default

```xml
<gather_composition_bundle>jr://images/flower_v1.gather</gather_composition_bundle>
<bind nodeset="/data/gather_composition_bundle" type="binary" readonly="true()"/>
```

The engine never fetches it (a default is just a value), and it surfaces as
`model-value` with no body control — so no ODK client renders it. But:

```text
fresh instance XML:
  <data id="binary_default"><site_name/>
    <gather_composition_bundle>jr://images/flower_v1.gather</gather_composition_bundle>
    <meta>…</meta></data>

after answering site_name:   (unchanged in the same position)
attachments in payload:      []
```

**It is in every submission.** A resource-distribution detail becomes a
permanent fake answer in the collected data. Rejected on the stated criterion.

## Run 2 — inline secondary instance

```xml
<instance id="gather_resources">
  <root><item><name>composition</name><uri>jr://images/flower_v1.gather</uri></item></root>
</instance>
```

```text
load status                : success
fetchFormAttachment called : []        ← inline, so nothing to resolve
primary-instance nodes     : /data/site_name only
fresh instance XML         : <data id="inline_secondary"><site_name/><meta>…</meta></data>
after answering site_name  : <data …><site_name>North ridge</site_name><meta>…</meta></data>
attachments in payload     : []
```

Clean on every axis the binary default failed:

- **No submission pollution at all** — the primary instance is untouched.
- **The engine never fetches or parses it**, because an inline instance has no
  `src`. This is the difference from the external secondary instance, which the
  engine resolves eagerly and then refuses to interpret as a format.
- **No false loading semantics.** An inline secondary instance genuinely *is*
  static model data. It is not claiming to be a resource the engine should load.
- Unused inline secondary instances are ordinary XForms; another conforming
  client ignores this one.

The residual dishonesty is confined to a **URI scheme prefix**: the bundle has
to be announced as `jr://images/flower_v1.gather` for Central's default-value
filter to see it. Nothing about the artifact's format, the form's behaviour, or
the submission changes.

## Where that leaves the decision

Two candidates, and it is a judgement call rather than a technical one:

1. **Inline secondary instance with an `images/` prefix.** Costs one misleading
   scheme on one URI. Buys a fully ODK-native declaration, zero submission
   impact, and no constraint on the `.gather` format.
2. **A narrow Gather publishing convention**, outside the XForm entirely. Costs
   a Gather-specific step in publishing. Buys total honesty.

What is *not* on the table, per review: disguising the bundle as CSV/XML so an
external secondary instance will parse it, and patching the engine to ignore
opaque unreferenced instances.

## The Central gate

`central-gate-form.xml` is the form to upload. **No XLSForm and no pyxform** —
Central accepts an XForm definition directly, and the gate's question is about
the XForm, not about spreadsheet conversion. (Whether pyxform passes the
namespace and `body::gather:composition` through is a separate, later question.)

It loads cleanly in the engine, and the primary instance is untouched by the
`gather_resources` declaration:

```text
primary-instance nodes:
  input   /data/site_name        body-backed=true
  group   /data/photo            body-backed=true
  input   /data/photo/note       body-backed=true
  upload  /data/photo/image      body-backed=true

fresh instance XML:
  <data id="gather_packaging_gate" version="1"><site_name/>
    <photo><note/><image/></photo><meta>…</meta></data>
attachments in payload: []
```

### What to check, in order

```text
1  create a draft from central-gate-form.xml
      → does the draft list flower_v1.gather as an EXPECTED attachment?
         if no, the shim fails and the answer is a Gather publishing convention

2  upload the opaque bundle to that slot
      → does Central accept bytes it cannot interpret?

3  download it back through the normal form-resource API
      → checksum before upload == checksum after download
         the whole point is that .gather stays opaque
      → what Content-Type does Central serve?

4  sync the form version into Gather
      → does the resource arrive through the ordinary form-resource path?
      → NOTE: formCatalogService's isTextResource decides text vs binary from
        the served content type. A bundle served as application/octet-stream
        must still reach the composition loader.

```

Steps 1–4 are the whole gate. There is no step 5: that an inline secondary
declaration stays out of the primary instance, stays out of the submission XML,
and is never fetched or parsed by the engine is **already proven locally**
(Run 2 above), so re-running a collection lifecycle would answer a question that
is not open.

Step 1 is the architectural answer. Steps 2–4 are where Central has historically
been quirkiest, around MIME metadata for uncommon extensions — hence the
checksum.

If step 1 fails, **the binding architecture is unaffected** — the remaining
problem is only how to declare one opaque form attachment to Central.

## Running it

```bash
mkdir -p /tmp/ns-spike && cd /tmp/ns-spike
npm init -y >/dev/null && npm install slimdom

REPO=/path/to/this/repo
NS=/tmp/ns-spike/node_modules
for f in binary-default inline-secondary; do
  echo "### $f"
  REPO="$REPO" FIXTURE="$REPO/experiments/opaque-resource-declaration/$f.xml" \
  NODE_PATH="$NS" node "$REPO/experiments/opaque-resource-declaration/probe.mjs"
done
```
