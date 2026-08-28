# Make `@getodk/xforms-engine` consumable in runtimes without top-level await

## Context

We're building a native iOS/Android app for ODK Central and would like to use `@getodk/xforms-engine` as the form engine, rather than reimplementing XForms ourselves. The idea is to keep ODK and XForms as the form and data model while giving people a native mobile frontend.

This seems to line up with the direction described in the Web Forms docs — the engine/frontend split is meant to support clients other than the browser (including mobile down the road), and the custom XPath implementation was partly motivated by running outside the browser. So we wanted to see how far we could get today.

Our test setup:

- `@getodk/xforms-engine@1.0.3`
- React Native / Hermes
- `slimdom` as an XML DOM implementation
- a small adapter that fills in the few DOM selector methods the engine expects (`matches`, `querySelector`, `querySelectorAll`)

The DOM side has been encouraging. We derived the set of DOM features the engine actually uses, checked `slimdom` against it, and got our representative XForms behavior producing the same results in React Native as it does under Node + jsdom.

## The blocker

The published bundle uses top-level `await` at module scope — for example:

```js
const BLOB_BEHAVIOR = await detectBlobBehavior();
```

and:

```js
const expressionParser = await ExpressionParser.init(...);
```

These appear in both `dist/index.js` and `dist/solid.js`.

Hermes doesn't support top-level await, so Metro/Hermes can't load the published bundle as-is.

## What we tried

As a proof of concept, we wrote a build-time transform that takes the published bundle, moves that top-level `await` into an async initialization step (keeping the same behavior), and points our app at the transformed output. We didn't touch any XForms or XPath logic.

Concretely, we replaced the top-level `await` with a promise plus a small accessor, and awaited that promise at the async boundary where the value is first needed. For example:

```js
// Before — top-level await, which Hermes can't parse:
const expressionParser = await ExpressionParser.init(...);

// After — start init eagerly, but don't await at module scope:
let expressionParser;
const expressionParserReady = ExpressionParser.init(...).then((parser) => {
  expressionParser = parser;
  return parser;
});

const getExpressionParser = () => {
  if (expressionParser == null) {
    throw new Error("Expression parser has not finished initialization");
  }
  return expressionParser;
};

// ...then await the init once inside loadForm(), before the parser is used:
await expressionParserReady;
```

We applied the same pattern to the `BLOB_BEHAVIOR` value. With that in place, everything we tested passed:

- iOS and Android bundles, both debug and release
- the engine loading and running under Hermes
- our representative XForms semantic tests
- a side-by-side comparison against the unmodified engine under Node

In other words, the only thing standing between the published engine and Hermes appears to be the top-level `await` — the rest works.

## The ask

Would you be open to making the published engine usable in runtimes that don't support top-level await?

A few directions that could work:

- avoid top-level `await` at module scope in the published build;
- expose an explicit async initialization step instead;
- or ship an additional entry point aimed at non-browser/mobile runtimes.

We'd rather not maintain our own patched copy of the engine long-term if there's a portable initialization path you'd be willing to support upstream. We're happy to share the compatibility tests and the transform we built, and we'd be glad to help with a PR if there's an approach you'd prefer.
