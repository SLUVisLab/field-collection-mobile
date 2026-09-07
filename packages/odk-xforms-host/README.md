# odk-xforms-host

Runtime-neutral host contract for interacting with an ODK XForms engine.

## Purpose

This package defines the small boundary that app code depends on:

- `XFormsHost` interface class
- event type constants and guards
- structured host error type

It intentionally does **not** include React, React Native, WebView, network, persistence, or UI code.

## API surface

Exports from [src/index.js](/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/packages/odk-xforms-host/src/index.js):

- `XFormsHost`
- `XFormsHostError`
- `XFORMS_EVENT_TYPES`
- `XFORMS_HOST_ERROR_CODES`
- `createXFormsHostError(...)`
- `isXFormsEventType(...)`
- `isXFormsEvent(...)`

### `XFormsHost` methods

`initialize`, `loadForm`, `loadInstance`, `getSnapshot`, `getRenderModel`,
`setValue`, `addRepeat`, `removeRepeat`, `serialize`, `inspectMediaSeam`,
`subscribe`, `dispose`.

## Loading a saved instance: `loadInstance` (engine `restoreInstance`)

`loadInstance(xml, instanceXml, attachments?)` reopens a **previously serialized
instance** (the `xml_submission_file` XML that `serialize()` produced) back into
the engine.

It is implemented on top of the upstream `@getodk/xforms-engine`
`LoadFormResult.restoreInstance({ data: [InstanceData] })` entrypoint — an
`odk-instance-load` / "subsequent load". This is the **only correct** way to
resume saved answers:

- It is **not** a replay of `setValue` calls. Replaying values would re-fire the
  `odk-instance-first-load` computations, emit spurious state changes, and could
  not faithfully reproduce engine-managed state (repeat instances, `calculate`s,
  metadata, node ordering).
- The engine remains the single source of truth for how the serialized XML maps
  back onto live form state; the host only forwards the bytes.

`InstanceData` is a `FormData` whose `xml_submission_file` entry (a `File`,
`text/xml`) is the serialized primary-instance XML — the same shape the engine
emits from `RootNode.prepareInstancePayload()`.

## `FormRenderModel` contract (engine-derived render metadata)

`getRenderModel()` returns a `FormRenderModel` (see the typedef in
[src/index.js](/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/packages/odk-xforms-host/src/index.js)):
the **ordered, engine-derived render metadata** a native UI needs to lay out the
form. Where `FormSnapshot` answers "what is each node's current value/relevance",
the render model answers "what controls exist, in what order, with what
label/hint/type/appearance".

- `nodes` is a **flat list in engine document order** (depth-first pre-order over
  the live node tree). That ordering *is* the structural sequence; each node's
  `depth` and `parentReference` let a consumer rebuild the tree.
- Per node (`RenderNode`): `nodeType` (the engine's own control classification,
  e.g. `input` / `select` / `note` / `group` / `repeat-range:*` /
  `repeat-instance`), `label`, `hint`, `labelMedia`, `appearances` (engine parsed
  token list, in order), `selectType`, `valueType`, `choices`, `readonly`,
  `required`, and upload `mediaType` / `mediaAccept`.

Every field is projected directly from the engine's node objects. The host does
**not** parse the XForm definition into an app-side schema — engine authority is
preserved, exactly as with `FormSnapshot`.

## `FormSnapshot` contract

`FormSnapshot` (see the typedef in [src/index.js](/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/packages/odk-xforms-host/src/index.js)) is a **flat, JSON-safe projection** of the per-node state that crosses the host boundary, keyed by canonical node reference. It is **not** a mirror of the ODK XForms engine model — anything needing the full object graph goes through `XFormsHost` methods, not the snapshot.

### Runtime value vs. serialized instance value

Each node carries two deliberately distinct value fields:

| Field | Meaning | Select example |
| --- | --- | --- |
| `value` | The engine's **typed runtime value**, projected to JSON. Shape depends on `valueType`. | `["apple"]` |
| `instanceValue` | The **serialized XForms instance string**, i.e. the node's text in submission XML. | `"apple"` (`<choice>apple</choice>`) |

The engine models even a `<select1>` as a set, so a single selection is the array `["apple"]` at runtime, while the serialized instance leaf is the scalar string `"apple"`. The host must never pretend these are identical; consumers that want "what will be in the XML" read `instanceValue`, and consumers that render/compare typed state read `value`.

`value` shapes by `valueType`:

- `string` / `int` / `boolean` → `string` (`int` is the engine's `bigint` stringified, e.g. `"17"` — never `"17n"`)
- `decimal` → `number`
- `select` / `select1` → `string[]`

`valueType` and `instanceValue` are optional best-effort fields so a host can omit them when it cannot cheaply derive them. Keep this type minimal: add a field only when a snapshot consumer genuinely needs it and it is representable as plain JSON.

## Dependencies

Runtime dependencies: none.

Test/runtime tooling:

- Node.js (for `node --test`)

## Development

Run tests:

```bash
cd packages/odk-xforms-host
npm test
```
