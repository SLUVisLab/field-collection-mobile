# Appearance parameter spike

Answers: **do `key=value` appearance tokens survive into the engine's
`appearances`, and where must they be placed on a repeat?** Findings are in
[docs/b-standard-field-conventions.md](../../docs/b-standard-field-conventions.md).

Short answers: tokens survive verbatim in source order; either the `<group>` or
the `<repeat>` works alone, but the **group wins** when both carry appearances.

`placement.xml` — the same tokens on the repeat (variant 1) and on the group
(variant 2). `precedence.xml` — both carrying appearances, plus standard
(`multiline`, `minimal`) and custom tokens on ordinary controls.

## Running it

`slimdom` is deliberately not a repo dependency — install it locally, the way
`m8-model-export` keeps its virtualenv out of the tree:

```bash
export PATH="/usr/local/bin:$PATH"
mkdir -p /tmp/appearance-spike && cd /tmp/appearance-spike
npm init -y >/dev/null && npm install slimdom

REPO=/path/to/this/repo
REPO="$REPO" \
FIXTURE="$REPO/experiments/appearance-parameters/placement.xml" \
NODE_PATH=/tmp/appearance-spike/node_modules \
  node "$REPO/experiments/appearance-parameters/probe.mjs"
```

## Trap

Raw engine `node.appearances` is a Set-like iterable with a null prototype:
`constructor` is undefined, `.size` is falsy, and `JSON.stringify` gives `{}`.
Spread it. The WebView sidecar already normalizes it to a `string[]`, so this
only bites in raw-engine contexts.
