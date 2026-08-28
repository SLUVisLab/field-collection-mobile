# M5 final runtime report

**Date:** 2026-08-28
**Fixture:** the locally configured Central App User project; credentials and
provisioning payloads were never written to tracked files or test output.

## Architecture delivered

`App` composes `GatherProvider`, startup loading/error rendering, and the route
tree. Bootstrap initializes `gather-storage` before route rendering, opens/migrates
SQLite, reads the active project, and selects one mutually exclusive route shell:

| Setup | Project |
| --- | --- |
| `/setup` | `/project` |
| `/setup/connect` | `/project/forms` |
| `/setup/scan` | `/project/forms/:formId` |
|  | `/project/drafts` |
|  | `/project/drafts/:instanceId` |
|  | `/project/drafts/:instanceId/fill` |
|  | `/project/switch` |

Manual and Settings-QR provisioning both verify the App User by calling the
public `listForms()` client contract before writing local state. The final gate
uses the manual service path (not a camera/QR parser). `FormCatalog` refreshes
only on an explicit user action and persists immutable XML, sanitized manifest
metadata, and resources. `FormRunner` uses the public WebView XForms host and
React store; drafts resume only through `loadInstance`, never app-side answer
replay. Sending remains foreground-only.

## Local data topology

| Store | Data |
| --- | --- |
| SecureStore | project-scoped Central App User token |
| SQLite | project registry; mutable form catalog pointer; immutable
form-version/resource identity; instance lifecycle and relative media metadata |
| Documents/gather | `projects/<key>/forms`, `resources`, `instances`, media,
instruments, and models |

Instance XML is authoritative at
`projects/<project>/instances/<local-instance>/instance.xml`. SQLite contains
only the relative file key plus local/ODK IDs, form/version identity, lifecycle
state, timestamps, redacted send receipt/error, and per-upload binding
reference/safe filename/MIME type/relative media key—never answer columns,
binary payloads, or credentials. Form versions and resources are insert-only;
a catalog refresh cannot replace a revision used by a draft.

## Package changes integrated in M5

- `gather-storage`: migrations 2–6, projects/forms/instances repositories,
  durable atomic file writes, SecureStore token lifecycle.
- `odk-xforms-host`: snapshot, render-model, resource, serialization, repeat,
  and restore host contracts.
- `odk-xforms-webview`: stock engine sidecar bridges cached resources and
  `restoreInstance`.
- `odk-xforms-react`: public load/restore/render-model/repeat hooks.
- App shell: provisioning, catalog, thin runner, durable lifecycle, and
  navigation screens.
- Required-image addition: a narrow bundled JPEG fixture path, media metadata,
  XML filename binding, and native `expo-file-system` `File` OpenRosa body.
- Final-gate additions: cross-platform iOS marker runner, M5.5 live harness,
  M5.4a Android required-image harness, and a host-side Central
  read-back/delete verifier.

`GatherProvider` now supplies project-removal usage counts from the real
instances repository, so the confirmation preview correctly reports stored
draft and ready counts.

## Exact verification

| Command | Result |
| --- | --- |
| `npm run test:unit` | PASS |
| `node --test test/live/provisioning.live.test.mjs test/live/form-catalog.live.test.mjs` (with local Central env) | PASS |
| `EXPO_NO_TYPESCRIPT_SETUP=1 npx expo config --type public` | PASS |
| `scripts/run-m54a-required-upload-gate.sh` — Android emulator/Hermes | PASS |
| `scripts/run-m55-full-runtime-gate.sh` — iOS Simulator/Hermes | PASS: all device checks, OpenRosa multipart `201`, REST/XML read-back, and deletion confirmed |
| `scripts/run-m55-full-runtime-gate.sh` — Android emulator/Hermes | PASS: all device checks, OpenRosa multipart `201`, REST/XML read-back, and deletion confirmed |

The final M5.5 run is green on both Hermes targets. Starting with no matching
local project, each target manually provisioned the live App User, refreshed
the Central catalog, cached and loaded `plants.csv`, selected a real Entity,
recorded the safe observations and required bundled JPEG, and restored the
same draft, Entity, upload filename, and immutable form version after storage
reinitialization. Engine validation finalized the form and foreground OpenRosa
multipart submission returned `201` with the copied native Expo `File` as its
JPEG body. Web User REST detail/XML read-back then verified the instance ID,
Entity ID, observations, and form version. Each test submission was deleted
(Central returned `200`) and its subsequent read returned `404`; each target
also removed its local matching project and media.

## Narrow required-image path and M6 boundary

The real Entity-aware Silphium form's required binary `flower_photo` is now
supported only through a clearly labelled bundled JPEG fixture. The app copies
that existing local file to project media, asks the engine to serialize its
safe filename, and submits the stored native `File` in the existing foreground
OpenRosa client flow. XML remains authoritative; SQLite contains no answers or
binary data.

This is deliberately not camera capture, gallery/file selection, a generalized
media manager, background queue/retry/sync, or broader M6 lifecycle work.
Audio, video, arbitrary-file, and untyped uploads are explicit unsupported
states. M6 may add permission-aware acquisition and broader media lifecycle
only while preserving XML authority and foreground-send behavior.

## Recommendation

**M5 full runtime gate: GREEN.** The documented Silphium workflow is
live-verified on iOS/Hermes and Android/Hermes, including durable restoration,
the narrow required JPEG path, Central submission/read-back, and cleanup.
