# Composition appearance spike

Answers two questions B-custom §1 and §5 would otherwise have inferred:

1. **Does a colon-bearing id token survive the engine?**
   `gather-composition:flower_v1` comes through **verbatim as one token** —
   the engine does not split on `:`, so `gather-composition:<id>` needs no
   escaping and no engine change.
2. **Does a plain `<group>` (not one wrapping a repeat) expose appearances?**
   Yes, on its own `group` node, and **children inherit nothing** (`[]`).

```text
group   /data/flower_analysis              ["gather-composition:flower_v1","field-list"]
input   /data/flower_analysis/petal_count  []
input   /data/flower_analysis/color        []
group   /data/plain_group                  []
input   /data/plain_group/note_a           []
```

The group-collapse seen in b-standard was specific to a `<group>` wrapping a
`<repeat>` of the same nodeset; an ordinary group is its own node.

## Consequence for the renderer

Subtree ownership cannot reuse the collection field's predicate as-is.
`visibleRenderNodes` suppresses a collection field's descendants by the prefix
`` `${reference}[` `` — the `[` of a repeat instance. A composition group's
children are `/data/flower_analysis/petal_count`, with no index, so they need
the prefix `` `${reference}/` `` instead. Findings recorded in
[docs/b-custom-composition-conventions.md](../../docs/b-custom-composition-conventions.md).

## Running it

`slimdom` is deliberately not a repo dependency — install it locally:

```bash
export PATH="/usr/local/bin:$PATH"
mkdir -p /tmp/composition-spike && cd /tmp/composition-spike
npm init -y >/dev/null && npm install slimdom

REPO=/path/to/this/repo
REPO="$REPO" \
FIXTURE="$REPO/experiments/composition-appearance/composition.xml" \
NODE_PATH=/tmp/composition-spike/node_modules \
  node "$REPO/experiments/composition-appearance/probe.mjs"
```

Same trap as the b-standard spike: raw `node.appearances` is a Set-like
iterable with a null prototype — spread it.
