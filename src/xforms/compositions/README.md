# Composition ↔ XForms integration

Everything here answers one question: **how does Gather extend an ODK form?**
That is Gather product behaviour, so it lives in the app, not in a package.

```text
recognition.js                 is this group a composition field, and which one?
manifest.js                    where its outputs go (the form binding manifest)
commit.js                      the Accept path: validate → commit → provenance
XFormsCompositionControl.js    mounting, and reporting what the researcher needs
handlers/registry.js           which compositions this build can actually run
```

## Why none of this belongs in `odk-xforms-*`

Those packages know ODK and XForms — `input`, `select`, `repeat`, `group`,
`upload`, and generic extension seams. They must not learn
`gather-composition`, binding manifests, Gather receipts, retention and
disposition, the handler registry, or asset ledgers. Otherwise a nominally
reusable ODK package quietly becomes Gather core with a generic name.

### The test for any candidate move

> Could this module make sense in another application that uses the package but
> does not know what Gather is?

| Candidate | `odk-xforms-react` | `gather-catalog` | `gather-storage` |
| --- | --- | --- | --- |
| generic renderer adapter | yes | — | — |
| generic custom-control registration seam | maybe | — | — |
| `gather-composition` appearance handling | **no** | no | no |
| binding manifest **schema + validator** | no | **probably** | no |
| composition result declaration | no | **probably** | no |
| runtime XPath mutation | no | **no** | no |
| receipt semantics / persistence | **no** | no | not yet |
| asset disposition + sweep | **no** | no | potentially |

The one plausible near-term package move is the **portable** part of the
manifest: its schema and validator, if Composer, a form publisher, the mobile
runtime and tests all end up consuming the same declaration. That is a
`gather-catalog` shape — the authored composition contract. The runtime halves
(loading an attachment, binding XPaths, writing nodes, persisting receipts,
sweeping files) stay here regardless.

The receipt store and the asset ledger live in `gather-storage` because that is
*Gather's* storage layer, and their semantics are still composition-specific.
If camera capture, `MultiImageCapture`, composition results and drafts all
converge on one generic media-ownership mechanism, that may earn a generic home.
**Let the reuse appear first.**

## Execution model, stated honestly

> Composition **structure** is portable form data. Composition **behaviour** is
> currently registered application code. This is intentional for now; portable
> declarative behaviour is deferred until multiple real compositions reveal the
> smallest useful model.

`handlers/registry.js` is empty in the shipped app, and that is healthy: nothing
has been hardwired into a supposedly generic runtime merely to make the registry
look useful. A form may declare a composition this build cannot run, and the
control says so explicitly.

See §6 of [docs/b-custom-composition-conventions.md](../../../docs/b-custom-composition-conventions.md)
for the deferral and its tripwire.
