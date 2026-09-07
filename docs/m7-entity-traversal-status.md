# M7 Entity Traversal Status

**Status:** GREEN

M7 adds an optional local fieldwork workflow without replacing the normal Forms
workflow. A fieldwork session snapshots an effective M6 Entity List, then
provides List, Groups, and Map views over that one working set.

## Session model

Migration 9 adds `fieldwork_sessions` and `fieldwork_session_instances`.
Persisted data is limited to session intent: project/form/version/dataset,
ordered target IDs, current target, filter/group/sort/view settings, and the
association from a target to its ordinary local instance. Entity rows, display
properties, geometry, lifecycle progress, and sync state remain derived.

## Workflow

- The existing Forms catalog and ordinary FormRunner remain available.
- Fieldwork Home starts or resumes a local session for an Entity-aware cached
  form.
- Fieldwork Session supports persisted label filtering, generic property
  grouping, deterministic label sorting, List, Groups, and Map presentation.
- Point geometry is limited to valid `geometry` property latitude/longitude
  values; unmappable targets remain in List and Groups.
- Observe opens the ordinary FormRunner, which writes the selected stable Entity
  ID through the XForms binding path.
- Save Draft and Finalize retain the ordinary M5/M6 lifecycle. The session stores
  only their association. Finalize & Next returns through the same session and
  opens the next pending snapshotted target.
- Ready is locally complete; sent is complete plus synchronized.

## M6 reuse and boundaries

M7 consumes the M6 effective Entity CSV through the form catalog and uses M6
instances and sync state. It does not parse XForms/XML, evaluate Entity effects,
modify Entity branches, create a sync path, perform direct Entity REST writes,
or create a second form lifecycle.

Deferred: assignment infrastructure, proximity/GPS ordering, routing, offline
map packs, non-point geometry, and server-side workflows.

## Verification

```text
M7 traversal/service/repository unit tests              PASS
npm run test:unit                                      PASS
Expo public config                                     PASS
Android Metro export                                   PASS
git diff --check                                       PASS
M6 Android/Hermes Central regression                   PASS
M6 iOS/Hermes Central regression                       PASS
```

Both platform regressions exercised real offline Entity creation/update,
restart, dependency-ordered multipart sync, Central Entity version-2/media
read-back, and cleanup after M7 was integrated. Android used the runbook’s
known-good Pixel target; iOS now selects an installed supported iPhone runtime
rather than a stale simulator destination. Devices and Metro were shut down
after validation.
