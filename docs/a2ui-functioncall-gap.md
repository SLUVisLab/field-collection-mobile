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

### 2. `action.functionCall` is evaluated **eagerly**, not on interaction

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

### 3. No result destination for an action-position call

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
substantially already satisfied upstream. What remains is:

1. register Gather capabilities as catalog functions (plus the A2UI-safe id
   mapping, since `image.segment` may not be a legal function identifier);
2. defer `action.functionCall` to interaction time in the Gather host;
3. decide result consumption — reactive-pull vs a minimal result destination.

Items 1 and 2 need no upstream change. Item 3 is the architectural question.

## Removal condition

Unchanged in spirit, but narrower: retire the Gather deferral shim when an
upstream runtime evaluates `action.functionCall` on interaction rather than on
resolution, and passes Gather's composition execution gates.
