# A2UI FunctionCall spike (v0.9.1, as installed)

Answers acceptance criterion 1 of the FunctionCall backport plan — *"exact
installed v0.9.1 gap is documented from source"* — and runs Spikes A and B.

## Run

```bash
export PATH="/usr/local/bin:$PATH"
node experiments/a2ui-function-call/spike.mjs
```

Imports the **schema-free** entry (`@a2ui/web_core/v0_9/catalog`) that the app
uses; the package root uses import attributes Node 20.4 cannot parse, which is
the same constraint `patches/@a2ui+web_core+0.9.1.patch` exists for.

## Result — Spikes A and B are green with no patch, adapter or fork

```text
registered: [ 'testDouble', 'testAsyncDouble' ]
sync  testDouble(21) = 42
async returns a Promise? true
async awaited        = 42
unknown throws: A2uiExpressionError | Function not found in catalog 'spike': nope
bad args throws:  A2uiExpressionError | Validation failed for function 'testDouble'
extra args stripped  = 10
```

So the registry, argument validation and coercion, loud failure on unknown
functions, and async execution are **already implemented upstream**.

Findings are written up in
[docs/a2ui-functioncall-gap.md](../../docs/a2ui-functioncall-gap.md).
