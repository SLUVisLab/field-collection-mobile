# Device runtime gates

On-device verification harnesses. They are **not** part of the shipped app entry;
run one by temporarily pointing `index.js` at it, then revert.

## `M90WebCoreHermesGateApp.js` — A2UI `web_core` Hermes gate

Runs the upstream `@a2ui/web_core/v0_9` engine under React Native Hermes through
the package's schema-free compatibility exports. It constructs a Catalog and
MessageProcessor, creates a surface, updates a Data Model, resolves a bound
`Text` property, and dispatches an action. It emits
`M90_WEB_CORE_HERMES_RESULT::{...}`.

Temporarily point `index.js` at `./gates/M90WebCoreHermesGateApp`, then run:

```bash
scripts/run-android-gate.sh 'M90_WEB_CORE_HERMES_RESULT::' .gate-logs/m90-web-core-hermes.log 1200
```

Restore `index.js` to `App` and remove `.gate-logs/` when finished. Android
only; the output's `ok` property must be true.

`@a2ui/web_core@0.9.1`'s root v0.9 entry imports a JSON schema using import
attributes, which Metro accepts but Hermes fails to initialize. The
version-pinned `patches/@a2ui+web_core+0.9.1.patch` adds schema-free exports
that re-export the unchanged runtime modules. Remove that patch when upstream
ships Hermes-compatible v0.9 entry points (or an equivalent official
schema-free runtime export), then rerun this gate through that upstream entry.

## `M91MobileInstrumentGateApp.js` — mobile A2UI registry gate

Mounts the React Native A2UI component registry with the shared
`SEGMENT_AND_MEASURE_INSTRUMENT` messages. Deterministic capabilities then
drive the same upstream action/Data Model path through capture, segmentation,
mask acceptance, measurements, classification, and a typed accepted result.
It emits `M91_MOBILE_INSTRUMENT_RESULT::{...}`.

Temporarily point `index.js` at `./gates/M91MobileInstrumentGateApp`, then run:

```bash
scripts/run-android-gate.sh 'M91_MOBILE_INSTRUMENT_RESULT::' .gate-logs/m91-mobile-instrument.log 1200
```

Restore `index.js` to `App` afterward. The marker must include `"ok":true`;
this gate intentionally uses deterministic assets and does not replace the
subsequent real-camera Segment & Measure validation.

## `StorageGateApp.js` — gather-storage runtime gate

Proves the `gather-storage` primitives work on iOS + Android (Hermes) and persist
across a storage re-open:

```
initialize storage → SQLite opens → migration version correct → foreign_keys on
→ write/read structured record → write/read durable text file
→ write/read durable binary file → set/get SecureStore token
→ close + reinitialize (idempotent) → data still exists → delete credential → gone
```

It emits exactly one terminal marker, `STORAGE_GATE_RESULT::{…}` (plus
`STORAGE_GATE_CRASH::` / `STORAGE_GATE_HANG::` fail-safes). Secret values are
never logged — only booleans/lengths.

### Run it

Temporarily edit `index.js`:

```js
import StorageGateApp from './gates/StorageGateApp';
registerRootComponent(StorageGateApp);
```

- iOS: `export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH" LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`
  then `npm run ios`; watch stdout for `STORAGE_GATE_RESULT::`.
- Android: `scripts/run-android-gate.sh 'STORAGE_GATE_RESULT::' /tmp/storage-android.log 1200`
  (boots/uses an emulator, reads the marker from logcat).

Then revert `index.js` to `import App from './App'`.

## `XFormsHostContractGateApp.js` — M5 XForms host contract gate

Proves the M5 host-contract additions work against the **real** stock
`@getodk/xforms-engine` running in the hidden WebView sidecar on Android:

```
initialize engine → loadForm → getRenderModel (control type + label/hint +
appearance + choices + structural sequence) → setValue name/fruit → serialize →
fresh loadForm is blank → loadInstance(serialized) restores the saved answers
```

The decisive check is the last two steps together: a fresh `createInstance` is
blank, while `loadInstance` of the serialized XML restores the answers — proving
`loadInstance` is a genuine engine `restoreInstance`, **not** a `setValue` replay.

It emits exactly one terminal marker, `M5_HOST_CONTRACT_RESULT::{…}` (plus
`M5_HOST_CONTRACT_CRASH::` / `M5_HOST_CONTRACT_HANG::` fail-safes).

### Run it

Temporarily edit `index.js`:

```js
import XFormsHostContractGateApp from './gates/XFormsHostContractGateApp';
registerRootComponent(XFormsHostContractGateApp);
```

- Android: `scripts/run-android-gate.sh 'M5_HOST_CONTRACT_RESULT::' /path/to/out.log 1200`
  (boots/uses an emulator, reads the marker from logcat).

Then revert `index.js` to `import App from './App'`. (Android only — no iOS run.)

## `M53CatalogRunnerGateApp.js` — M5.3 cached Entity List runner gate

Runs the stock engine in the public hidden WebView host through
`XFormsProvider`/hooks. A cached `plants.csv` attachment is loaded with an
Entity List form; the gate proves that engine choices materialize, a UUID can
be selected, and calculated site/block/plant-code fields come from that CSV.
It has no network or credentials.

Temporarily point `index.js` at `./gates/M53CatalogRunnerGateApp`, then run:

```bash
scripts/run-android-gate.sh 'M53_CATALOG_RUNNER_RESULT::' .gate-logs/m53-catalog-runner.log 1200
```

The marker has `ok: true` only if every cached-attachment/choice/selection/
engine-calculation check passes. Remove `.gate-logs/` and restore the normal
`App` entry afterward. Android only.

## `M54InstanceLifecycleGateApp.js` — M5.4 durable instance lifecycle gate

Runs a fixture through real SQLite/filesystem, the hidden WebView engine, and
the public host boundary:

```
immutable cached version → Entity choice + repeat → serialize → atomic XML
write → draft metadata → fresh blank engine → loadInstance restore
```

It verifies the exact cached version/hash, XML persistence, values, repeat
bindings, and ODK instance ID. It makes no network request or logs credentials,
then cleans its project row and durable directory.

Temporarily point `index.js` at `./gates/M54InstanceLifecycleGateApp`, then run:

```bash
scripts/run-android-gate.sh 'M54_INSTANCE_LIFECYCLE_RESULT::' .gate-logs/m54-instance-lifecycle.log 1200
```

Restore `index.js` to `App` and remove `.gate-logs/` when finished. Android
only; do not run iOS for this milestone.

## `M54RequiredUploadGateApp.js` — M5.4a required-image gate

Runs the narrow M5 required-image path without Central networking:

```
bundled local JPEG → atomic project media copy → safe XML filename binding
→ SQLite relative media metadata → close/reopen + XML restore
→ required-field finalization → foreground-submit contract with an Expo File body
```

It is deliberately **not** a camera, gallery/file picker, or general media
manager. The fake client verifies it receives the copied native
`expo-file-system` `File`, including the non-empty original bytes, and invokes
the existing OpenRosa multipart-body builder with it.

```bash
scripts/run-m54a-required-upload-gate.sh
```

The script restores `index.js` and removes `.gate-logs/`. Android only.

## `M55FullRuntimeGateApp.js` — final M5 live runtime gate

The M5.5 harness is the only M5 gate intended to run on **both iOS/Hermes and
Android/Hermes**. It uses the real, env-configured Central fixture without
printing its URL, App User key, Web User credential, request URLs, or decoded
provisioning content.

```
remove local matching Central project → provisionManual (verification included)
→ active project shell → explicit catalog refresh → cached Silphium form +
plants.csv Entity List → real Entity choice + measurements → save XML draft
→ bundled fixture image copy + filename binding → close/reopen Gather storage
→ public loadInstance restore → finalize
→ foreground OpenRosa submit → Web User REST XML/detail read-back → delete
test submission
```

Run it only with the gitignored `central-live.env` fixture:

```bash
scripts/run-m55-full-runtime-gate.sh
```

The runner temporarily points `index.js` at the gate and always restores the
normal `App` entry plus removes `.gate-logs/`. If submission succeeds, its
Web User read-back verifies the ODK instance ID, selected Entity UUID, both
observation values, and form version before attempting to delete the test
submission. A gate result of `blocked` is an intentional failure: do not treat
the marker's presence alone as a pass.

The live Silphium fixture's required image `<upload>` is satisfied by one
clearly labelled bundled JPEG fixture. Its bytes are copied to the project media
directory; the XML stores only its generated safe filename and SQLite stores
only the relative key needed to resolve an Expo `File` at send time. Other
upload media types remain explicitly unsupported. Camera, gallery/file picker,
general media management, and background/retry upload work remain out of scope.
See `docs/m5-final-runtime-report.md`.

## `ShellNavGateApp.js` — M5.1 shell boot + navigation gate

Boots the **real** app (`GatherProvider` → `gather-storage` bootstrap →
route tree) and programmatically walks every route of BOTH shells, recording
which screens actually mount via the `NavProbe` seam:

```
initialize storage (migrations incl. projects) → setup shell renders →
walk setup routes (home/connect/scan) → seed + activate a throwaway project →
project shell renders → walk project routes (home/forms/form/drafts/instance/switch)
→ every expected screen mounted
```

It emits exactly one terminal marker, `M51_NAV_RESULT::{…}` (with `ok`,
`expected`, `visited`, `missing`), plus `M51_NAV_CRASH::` / `M51_NAV_HANG::`
fail-safes. No secrets are logged.

### Run it

Temporarily edit `index.js`:

```js
import ShellNavGateApp from './gates/ShellNavGateApp';
registerRootComponent(ShellNavGateApp);
```

- Android: `scripts/run-android-gate.sh 'M51_NAV_RESULT::' /path/to/out.log 1200`
  (boots/uses an emulator, reads the marker from logcat).

Then revert `index.js` to `import App from './App'`. (Android only — no iOS run.)

## `CollectionFieldGateApp.js` — multi-image collection field gate

The on-device counterpart to `docs/b-standard-field-conventions.md` and §19 of
`docs/components-capabilities-ownership.md`. Drives the sequence
`XFormsMultiImageControl` performs, but against the **real engine, real SQLite
and real files**:

```text
appearance recognition -> capture x3 into repeat instances -> remove the middle
one with orphan cleanup -> storage restart + draft resume -> finalize + submit
both surviving attachments
```

The fixture form is the **pyxform-canonical** shape (appearance on the
`<repeat>`, wrapping `<group>` bare) and also carries an ordinary
appearance-free repeat, so recognition is proven *additive*. The Central
transport is stubbed, so no server is touched and no remote artifacts are
created. It emits exactly one `COLLECTION_FIELD_RESULT::{…}`.

Point `index.js` at `./gates/CollectionFieldGateApp`, then:

```bash
scripts/run-android-gate.sh 'COLLECTION_FIELD_RESULT::' .gate-logs/collection-field.log 1200
```

Revert `index.js` afterwards. It does **not** render React, so it verifies the
pipeline rather than the control's presentation — the interactive camera
(shutter, thumbnail accessory, capture -> remove -> replace) still needs a
physical device.

## `DevSeedCompositionApp.js` — an authored composition in the REAL app

A **dev seed**, not a gate. Registers the Quadrat Tally fixture, seeds a form
whose group carries `gather-composition:<id>` plus a `gather-bindings.json`
attachment, then mounts `App` unmodified -- so the shipped shell, `FormRunner`,
its composition adapter and the commit path all run for real.

Going *through* `FormRunner` is the point: it found a duplicate-draft
`UNIQUE` violation that no headless test or directly-mounted control could
(see §7 of `docs/b-custom-composition-conventions.md`).

Emits `COMPOSITION_SEED_READY::{…}`. Navigate to **Forms -> Quadrat tally (dev
seed)**, tally a few, optionally flag uncertain, and Accept. The backing fields
are hidden because the composition owns its subtree, so verify the commit in the
data rather than on screen:

```bash
PKG=com.sluvislab.BIIManualPhenotyper
adb exec-out "run-as $PKG cat files/SQLite/gather.db" > /tmp/gather.db
NEW=$(sqlite3 /tmp/gather.db "SELECT local_instance_id FROM instances \
  WHERE project_key='dev-seed-composition' ORDER BY updated_at DESC LIMIT 1;")
adb shell "run-as $PKG cat files/gather/projects/dev-seed-composition/instances/$NEW/instance.xml"
sqlite3 /tmp/gather.db "SELECT binding_reference FROM instance_receipts WHERE local_instance_id='$NEW';"
```

**Always key that check to the newest draft.** The seed re-seeds each launch, so
older drafts accumulate, and reading the wrong one shows empty fields that look
exactly like a failed commit. Revert `index.js` afterwards.

## `DevSeedCollectionFormApp.js` — a collection form in the REAL app

Not a gate: a **dev seed**. It writes a project, an active selection, and one
cached form version carrying `gather-multi-image`, then mounts `App`
**unmodified**. Everything after boot is the shipped shell, the shipped
`FormRunner`, and the shipped collection adapter.

It exists because the other two gates supply their *own* collection adapter, so
neither exercises `FormRunner`'s wiring -- which is exactly how the §22 defect
survived (`instance.media` is always `undefined`, so the shipped app would have
rendered an empty collection for every form).

`recordCachedVersion` is the same call the Central download path ends in, so the
cached state is identical without a server; confirming Central's *download* is
still the deferred round trip's job. Emits `DEV_SEED_READY::{…}` once seeded.

Point `index.js` at `./gates/DevSeedCollectionFormApp`, start Metro, then
navigate: **Forms -> Photo collection (dev seed)**. Capture two photos and
confirm tiles appear and the counter tracks `min=2 max=4`. Re-seeds on every
launch; drafts from prior runs remain in Drafts. Revert `index.js` afterwards.

## `InteractiveCameraGateApp.js` — interactive camera + collection field

The only **human-driven** gate. Mounts the real stack (`XFormsProvider` ->
`XFormsRenderer` -> `XFormsMultiImageControl` -> `MultiImageCapture` ->
`CameraView`) over real storage and the real lifecycle service, so the camera
interaction and the React binding seam are actually exercised. It found two
defects the headless collection gate could not see -- see §21 of
`docs/components-capabilities-ownership.md`.

The panel shows three independently counted numbers -- engine filled frames,
media rows, and `<frame>` elements in the saved XML -- which must agree. The
checklist below is the human's half; tapping **Emit result** logs
`INTERACTIVE_CAMERA_RESULT::{...}` once. Central is never contacted.

Point `index.js` at `./gates/InteractiveCameraGateApp`, then for a USB device:

```bash
ANDROID_SERIAL=<serial> scripts/run-android-gate.sh \
  'INTERACTIVE_CAMERA_RESULT::' .gate-logs/interactive.log 1500
```

`ANDROID_SERIAL` makes the runner use that device and set up `adb reverse` plus
the `localhost` packager host. The device must be **authorized** for USB
debugging first (`adb devices` must show `device`, not `unauthorized`) --
otherwise `expo run:android` fails on device enumeration even when another
device is selected. Revert `index.js` afterwards.

## `MediaIdentityGateApp.js` — attachment identity gate

Attachment identity must be minted at capture and never derived from the XForms
binding reference, because repeat references reindex on deletion. See
`docs/repeat-media-identity-characterization.md`. Emits
`MEDIA_IDENTITY_RESULT::{…}`; Central transport stubbed.

```bash
scripts/run-android-gate.sh 'MEDIA_IDENTITY_RESULT::' .gate-logs/media-identity.log 1200
```

## `ShellSmokeApp.js` — first-party package smoke (pre-shell)

The original Expo-57 package smoke that exercised a call into every workspace
package on-device (`SHELL_SMOKE_RESULT::{…}`). It predates the M5.1 shell (which
is now the shipped `App.js`); kept here as a package-level runtime harness. Run
it by pointing `index.js` at `./gates/ShellSmokeApp`, then revert.
