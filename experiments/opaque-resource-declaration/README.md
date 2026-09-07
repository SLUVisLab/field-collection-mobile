# Declaring an opaque form resource without lying to XForms

**Question.** How does an XForm tell Central that `flower_v1.gather` is one of
its attachments, without giving the file false XForms semantics, polluting
submissions, or forcing the bundle to become CSV/XML?

This is problem **B** (distribution), deliberately kept from dictating problem
**A** (what a Gather composition artifact *is*).

## Result — observed against a live Central (v2026.2.4, 2026-09-04)

| route | Central slot | type | engine fetches? | submission |
| --- | --- | --- | --- | --- |
| inline secondary instance node text | **NO** | — | no | clean |
| primary instance node default `jr://images/…` | yes | `image` | no | **polluted** |
| external secondary `src="jr://file/…"` | yes | `file` | **yes — refuses opaque JSON** | clean |
| **itext `<value form="image">jr://images/…`** | **yes** | `image` | **no** | **clean** |

**The itext route is the answer.** It is the only declaration that gets a
Central slot without either polluting submissions or being fetched and parsed by
the engine.

`gather_resources` is a `relevant="false()"` node whose *label* carries the
media reference. It is never rendered, the engine never resolves label media
(that is a renderer's job, and ours does not render it), and a non-relevant node
is omitted from the submission entirely — all three verified.

The residual dishonesty is one word: Central's scanner only matches
`jr://images/` in that position, so the bundle is announced as an image.
Nothing in the form treats it as one.

## What Central actually scans

`central-backend lib/data/schema.js`, `expectedFormAttachments`. Four regexes:

```text
^jr:\/\/(?:images|audio|video|file|file-csv)\/([^/]+)$   ← instance @src, itext values
^\s|\s$                                                  ← basename whitespace guard
^jr:\/\/images\/.*                                       ← instance node DEFAULT text
^\s*(?:\w*\s+)?search\s*\(\s*("|')(.+)\)\s*$             ← select search() appearance
```

**Corrected 2026-09-04 by the live run.** The source read said the default-value
traversal visits every `<instance>` element. It does not — an inline secondary
instance's node text is not scanned, which is why the first gate attempt got
`[]` back. Reading the source was not a substitute for asking the server, and
this is the second time that has been true in this file.

What the live instance actually honours is the table above. The `jr://images/`
restriction on non-`<instance src>` positions did hold.

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

## Device-side sync — proved 2026-09-04

`gates/CentralSyncGateApp.js` provisions against the live Central project with
an App User token, refreshes, and then mounts the shipped `App` unmodified, so
everything after the sync is the real shell and the real `FormRunner`.

```text
repo   compositions/photo/authored-photo/authored_photo_v1.a2ui.json
   ↓   uploaded to the itext-declared slot
Central flower_v1.gather   md5:3ecc247610df776b7480e78ad3ac2c4e
   ↓   refreshForms, ordinary form-resource path
device cached payload, 3347 bytes, sha256:bc35dc46e937d2ff…  IDENTICAL
   ↓   FormRunner → compositionBinding
XForm  <data id="gather_packaging_gate" version="gate-6a1366">
         <site_name/><photo><note>authored</note>
         <image>image-mtngn8m1h5v6ka.jpg</image></photo><meta>…</meta></data>
```

Receipts for `/data/photo/note` and `/data/photo/image` under
`authored_photo_v1` rev `1.0.0`; `instance_media` holds the submission
attachment; the working asset was released and swept; and **`gather_resources`
appears nowhere in the submission**.

The composition rendered as "Authored photo" with a live camera — from an
opaque attachment the installed binary had never seen, with no registry entry
and no binding manifest.

### Two defects it found

- **A broken import from the `scientific/` rename.**
  `segmentAndMeasureComponents.js` pointed at `../../mobile/SegmentAndMeasureViews.js`;
  no test imports that module, so only a bundle caught it.
- **The composition loader could not read a cached resource.** Central serves
  the attachment `application/octet-stream`, so the catalog caches it as bytes;
  the loader required `.text` and reported "present but empty". It now decodes
  base64 too — which is what makes the artifact's *name* free of the
  transport's opinion about it.

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
