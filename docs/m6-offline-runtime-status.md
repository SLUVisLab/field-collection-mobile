# M6 Offline Runtime Status

**Date:** 2026-08-28
**Engine:** `@getodk/xforms-engine@1.0.3-gather.1`
**Status:** GREEN

## Result

Gather now provides a durable offline runtime around the authoritative ODK
XForms engine:

```text
online refresh
  -> offline Entity create and dependent update
  -> process/storage restart
  -> dependency-ordered OpenRosa sync
  -> Central Entity, submission, and media verification
```

The final M6.6 Central-backed gate passed on Android/Hermes and iOS/Hermes.
Each run created a registration Entity and dependent observation offline,
reloaded the persisted state, synchronized both submissions in dependency
order, read them back from Central, verified the resulting version-2 Entity
and required photo, and deleted every test artifact.

| Target | Result |
| --- | --- |
| Android/Hermes | `M66_android_GATE::PASS` |
| iOS Simulator/Hermes | `M66_ios_GATE::PASS` |

## Semantics boundary and engine derivative

The original stock-engine investigation correctly found that version `1.0.3`
does not expose resolved `entities:saveto` effects. The subsequently approved
M6 recovery direction allowed a narrow, reproducible derivative at the engine
boundary, rather than a Gather-side evaluator.

[packages/odk-xforms-engine/](../packages/odk-xforms-engine/)
pins `@getodk/xforms-engine@1.0.3-gather.1` and exposes generic resolved
`EntityEffect[]` values. It remains the one authority for XForms parsing,
XPath, calculations, relevance, repeats, Entity declarations, and
serialization. Gather does not parse XForms or evaluate XPath to infer Entity
effects.

The generic effect seam is carried through:

```text
engine derivative
  -> odk-xforms-host
  -> odk-xforms-webview RPC
  -> odk-xforms-react
  -> Gather lifecycle
```

## M6.1: durable submission journal

Migration 7 adds `sync_operations` and `sync_dependencies`. Every ready
instance has exactly one durable submission operation. The foreground sender
uses the persisted XML bytes and records `attempting` before dispatch; a
completed response records `complete`. Interrupted attempts become visible
`retryable` work. Error metadata is bounded and credential-safe.

Central characterization confirms that an identical persisted XML retry for
the same instance ID returns `201`, while changed XML for that instance ID
returns non-retryable `409`. Retries therefore never regenerate XML.

## M6.2-M6.3: Entity effects and offline overlay

Migration 8 stores stable Entity branches plus immutable per-instance effect
batches. [entityService.js](../src/entities/entityService.js)
projects those effects over the immutable App User-delivered Entity List CSV
only in memory. Cached resources are never modified.

The effective CSV preserves authorized unknown columns and supplies:

- `name`
- `label`
- `__version`
- `__trunkVersion`
- `__branchId`

New local Entities begin at version `1` with a stable local branch and empty
trunk version. Local updates increment their local version while retaining
branch/trunk identity. The Collect source-derived six-case record is in
[m6-collect-entity-characterization.md](./m6-collect-entity-characterization.md);
it is a behavior reference, distinct from the Gather device proof.

## M6.4-M6.5: dependency-aware foreground sync

[syncService.js](../src/sync/syncService.js)
derives dependencies from persisted resolved effects, never timestamps or FIFO
ordering. An update of a locally-created Entity depends on its matching create
operation; later updates depend on the exact version producer. Invalid,
missing, cyclic, or blocked dependencies remain visible as blocked operations,
while independent work can proceed.

The project drafts UI exposes explicit foreground sync and blocked state. No
background transport or direct mobile Entity REST mutation was introduced.

## M6.6 evidence

The gate at
[M66FullOfflineRuntimeGateApp.js](../gates/M66FullOfflineRuntimeGateApp.js)
uses real native storage, the WebView XForms host, the App User catalog, and
Central OpenRosa multipart submission. During its offline section, injected
network access fails the gate; no Central request is permitted until explicit
Send All.

Both device runs verified:

- form and Entity List refresh;
- an offline registration Entity appearing in a separate survey;
- offline Entity update, effective CSV reload, and calculated values;
- storage close/reopen persistence;
- persisted dependency and registration-before-observation dispatch;
- required image attachment upload;
- Central submission XML, Entity create/update, version `2`, and media
  read-back;
- deletion and `404` confirmation for both submissions and the test Entity.

The host verifier polls Central's eventually consistent Entity projection
before cleanup, while submission XML and attachment read-back are available
immediately.

## Final validation

Completed after the device gates:

```text
npm run test:unit                                      PASS
EXPO_NO_TYPESCRIPT_SETUP=1 npx expo config --type public  PASS
EXPO_NO_TYPESCRIPT_SETUP=1 npx expo export --platform android ...  PASS
git diff --check                                      PASS
```

Android was shut down before the iOS gate; the iOS simulator and gate-owned
Metro processes were shut down afterward.
