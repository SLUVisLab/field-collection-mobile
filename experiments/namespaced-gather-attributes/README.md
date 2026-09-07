# Namespaced Gather attributes, and the composition resource slot

Two spikes the binding reassessment could otherwise only infer.

## 1. Does `@getodk/xforms-engine` expose namespaced body/bind attributes?

**Yes — all three, through the live definition objects.**

Fixture: a `<group>` carrying `gather:composition`, an `<upload>` whose bind
carries `gather:retention`, and an `<input>` whose bind carries `gather:output`,
with `xmlns:gather="http://gather.slu.edu/xforms"` on `<h:html>`.

```text
node                 reference                          parent                type/media    req    body:composition             bind:retention  bind:output
input                /data/site_name                    /data                 string        false  null                         null            null
group                /data/flower_analysis              /data                 -             false  jr://file/flower_v1.gather   null            null
upload               /data/flower_analysis/image        /data/flower_analysis binary/image  false  null                         keep            null
input                /data/flower_analysis/area         /data/flower_analysis decimal       false  null                         null            null
input                /data/flower_analysis/petal_count  /data/flower_analysis int           true   null                         null            petalCount
model-value          /data/flower_analysis/hidden_note  /data/flower_analysis string        false  <no getAttributeNS>          null            null
```

The access paths:

```js
node.definition.bodyElement.element.getAttributeNS(GATHER_NS, 'composition')
node.definition.bind.bindElement.getAttributeNS(GATHER_NS, 'retention')
```

The second is not a new technique — it is exactly how this repo's own
`packages/odk-xforms-engine/dist/entity-effects.js` reads `entities:saveto`.

Confirmed at the same time: `required="true()"` arrives **evaluated**
(`petal_count` → `true`), `<upload mediatype="image/*">` arrives as
`nodeType: 'upload'` / `valueType: 'binary'` / `mediaType: 'image'`, and the
group's children arrive with `parentReference` pointing at it.

### The finding that changes the design

`/data/flower_analysis/hidden_note` has a bind but **no body control**, and it
still appears as a child of the group — as `nodeType: 'model-value'`, with no
`bodyElement` at all.

So "the group's typed children are the only possible destinations" is not
automatic. Binding must filter to **body-backed** children explicitly. Without
that filter, name-based binding would happily write into a node no other ODK
client can see or fill, which is the exact failure the manifest was accused of
permitting.

### Consequence for our render model

The engine exposes these; **our render model does not yet**. `definition` is a
live object graph and cannot cross the WebView RPC seam, so
`buildRenderModel` in `packages/odk-xforms-webview/src/createWebViewSidecarHtml.js`
has to read the namespaced attributes *inside* the WebView and project them as
plain strings, the way it already projects `appearances` and `mediaType`. That
is a small addition to an existing loop, and `getEntityEffects` establishes the
precedent of reading `definition` on that side of the boundary.

## 2. Can a composition resource ride an `<instance src="jr://file/…">`?

The question is Central's, not ours: Central determines a form's expected
attachments by scanning the XForm, and will not accept an attachment it did not
expect. Its scan (`lib/data/schema.js`, `expectedFormAttachments`) covers
`<instance src>`, itext `<value form="image|audio|video|big-image">`, instance
default values, `<input query>`, and select `search()` appearances — matching
`^jr://(?:images|audio|video|file|file-csv)/([^/]+)$`. It does **not** scan
arbitrary attributes.

So `body::gather:composition="jr://file/flower_v1.gather"` creates no attachment
slot, and `<instance src>` is the only sanctioned route that yields type `file`.

**The route works, but only for formats the engine can parse.** Three runs, same
fixture, one unreferenced secondary instance:

| resource content type | result |
| --- | --- |
| `application/json` | `Failed to determine external secondary instance format for resource "jr://file/flower_v1.a2ui.json", content type: "application/json"` |
| `text/xml` | past format determination; fails later only in slimdom (`Cannot set property innerHTML`), a harness limitation |
| `text/csv` | **loads cleanly**, instance created |

Two things follow:

- **Nothing needs to reference the instance.** An unreferenced secondary
  instance loads fine, so declaring one purely to claim Central's attachment
  slot is viable in principle.
- **The engine fetches it eagerly and must parse it.** The blocker is ours, not
  Central's — Central's regex would accept `flower_v1.a2ui.json` as a `file`
  attachment happily. It is the engine that refuses JSON.

Format is decided by the response **content type**, not the extension: the
`.a2ui.json` filename loaded successfully when served as `text/csv`.

### What remains open

Whether to deliver the composition artifact in a format the engine accepts, put
the reference somewhere else Central scans, or patch the engine to skip
unreferenced instances of unknown format. Deciding that needs a real Central
draft, which this spike cannot reach. Central's behaviour above is read from its
source, not observed.

## Running it

`slimdom` is deliberately not a repo dependency — install it locally:

```bash
mkdir -p /tmp/ns-spike && cd /tmp/ns-spike
npm init -y >/dev/null && npm install slimdom

REPO=/path/to/this/repo
NS=/tmp/ns-spike/node_modules

# 1 — namespaced attribute exposure
REPO="$REPO" FIXTURE="$REPO/experiments/namespaced-gather-attributes/composition.xml" \
NODE_PATH="$NS" node "$REPO/experiments/namespaced-gather-attributes/probe.mjs"

# 2 — secondary instance format (CONTENT_TYPE and BODY select the case)
REPO="$REPO" FIXTURE="$REPO/experiments/namespaced-gather-attributes/secondary-instance.xml" \
CONTENT_TYPE="application/json" BODY='{"id":"flower_v1","messages":[]}' \
NODE_PATH="$NS" node "$REPO/experiments/namespaced-gather-attributes/secondary-probe.mjs"
```

Same trap as the earlier spikes: raw `node.appearances` is a Set-like iterable
with a null prototype — spread it.
