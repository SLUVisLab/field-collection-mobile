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

## `ShellSmokeApp.js` — first-party package smoke (pre-shell)

The original Expo-57 package smoke that exercised a call into every workspace
package on-device (`SHELL_SMOKE_RESULT::{…}`). It predates the M5.1 shell (which
is now the shipped `App.js`); kept here as a package-level runtime harness. Run
it by pointing `index.js` at `./gates/ShellSmokeApp`, then revert.
