# Repeat media identity characterization

**Date:** 2026-09-02
**Engine:** `@getodk/xforms-engine@1.0.3-gather.1` (driven headlessly in Node)
**Spike:** [experiments/repeat-media-identity/](../experiments/repeat-media-identity/)
**Status:** **fixed and device-verified 2026-09-02** (migration 10 +
`imageFilenameForCapture`); regression tests in place and the Android gate is
green. The spike is retained as the record of upstream engine behaviour.

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

## The fix (landed 2026-09-02)

- **`imageFilenameForCapture({ contentType })`** mints the filename once at
  capture with a random suffix, and it is written into the node value — so
  identity travels with the node when it reindexes. `imageFilenameForReference`
  and its `hashReference` helper are gone.
- **Migration 10 (`instance_media_identity`)** rebuilds `instance_media` with
  `PRIMARY KEY (local_instance_id, filename)`, keeping `binding_reference` as
  provenance. SQLite cannot alter a primary key, so the table is rebuilt; the
  copy is **lossless** because `filename` already existed and was already unique
  per instance. No saved XML is rewritten.
- **`attachImageMedia({ …, previousFilename })`** resolves the attachment being
  replaced from the node's *current value*, not from its reference, and now
  retires the prior **row** as well as its bytes — a replacement mints a new
  filename, so the old row is no longer overwritten in place.
  `instances.deleteMedia({ localInstanceId, filename })` was added for that.
- `XFormsImageControl` passes the node's current value through `FormRunner`.

A random suffix rather than a content hash: hashing would dedupe identical bytes
for free, but collide when a researcher legitimately attaches the same photo
twice in one instance.

### Regression coverage

- a filename is minted per capture, not derived from the reference (same
  reference + same bytes → different identity);
- replacement is identified by the node value and retires exactly the prior row
  and its bytes;
- **a capture at a reused reference cannot inherit another item's attachment** —
  the direct regression: both rows survive, and the other item keeps its bytes;
- migration 10 asserts the new key, the lossless column copy, index recreation,
  and that the old primary key is gone.

### Device verification (Android emulator, 2026-09-02)

[`gates/MediaIdentityGateApp.js`](../gates/MediaIdentityGateApp.js) exercises the
invariants against **real SQLite, real files and the real WebView engine** —
`Pixel_3a_API_34_extension_level_7_arm64-v8a`, cold boot, `BUILD SUCCESSFUL in
14m 25s`. Result `ok: true`, `schemaVersion: 10`, all nine checks:

```text
PASS  migrationApplied                  schema 10 applied on device
PASS  filenameMintedNotDerived          3 attaches, same reference, 3 filenames
PASS  reusedReferenceKeepsBothRows      a reused reference inherits nothing
PASS  reusedReferenceKeepsBothFiles     both files survive
PASS  replaceRetiresOnlyNamedRow        retirement is precise
PASS  replaceDeletesOnlyNamedBytes      only the named bytes go
PASS  replacedXmlBindsNewFilename       XML binds the current filename
PASS  submissionCarriesCurrentFilename  one attachment, the referenced name
PASS  projectRemovalCleansMedia         project removal clears media
```

The Central transport is stubbed (multipart parts captured), so the gate needs
no server and creates no remote artifacts; live submission is unchanged and
remains covered by the M5.5 runner.

**Every failure during the run was in the harness, not the product** — three of
them, each worth recording because they are easy to repeat:

1. Independent drafts in one project collide: `instances` is UNIQUE on
   `(project_key, odk_instance_id)` and the engine's preloaded `instanceID` is
   not distinct across fresh `loadForm` calls. A second draft needs its own
   project.
2. `deleteProjectDirectory` before evaluating the checks made every lazily
   evaluated `.exists` report false. Sample byte presence *before* teardown.
3. The reuse invariant describes an *intermediate* state; sampling once at the
   end saw `second` already legitimately retired. Two sampling points are needed.

Also noted: `expo start` must carry `EXPO_NO_TYPESCRIPT_SETUP=1` (it is baked
into the npm scripts, and bypassing them trips the `archive/` TypeScript scan),
and the documented `Failure calling service package: Broken pipe (32)` appeared
once immediately after the long build, then cleared — `adb install` of the
already-built APK succeeded, so no rebuild was needed.

### Live Central regression — both targets green (2026-09-02)

The media fix changed `attachImageMedia` and the media schema, both on the
M5-verified submission path, so the existing M5.5 runner was re-run against the
live Central instance on both Hermes targets:

```text
M55_android_GATE::PASS      30/31 device checks, submissionStatus 201
M55_ios_GATE::PASS          30/31 device checks, submissionStatus 201
host read-back (both):      submissionFound, instanceId, entityId, observation,
                            formVersion — all true
cleanup (both):             deleteStatus 200, afterDeleteStatus 404
journal (both):             pending → attempting → complete, attemptCount 1
```

The one non-true device check is `centralReadBack`, which is by design: the
on-device App User token cannot read submissions back, so the outcome is
`ready-for-readback` and the host-side Web User verifier performs it. Each run
deleted its own test submission and confirmed the `404`.

This exercises the changed path end to end — `fixtureImageCopied`,
`uploadFilenameBound`, `draftMediaMetadata`, `resumedMediaMetadata`,
`resumedUploadFilename`, `requiredImageUploadSupported`,
`validationFinalizesBoundUpload`, `foregroundSubmit`, `sent` — so the new
filename scheme and re-keyed `instance_media` survive a real submission,
storage restart, resume, and Central read-back.

### Known follow-up

Without an explicit `previousFilename` nothing is retired, which is the safe
default — better to keep an unreferenced file than to delete a different item's.
The cost is that a caller which forgets to pass it leaves an orphan row whose
bytes would still be submitted. Deleting a repeat item also needs its media
cleaned up; no orphan-media sweep exists yet, and that belongs with
`MultiImageCapture`.

## What this changed

**Repeat-backed `ImageAsset[]` remains viable.** The XForms model is sound; our
identity derivation is not. That is a materially better answer than "repeats do
not work" — it means [§12](./components-capabilities-ownership.md#12-multi-image-capture--camera-slots--decision-2026-09-01)'s
`MultiImageCapture` design survives.

**Non-repeat fields were never affected.** A plain `/data/photo` reference is stable,
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
