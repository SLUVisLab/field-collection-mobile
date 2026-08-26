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
