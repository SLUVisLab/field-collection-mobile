# Repeat media identity characterization

**Date:** 2026-09-02
**Engine:** `@getodk/xforms-engine@1.0.3-gather.1` (driven headlessly in Node)
**Spike:** [experiments/repeat-media-identity/](../experiments/repeat-media-identity/)
**Status:** blocking finding — repeat-backed media must not ship on the current
identity model

**Question:** are repeat-bound media identities **unique** *and* **stable under
repeat mutation**?

**Answer:** unique yes, stable **no** — and the failure mode is a **silent wrong
attachment**, not a collision.

## Why it matters

Gather derives both the attachment filename and the media primary key from the
XForms binding reference:

```js
// src/instances/instanceLifecycleService.js
const filename = imageFilenameForReference({ reference: bindingReference, contentType: imageType });
```

```sql
-- packages/gather-storage/src/migrations (instance_media)
PRIMARY KEY (local_instance_id, binding_reference),
UNIQUE      (local_instance_id, filename)
```

So the durability of media identity depends entirely on the durability of the
reference. Inside a repeat, references are positional.

## Result

Run against a form with `repeat(/data/photos)` containing a binary `photo`.

**Steps 1–4 — uniqueness holds.**

```text
/data/photos[1]/photo   marker=ALPHA   filename=image-z460oy.jpg
/data/photos[2]/photo   marker=BETA    filename=image-19iov09.jpg
references unique: true
filenames unique:  true
```

**Steps 5–8 — stability fails, and the survivor inherits the deleted item's
identity.**

```text
(after removeInstances(0, 1))
survivor marker:  "BETA"                     the second item survived
reference was:    /data/photos[2]/photo
reference now:    /data/photos[1]/photo      REFERENCE STABLE: false
filename was:     image-19iov09.jpg
filename now:     image-z460oy.jpg           FILENAME STABLE:  false
survivor now claims the DELETED item's filename: true
```

**Step 9 — uniqueness is restored after adding another instance**, which is
exactly why nothing ever throws.

## The failure is silent data corruption

`instance_media` keys ALPHA's row on `/data/photos[1]/photo`, pointing at
ALPHA's bytes. After the delete, BETA's reference **is** that key — so BETA now
resolves to ALPHA's row and ALPHA's file.

The submission would reference `image-z460oy.jpg` while the XML claims it is
BETA's photo: **the wrong image attached to the record**, with no collision, no
constraint violation, and no error. Uniqueness invariants hold throughout, so
neither the primary key nor `UNIQUE (local_instance_id, filename)` ever fires.

## Root cause: we *derive* identity from position instead of *storing* it

This is narrower than "repeats are unsafe". ODK Collect does not derive media
filenames from position — it generates a filename once at capture and writes it
into the node value. **The value travels with the node when it reindexes**, so
position never participates in identity.

Gather's single-image path derives the filename instead, which is correct only
because a non-repeat reference like `/data/photo` is stable.

## What this changes

**Repeat-backed `ImageAsset[]` remains viable.** The XForms model is sound; our
identity derivation is not. That is a materially better answer than "repeats do
not work" — it means [§12](./components-capabilities-ownership.md#12-multi-image-capture--camera-slots--decision-2026-09-01)'s
`MultiImageCapture` design survives.

**But the fix is a storage change, and it must land before `MultiImageCapture`,
not alongside it:**

- generate the filename **once at capture** (random, or content-hash — a hash
  also dedupes identical bytes, though a random component avoids collisions
  between two genuinely identical photos in one instance);
- write it into the node value, and treat that value as the identity;
- re-key `instance_media` off the filename rather than `binding_reference` —
  `UNIQUE (local_instance_id, filename)` already exists, it is the primary key
  that is wrong;
- audit `attachImageMedia`'s `priorMedia` lookup, which also matches on
  `bindingReference`.

**Non-repeat fields are unaffected.** A plain `/data/photo` reference is stable,
so today's single-image path — including the ODK gate in
[§13](./components-capabilities-ownership.md#13-odk-image-capture-gate--landed-2026-09-01-device-run-outstanding) —
is correct as written.

**The reorder caution generalises.** [§12](./components-capabilities-ownership.md#12-multi-image-capture--camera-slots--decision-2026-09-01)
already said not to implement reorder by physically reordering repeat instances.
This shows deletion alone is enough to break identity: **XPath position must
never be treated as durable identity for anything.**

## Reproducing, and promoting to a test

The spike drives the real engine in Node using the DOM shim from
`archive/experiments/m2-slimdom-xforms/`. `slimdom` is deliberately **not** a
repo dependency — it is installed locally, the way `m8-model-export` keeps its
virtualenv out of the tree. See the
[spike README](../experiments/repeat-media-identity/README.md).

Once media identity no longer derives from position, this belongs in the test
suite so the regression cannot silently return; that is the point to add
`slimdom` as a real devDependency.
