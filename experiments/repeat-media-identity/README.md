# Repeat media identity spike

Answers: **are repeat-bound media identities unique *and stable* under repeat
mutation?** Findings are in
[docs/repeat-media-identity-characterization.md](../../docs/repeat-media-identity-characterization.md).

Short answer: unique yes, stable **no** — and the failure mode is a silent wrong
attachment, not a collision.

## Running it

The spike drives the real `@getodk/xforms-engine` in Node, which needs a DOM.
`slimdom` is **not** a repo dependency — install it locally, the way
`m8-model-export` keeps its virtualenv out of the tree:

```bash
export PATH="/usr/local/bin:$PATH"
mkdir -p /tmp/repeat-spike && cd /tmp/repeat-spike
npm init -y >/dev/null && npm install slimdom

REPO=/path/to/this/repo
REPO="$REPO" \
FIXTURE="$REPO/experiments/repeat-media-identity/form.xml" \
NODE_PATH=/tmp/repeat-spike/node_modules \
  node "$REPO/experiments/repeat-media-identity/spike.mjs"
```

It reuses the DOM shim already in
`archive/experiments/m2-slimdom-xforms/installDomCompatibility.js`.

## Promote this to a test

Once media identity no longer derives from XPath position, this belongs in the
suite so the regression cannot silently return. It needs `slimdom` as a real
devDependency at that point.
