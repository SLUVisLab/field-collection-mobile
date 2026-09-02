# A2UI FunctionCall in v0.9.1 — the actual gap, from source

**Date:** 2026-09-02
**Package:** `@a2ui/web_core@0.9.1` as installed (schema-free entries per
`patches/@a2ui+web_core+0.9.1.patch`)
**Purpose:** acceptance criterion 1 of the FunctionCall backport plan — document
the exact installed gap from source before writing anything.

> ## Correction to an earlier finding
>
> [composition-behaviour-audit.md](./composition-behaviour-audit.md) stated that
> v0.9.1 "implements **no function-call mechanism at all**", citing
> `callFunction`: 0 occurrences package-wide.
>
> **That conclusion was wrong.** `callFunction` is the *agent→renderer RPC
> message* name, which v0.9.1 indeed lacks. The **local** action shape is
> `functionCall`, and it is present and largely implemented. Searching for the
> wrong identifier produced a false negative that was then repeated in
> [milestone-roadmap.md](./milestone-roadmap.md),
> [b-custom §6](./b-custom-composition-conventions.md) and
> [components-capabilities-ownership §26](./components-capabilities-ownership.md).
> All are corrected.

## What v0.9.1 already has

| Capability | Where | Evidence |
| --- | --- | --- |
| `FunctionCall` shape `{ call, args, returnType }` | `schema/common-types.js` | `FunctionCallSchema`, described as "Invokes a named function on the client" |
| **`action.functionCall`** accepted | `schema/common-types.js` | `ActionSchema` is a union of `{event}` and `{functionCall}`, the latter described as "Executes a local client-side function" |
| FunctionCall in **value** positions | same | `DynamicBoolean`, `DynamicString`, `DynamicNumber`, `DynamicStringList` all accept a `FunctionCall` |
| Catalog-level function registry | `catalog/types.js` | `new Catalog(id, components, functions, themeSchema)`; `createFunctionImplementation(api, execute)` |
| Name resolution + **loud failure** | `catalog/types.js` | `catalog.invoker` throws `A2uiExpressionError: Function not found in catalog '<id>': <name>` |
| **Argument validation, coercion, stripping** | `catalog/types.js` | `fn.schema.parse(rawArgs)` before `execute` |
| Abort signalling | `catalog/types.js` | `fn.execute(safeArgs, ctx, abortSignal)` |
| **Async execution** | verified by spike | `execute` may return a Promise; it resolves normally |
| Argument binding from data-model paths | `rendering/data-context.js` | `resolveDynamicValue` recurses into `call.args`, so `{ path: '…' }` args already resolve |

Spikes **A** (sync) and **B** (async) are green against the installed package
with **no patch, no adapter and no fork** —
[experiments/a2ui-function-call/](../experiments/a2ui-function-call/).

## What is genuinely missing

Three things, all narrow.

### 1. Gather never registers any functions

```js
// src/a2ui/a2uiRuntime.js
const catalog = new Catalog(composition.catalogId, componentApis);
//                                                              ^ third arg omitted → functions = []
```

The mechanism was never used. This is the largest single reason the audit
mistook absence of use for absence of support.

### 2. ~~`action.functionCall` is evaluated eagerly~~ — **wrong; it is already lazy**

> **Corrected by spike, same day.** This section originally claimed action-position
> calls evaluate at prop-resolution time, read from `DataContext.resolveAction`.
> The renderer does not use that path. `GenericBinder`'s `ACTION` case returns a
> **callable**, and resolves the call inside it:
>
> ```js
> case 'ACTION': return () => { ... this.context.dispatchAction(resolveDeepSync(value)); };
> ```
>
> Driving the real binder
> ([action-spike.mjs](../experiments/a2ui-function-call/action-spike.mjs)):
>
> ```text
> calls BEFORE press : []             ← lazy
> action prop type   : function
> calls AFTER press  : [["sync",21]]  ← executes on press, arg resolved from /working/value
> press returned     : undefined
> dispatched to host : []
> data model /working: {"value":21}   ← result discarded
> ```
>
> So laziness, interaction-time execution and path-bound argument resolution are
> **all already correct**. Two source-reading errors in a row here; both were
> caught by running the thing.

### 2 (actual). The result is computed and then dropped

`rendering/data-context.js`:

```js
resolveAction(action) {
  if ('event' in action) { /* returns a resolved {event} descriptor */ }
  if ('functionCall' in action) {
    return this.resolveDynamicValue(action.functionCall);   // executes NOW
  }
}
```

So a `functionCall` in an action position runs when the prop is **resolved**,
and the prop receives the function's *return value* rather than a callable. Our
`Button` does `onPress={action}`, so an authored `action.functionCall` would
execute during render and hand `onPress` a non-callable.

That is correct for *value* positions and wrong for "run this when pressed",
which is what v1's `action.functionCall` means. **This is the real semantic
gap**, and it is Gather-side interceptable: the host can read the component
model's raw action and defer invocation itself, keeping us at approach #1
(adapter above `web_core`) with no patch.

`state/surface-model.js` cooperates — `dispatchAction` handles `{event}` and
deliberately ignores `{functionCall}`, commenting that local function calls are
"handled by the renderer or binder". The renderer is *expected* to own this.

### 3. No result destination — the same gap, stated as the fix

`resolveAction` returns the result to its caller; nothing writes it into the
data model. So `imageSegment(...) → /working/segmentation` has no upstream
mechanism in the action position.

**Before inventing syntax, note that upstream may intend a different model.**
Because FunctionCall is legal in `DynamicValue` positions, the sanctioned
pattern may be *reactive pull* — bind a property directly to a function call and
let the binder re-evaluate — rather than *imperative push* to a path. The
`isSignal(result) ? result.peek() : result` handling in `resolveDynamicValue`
and the `evaluateFunctionReactive` naming both point that way.

That is a genuine design fork, and the plan says to stop and document rather
than add syntax. **Stopping here.**

## Consequence for the plan

The plan's premise — *"add renderer-local FunctionCall execution"* — is
substantially already satisfied upstream. After both corrections, what remains
is only:

1. **register** Gather capabilities as catalog functions, with an A2UI-safe id
   mapping (`image.segment` → `image_segment`), because Gather never passed a
   third argument to `new Catalog(...)`;
2. ~~defer action calls to interaction time~~ — **already correct**;
3. a **result destination** so a user-triggered call's return value reaches
   composition state, including *awaiting* it: `resolveDeepSync` does not await,
   so an async capability currently yields a dropped Promise.

Items 1 and 2 need no upstream change. Item 3 is the architectural question.

## Removal condition

Unchanged in spirit, but narrower: retire the Gather deferral shim when an
upstream runtime evaluates `action.functionCall` on interaction rather than on
resolution, and passes Gather's composition execution gates.

## Slice 1 — landed 2026-09-02

[`src/a2ui/capabilityFunctions.js`](../src/a2ui/capabilityFunctions.js) bridges
Gather Capabilities into A2UI's existing registry:

```text
capability definition (portable, native-free)  →  A2UI FunctionDefinition
capability runtime entry (executable)          →  A2UI execute()
```

`createA2uiRuntime` and `A2UIHost` now accept `functions` and pass them as the
third `Catalog` argument — the omission that made a present mechanism look
absent.

**Id mapping.** Capabilities keep their semantic dotted ids; only the wire name
is aliased, `.` → `_` (`image.segment` → `image_segment`). The mapping is
deterministic and reversible because `defineCapability` forbids underscores, and
`a2uiFunctionId` refuses anything it could not reverse rather than aliasing
ambiguously.

**The capability's own input schema is the wire validation.** `catalog.invoker`
calls `schema.parse(rawArgs)` before `execute`, so there is no second schema to
drift.

**Only implemented capabilities are advertised.** A definition with no runtime
entry is not registered — advertising a function the runtime cannot execute
would make the catalog lie to the Composer agent and fail at press time instead
of build time.

**`returnType`** is derived from the output schema and degrades to `'any'`
rather than guessing; it is advisory metadata for authors, not runtime coercion.

### Verified

Eight tests, including **Spike C** — the real `measure.area` implementation
executing through `catalog.invoker` — and the full authored path: a `Button`
whose `action.functionCall` names `measure_area` with a `{ path }` argument runs
nothing until pressed, then executes the capability with the argument resolved
from the data model.

The Capability itself remains ignorant of A2UI: it takes serializable input and
returns serializable output. Placing that output into composition state is
Slice 2's job, and the renderer's — not the Capability's.

## Slice 2 — landed 2026-09-02

[`src/a2ui/actionAdapter.js`](../src/a2ui/actionAdapter.js) is the **named seam**
for Gather's one divergence, wired in `bindInstrumentComponent`:

```text
raw component action
        │
  no ───┴──→ upstream GenericBinder ACTION path, untouched
 (event)     │
            yes (functionCall)
             ↓  resolve args via context.dataContext.resolveDynamicValue
             ↓  context.dataContext.functionInvoker(...)
             ↓  await
             ↓  validate serializable
             ↓  context.dataContext.set(resultPath, result)
```

**Gather owns execution of action-position FunctionCalls. `web_core` keeps
ordinary bindings, value-position FunctionCalls, and event dispatch.** That is
the whole divergence, and `state/surface-model.js` explicitly leaves local
function calls to the renderer, so this implements a renderer responsibility
Gather's binding layer had omitted rather than working around upstream.

### The one wire extension

`resultPath`, a sibling of `functionCall` inside an action, is **optional**:

| Form | Meaning |
| --- | --- |
| `functionCall` alone | execute, await, discard the return — the `gather_completeComposition` shape |
| `functionCall` + `resultPath` | execute, await, store — the `measure_area` / `image_segment` shape |

It needs **no schema change**: component properties survive message processing
raw, so an unknown key is neither stripped nor rejected. Verified by test.

`resultPath` belongs to the adapter, never to the Capability — `measure.area`
returns a number and knows nothing about where it lands.

### Guardrails, each covered by a test

- **Lazy and always async**, so a synchronous capability works through the same
  path.
- **Arguments resolve through the existing context**, so path/literal semantics
  cannot drift from value-position calls.
- **Failure writes nothing.** Argument resolution, execution and result
  validation all complete before `resultPath` is touched; errors surface through
  `dispatchExpressionError` rather than being swallowed.
- **Serializability is enforced before mutation** — functions, symbols, bigints,
  non-finite numbers, Promises (something was not awaited), class instances
  (a native handle) and cycles are all refused.
- **Writes use `dataContext.set`**, the context's own setter, so path semantics
  match every other write and no v1 `null`-deletes-key behaviour leaks in.

### Deliberately not here

Sequencing. One gesture → one FunctionCall → one awaited result → optional
write. No `call → set → call → branch` chains. If Segment & Measure later proves
authored sequencing is needed, that is its own decision.

### Verified

21 tests across the adapter and the bridge, including an **end-to-end** case
through the real binder: an authored `Button` whose action names `measure_area`
with a `{ path }` argument and `resultPath: '/working/area'` runs nothing until
pressed, then lands `{ value: 1234, unit: 'px^2' }` — from the real
`measure.area` implementation — in composition state.

### Removal condition

Delete `actionAdapter.js` and the `useFunctionCallActions` interception when an
upstream A2UI runtime executes action-position FunctionCalls with an equivalent
result destination, and passes Gather's composition execution gates.

## Slice 3 — host functions, landed 2026-09-02

```text
measure_area, image_segment, …   → gather-capabilities      (application-independent)
gather_persistAsset              → Gather media lifecycle   (instance-specific)
gather_completeComposition       → Gather/XForms lifecycle  (instance-specific)
```

Both kinds enter the same `Catalog.functions`, so an authored composition sees
one uniform mechanism — but ownership stays distinct, which is why
[`hostFunctions.js`](../src/a2ui/hostFunctions.js) sits *beside*
`capabilityFunctions.js` rather than inside it.

Capability implementations are largely application-independent. Host functions
are not: they need the live instance, its media store and ledger, the resolved
field's binding manifest and the Accept lifecycle. So their implementations are
**injected by whoever holds that context** — `XFormsCompositionControl` — never
imported as module singletons.

### `gather_persistAsset`

Capture descriptor in, durable `ImageAsset` out. It knows nothing about what
happens afterwards; an authored composition decides that with `resultPath`:

```text
CameraView capture → gather_persistAsset → resultPath: /working/image
```

`retention` is an optional authored argument, never inferred (b-custom §4).

### `gather_completeComposition`

Takes **only** the composition's declared output values, resolved from
composition state. It structurally **cannot be told where they go**: the args
schema is `.strict()` with a single `outputs` key, so an authored action naming
XForms references — `bindings`, `reference`, a stray `resultPath` — is a loud
validation failure rather than a silently ignored key. The form's binding
manifest owns that mapping.

Normally authored with **no `resultPath`**, because completion is the side
effect.

**The host mints the receipt.** An authored composition has no handler to
produce provenance, so the control builds an `ExecutionReceipt` from the
composition's identity and declared outputs — consistent with "computed means
produced by the composition, not by a model".

### `resultPath` hardening

Upstream deliberately preserves unknown action properties rather than validating
them, so nothing but Gather will catch a typo. `assertResultPath` runs when the
handler is built — before any invocation or write — and rejects a non-string,
empty, relative, trailing-slash or empty-segment path.

**For Composer:** `resultPath` is a Gather extension to an A2UI v0.9.1 action
FunctionCall. It stores the awaited serializable return value in composition
state. It disappears if upstream gains equivalent semantics.

### Still open

Registration and execution are proven; **an authored composition completing into
a real XForms instance is not yet demonstrated end to end on a device.** That is
the step that closes composition portability, as distinct from the capability
execution chain proven above. Sequencing remains deliberately untouched.

## Component output → composition state — solved upstream (2026-09-02)

Preparing the handler-free proof hit the **first** diagnostic category, not
sequencing: `CameraView` emitted its capture as an *event*
(`GATHER_ACTION_IDS.capture`), which needs a registered handler. Handler-free,
the capture went nowhere — so an authored composition could not use the camera
at all.

**Upstream already solves this.** `GenericBinder` injects a `set<Prop>` writer
for any `DynamicValue` prop bound to a path — the same mechanism a `TextField`
uses for `value`:

```js
const setterName = `set${k.charAt(0).toUpperCase() + k.slice(1)}`;
result[setterName] = (newValue) => { …dataContext.set(rawPropValue.path, newValue); };
```

Proven for a top-level prop:

```text
props      : capture, setCapture
setCapture : function
data model : {"uri":"file:///shot.jpg","contentType":"image/jpeg"}
```

So `cameraViewApi` gains an optional `capture` DynamicValue prop, and the
implementation calls `setCapture(descriptor)`. **No Gather extension.** The
event is kept alongside it: `setCapture` serves authored compositions, the event
serves registered ones whose handler owns the flow, and the two are independent.

### A bug this exposed in the action adapter

Argument resolution was only one level deep. `gather_completeComposition` is
authored as `outputs: { image: { path: … }, count: { path: … } }`, so the host
would have received unresolved `{ path }` objects. `resolveArgsDeep` now mirrors
upstream's `resolveDeepSync`, walking plain objects and arrays and resolving
`{ path }` / `{ call }` leaves.

### Taxonomy after this

| Requirement | State |
| --- | --- |
| Component output → composition state | **solved** — upstream binder setter |
| one user action → one function | solved |
| function result → composition state | solved — `resultPath` |
| state → Flow/View | solved — existing bindings |
| one user action → several ordered operations | **sequencing, deliberately unsolved** |
