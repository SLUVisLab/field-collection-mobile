# M3 React Adapter — Runtime Gate Report

**Date:** 2026-08-26
**Engine:** `@getodk/xforms-engine@1.0.3` (loaded in WebView sidecar)
**Verdict:** ✅ **GREEN** on both iOS and Android (Hermes).

## Result summary

| Platform | Device | Hermes | Steps OK | Checks OK | `ok` |
|----------|--------|--------|----------|-----------|------|
| iOS      | iPhone 16 (iOS 18.4) | true | 10/10 | 10/10 | **true** |
| Android  | Pixel_3a API 34 (arm64) | true | 10/10 | 10/10 | **true** |

Raw results: [`m3-ios-runtime-result.json`](./m3-ios-runtime-result.json), [`m3-android-runtime-result.json`](./m3-android-runtime-result.json)

## Semantic checks (old M3 criteria)

All ten passed identically on both platforms:

| Check | Meaning | Result |
|-------|---------|--------|
| `valuesUpdated` | `setValue('/data/age', 17)` reflected in hook state (`age === "17"`) | ✅ |
| `calculateUpdated` | `calc` recomputed to `19.5` (age/2 + height calc) | ✅ |
| `relevanceUpdated` | `/data/extra` became relevant after `show_extra=1` | ✅ |
| `constraintUpdated` | `age=17` violates `>=18` constraint (`constraintValid === false`) | ✅ |
| `requiredReflected` | `/data/name` reported `required === true` | ✅ |
| `readonlyReflected` | `/data/readonly_note` reported `readonly === true` | ✅ |
| `choiceReflected` | select value is `["apple"]` (array shape per engine) | ✅ |
| `repeatUpdated` | `addRepeat('/data/rep')` grew instance count 1 → 2 | ✅ |
| `serializationHasFixture` | serialized XML contains form id `m2_4_fixture` | ✅ |
| `mediaReferenceModel` | media seam returns logical-reference note | ✅ |

## Root-cause fixes (source-driven, from local engine 1.0.3)

The prior YELLOW state was caused by three host-contract mismatches, all resolved
against the pinned engine source rather than by adjusting assertions:

1. **Repeat add failed with `No repeat instance at index 1`.**
   - Cause: sidecar called `addInstances(1)`, but
     [`RepeatRangeUncontrolled.addInstances(afterIndex = getLastIndex(), count = 1)`](../../../node_modules/@getodk/xforms-engine/src/instance/repeat/RepeatRangeUncontrolled.ts)
     treats the first arg as `afterIndex`. With one template instance, index 1 does not exist →
     [`BaseRepeatRange` throws](../../../node_modules/@getodk/xforms-engine/src/instance/repeat/BaseRepeatRange.ts).
   - Fix: call `addInstances()` (append at last index). Removed the heuristic
     multi-candidate retry loop; the exact repeat node is now resolved by reference and
     `removeInstances(startIndex, 1)` uses a computed last-child index.

2. **`age` serialized as `"17n"` (BigInt artifact).**
   - Cause: `int` runtime values are `bigint | null`
     ([`IntValueCodec`](../../../node_modules/@getodk/xforms-engine/src/lib/codecs/IntValueCodec.ts)),
     and the sidecar appended an `"n"` suffix when stringifying.
   - Fix: `serializeValue` emits the plain decimal string. Snapshot now also carries
     `valueType` and `instanceValue` for JSON-safe, reversible transport.

3. **`choice` value shape mismatch.**
   - Cause: `SelectNode` (even `<select1>`) exposes `value: readonly string[]`
     ([`SelectNode.ts`](../../../node_modules/@getodk/xforms-engine/src/client/SelectNode.ts)),
     and choices come from `valueOptions`, not a `choices` property.
   - Fix: choices are read from `currentState.valueOptions` (label via `label.asString`);
     select setter uses `selectValues(...)` for arrays and `selectValue(null)` for clears;
     the harness expects an array value.

## How the gate was executed (deterministic completion)

- Reused the already-installed dev builds (JS-only change → no native rebuild).
- Started Metro once; the app streams `console.log` markers to the Metro log (iOS) and
  logcat `ReactNativeJS` (Android).
- Polled the log for the terminal marker `M3_RUNTIME_RESULT::`, which the harness emits
  exactly once after all steps + checks complete — giving a clean "finished" signal
  instead of relying on runner-process lifecycle.

## Serialized instance (both platforms)

```xml
<data id="m2_4_fixture"><name/><age>17</age><height>2.5</height><calc>19.5</calc>
<show_extra>1</show_extra><extra/><readonly_note>fixed</readonly_note><choice>apple</choice>
<fruit><item><name>Apple</name><value>apple</value></item></fruit>
<rep><note/><qty/></rep><rep><note/><qty/></rep>
<meta><instanceID>uuid:...</instanceID></meta></data>
```

Two `<rep>` instances confirm repeat growth; `<choice>apple</choice>` and `<age>17</age>`
confirm value/int normalization.

> Note: `serializeResult.status` is `pending` with `violationCount: 4` — expected, since the
> fixture intentionally leaves required/constraint-violating fields (e.g. empty `name`,
> `age=17`) to exercise validation. This is a validation state, not a serialization failure.
