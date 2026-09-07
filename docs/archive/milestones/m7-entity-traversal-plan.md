# M7 Entity Traversal Implementation Plan

## Current substrate

| Concern | Existing owner |
| --- | --- |
| Effective Entity CSV | `src/entities/entityService.js` through `formCatalogService.loadCurrentForm()` |
| Immutable form/resource metadata | `gather-storage` forms repository |
| XML instance lifecycle | `src/instances/instanceLifecycleService.js` |
| Ready/sent transport state | M6 sync service |
| Ordinary form UI/binding | `src/screens/project/FormRunner.js` and `src/xforms/` |
| Map foundation | `src/components/maps/GatherMap.js` |

The effective Entity set is available only by loading a cached Entity-aware form:
the catalog reads its immutable CSV and M6 overlays finalized effects in memory.
Current instance rows provide project, form, exact version, state, and durable
local ID, but deliberately do not store the selected Entity. M7 must not parse
XForms/XML to recreate that relationship.

## Model and persistence

Migration 9 will add:

```text
fieldwork_sessions
  session_id, project_key, form_id, form_version_id, entity_dataset,
  target_entity_ids_json, current_entity_id, filter/group/sort JSON,
  view_mode, started_at, completed_at

fieldwork_session_instances
  session_id, entity_id, local_instance_id
```

`target_entity_ids_json` snapshots the working set and order at session start.
The second table is the minimal durable association needed to derive progress
without interpreting form XML. It contains no answer data and does not replace
the instance lifecycle.

Persisted: session identity/ownership, exact form version, dataset, target ID
snapshot/order, current target, presentation configuration, selected view, and
session-created instance association. Derived: effective Entity rows/properties,
labels/geometry, pending/draft/complete/sent progress, sync status, filtered and
grouped display models, and map markers.

## Proposed modules

```text
packages/gather-storage/src/repositories/fieldwork.js   durable session intent
src/fieldwork/fieldworkService.js                       working set and lifecycle adapter
src/fieldwork/traversal.js                              pure filter/sort/group/progress/geometry
src/components/entities/EntityListItem.js               shared Entity presentation
src/components/entities/EntityStatusBadge.js            shared progress presentation
src/screens/project/FieldworkHome.js                    session entry/resume
src/screens/project/FieldworkSession.js                 List/Groups/Map composition
```

Screens compose provider actions. `fieldworkService` loads the M6 effective
CSV, parses it with the existing CSV parser, snapshots IDs, and coordinates
session mappings with the ordinary lifecycle. It does not query SQLite directly,
parse XForms, mutate sync operations, or implement Entity effects.

## Interaction flow

1. Fieldwork Home lists current/recent local sessions and Entity-aware cached forms.
2. Starting a session resolves the current effective Entity CSV, snapshots target
   IDs, and persists local filter/group/sort/view intent.
3. List, Groups, and Map receive the same resolved target model. Point geometry
   is normalized only from a `geometry` property as `longitude latitude` (with
   optional altitude/accuracy ignored); invalid/missing values are unmappable.
4. Observe opens the ordinary `FormRunner` with session/entity query context.
   The runner writes the stable Entity ID through the existing engine binding,
   then saves/finalizes through the existing lifecycle.
5. The first saved draft is associated with session+Entity. Progress is then
   derived from that instance's lifecycle state. Finalize & Next finalizes the
   same instance, returns to the same session, selects the next unresolved
   target in the snapshotted order, and starts another ordinary form.

## Tests and gates

Unit tests cover session repository project isolation/restart, working-set
snapshot/filter/sort/group, point normalization, progress derivation, and the
service’s ordinary lifecycle association. UI/navigation tests cover normal Forms
remaining available and session routing. The M7 device gate will run normal
form-first filling plus fieldwork draft/restart/resume/finalize-next, List,
Groups, Map, offline traversal, Send All, Central read-back, and cleanup on
Android/Hermes then iOS/Hermes.

## Explicit boundaries and stops

No assignment server, second Entity store, sync system, lifecycle, form runner,
XForms evaluator, XML parser, direct Entity REST mutation, proximity ordering,
offline map packs, routes, or non-point geometry will be added. Stop if the
implementation requires any of those rather than the M6 public seams.
