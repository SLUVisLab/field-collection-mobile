# M7 Entity Traversal & Fieldwork Sessions - Final Summary

**Date:** 2026-08-28
**Status:** Complete and validated
**Prerequisite:** M6 offline Entity runtime

## Outcome

M7 adds an optional, resumable fieldwork workflow over ordinary Entity-aware ODK
forms. Researchers can continue using the normal Forms -> Fill out form ->
Save Draft / Mark ready workflow unchanged, or choose Fieldwork to traverse a
stable local Entity set efficiently.

```text
Fieldwork
  -> start or resume local session
  -> resolve M6 effective Entity List
  -> filter / group / sort locally
  -> List | Groups | Map
  -> Observe or Resume
  -> ordinary FormRunner
  -> Save Draft / Finalize / Finalize & Next
  -> existing M6 journaled Send All
```

Every observation remains one ordinary XForms instance and one ordinary ODK
submission. M7 does not introduce a second form engine, instance lifecycle,
sync system, Entity store, or direct Entity REST write path.

## Architecture

| Layer | M7 responsibility |
| --- | --- |
| `gather-storage` | Durable session intent and target-to-instance association |
| `src/fieldwork/` | Pure traversal/progress/geometry derivation and M6 service adapter |
| `src/components/entities/` | Shared Entity row and lifecycle-status presentation |
| `src/components/maps/` | Receives mappable traversal targets and emits selection |
| `src/screens/project/` | Composes Fieldwork Home and Fieldwork Session interactions |
| Existing FormRunner/lifecycle/sync | Preselects the Entity through XForms, saves/finalizes, journals, and sends |

The effective local Entity List remains M6-owned: the form catalog loads its
immutable cached Entity List and M6 overlays finalized Entity effects in
memory. Fieldwork consumes that result; it does not reconstruct Entity state.

## Durable model

Migration 9 adds:

```text
fieldwork_sessions
  session identity
  project/form/exact form-version/dataset identity
  ordered target Entity ID snapshot
  current target
  persisted filter/group/sort/view intent
  start/completion timestamps

fieldwork_session_instances
  session + target Entity ID -> ordinary local instance ID
```

The target IDs are snapshotted at session start, so later dataset refreshes do
not silently alter working-set membership or order. Entity records/properties,
labels, geometry, lifecycle progress, and sync status are derived at read time.

## Completed capabilities

- Normal form-first workflow remains available from Forms.
- Fieldwork Home starts sessions from cached Entity-aware forms and resumes
  existing local sessions.
- List view provides search, selection, and derived lifecycle state.
- Groups view organizes the same working set by a user-selected Entity property.
- Map view renders only valid point geometry from a `geometry` property;
  targets without valid geometry remain available in List/Groups.
- Label sorting persists ascending/descending deterministic order.
- Progress derives from associated ordinary instance states:
  `pending`, `draft`, `complete` (`ready`), and `synced` (`sent`).
- Observe opens the existing FormRunner and preselects the stable Entity ID
  through its normal XForms choice/binding path.
- Resume reopens the associated ordinary draft.
- Finalize & Next uses ordinary finalization and returns to the same session to
  advance to the next pending snapshotted Entity.
- Project and exact form-version ownership are enforced by the storage model.

## Primary changed modules

- [fieldwork.js](../packages/gather-storage/src/repositories/fieldwork.js):
  durable fieldwork-session repository.
- [index.js](../packages/gather-storage/src/migrations/index.js): migration 9.
- [fieldworkService.js](../src/fieldwork/fieldworkService.js): M6 effective CSV
  access and lifecycle-state association adapter.
- [traversal.js](../src/fieldwork/traversal.js): pure filtering, sorting,
  grouping, progress, and point normalization.
- [FieldworkHome.js](../src/screens/project/FieldworkHome.js) and
  [FieldworkSession.js](../src/screens/project/FieldworkSession.js): session UI.
- [FormRunner.js](../src/screens/project/FormRunner.js): fieldwork Entity
  preselection and Finalize & Next return path, reusing the existing lifecycle.
- [GatherMap.js](../src/components/maps/GatherMap.js): reusable marker selection.
- [GatherProvider.js](../src/context/GatherProvider.js): composition-root actions.
- [run-android-gate.sh](../scripts/run-android-gate.sh) and
  [run-ios-gate.sh](../scripts/run-ios-gate.sh): robust supported device
  selection for real-device gates.

## Validation

| Check | Result |
| --- | --- |
| Fieldwork traversal tests | PASS |
| Fieldwork service test | PASS |
| Fieldwork repository test | PASS |
| Full `npm run test:unit` | PASS |
| Expo public config validation | PASS |
| Android Metro/Hermes export | PASS |
| `git diff --check` | PASS |
| M6 Central regression, Android/Hermes | PASS |
| M6 Central regression, iOS/Hermes | PASS |

Both platform regressions confirmed M6 behavior remains correct after M7:
offline Entity create/update, storage restart, dependency-ordered multipart
sync, Central Entity version-2 and media read-back, and artifact cleanup.

## Explicitly deferred

M7 intentionally does not include assignments, server workflow infrastructure,
proximity/GPS ordering, routing, offline map packs, polygon/line geometry,
GIS tooling, batched multi-Entity submissions, A2UI, or a generic workflow
engine.

## Related documents

- [M7 implementation plan](./m7-entity-traversal-plan.md)
- [M7 status](./m7-entity-traversal-status.md)
- [M6 offline runtime status](./m6-offline-runtime-status.md)
