# Testing Strategy Foundation — From Acceptance Gates to Durable Regression Coverage

> **Status: executed.** Every historical gate in both repositories has been
> decomposed. The convention that came out of it is `docs/testing.md` in
> openfieldworks-web; this document is the reasoning behind it, kept because the
> reasoning is what makes the next decomposition cheap.
>
> Section 4 was revised during the pilot — see it for what changed and why.
>
> ```text
> gather/          test/unit  ..  test/integration  ..  test/rehearsal
> openfieldworks/  test/unit  ..  test/behavior  ..  test/integration
>                  test/environment  ..  test/rehearsal
> ```

## Purpose

As Gather and the OpenFieldWorks Composer have grown, the term **gate** has started doing too many jobs.

During development, a gate has been useful as:

> **The evidence required to declare a milestone or sub-goal complete.**

That is still useful. What should change is what happens **after** a gate turns green.

Many historical gates have gradually become permanent regression tests even though they are often:

- full-stack;
- browser-heavy;
- timing-sensitive;
- slow;
- flaky;
- broader than the behavior they are trying to protect.

This document establishes a simpler, durable testing foundation that we can build on as the project grows.

The governing principle is:

> **Acceptance gates are temporary evidence for declaring work complete. Once a goal is green, preserve its important promises using the cheapest durable test capable of proving each promise. Keep only a small number of full-stack rehearsals.**

---

# 1. Testing lifecycle

Use this lifecycle for milestones and sub-goals:

```text
milestone / sub-goal
        ↓
acceptance criteria
        ↓
acceptance run / gate
        ↓
GREEN
        ↓
extract durable promises
        ↓
regression coverage
  ├── unit / contract tests
  ├── behavior tests
  └── targeted integration tests
        ↓
retain only a few full-stack rehearsals
```

A successful acceptance run should therefore be treated as **input to the permanent test suite**, not automatically as the permanent test suite itself.

---

# 2. Keep all tests under `test/`

As part of this refinement, consolidate executable test code under a top-level `test/` directory in each relevant repository.

Do not continue placing tests beside implementation files under `src/`.

Keep the initial organization intentionally simple:

```text
test/
├── unit/
├── behavior/
├── integration/
├── rehearsal/
├── fixtures/
└── support/
```

Use only the directories that are actually needed in a repository.

For example, a small package may initially have only:

```text
test/
├── unit/
└── fixtures/
```

while the wrapper may use:

```text
test/
├── unit/
├── behavior/
├── integration/
├── rehearsal/
├── fixtures/
└── support/
```

Do not create deeper taxonomies until the volume of tests justifies them.

## Directory meanings

### `test/unit/`

Fast tests of:

- pure functions;
- domain logic;
- contracts;
- invariants;
- parsing;
- validation;
- deterministic transformations.

### `test/behavior/`

User-facing product behavior, as executable Playwright scenarios named in
product language. See section 4 — these are the specification, not a mapping to
one held somewhere else.

### `test/integration/`

Targeted tests of real boundaries between subsystems.

Examples:

- wrapper ↔ editor;
- editor ↔ renderer;
- ORT-Web execution;
- OpenCV.js execution;
- package → install → model store;
- Central proxy behavior.

### `test/rehearsal/`

A very small number of full workflows that prove the assembled product still works end to end.

These are intentionally slower and should not carry every regression assertion.

### `test/fixtures/`

Shared deterministic inputs such as:

- masks;
- images;
- model metadata;
- Central API responses;
- composition documents;
- package fixtures.

### `test/support/`

Shared test helpers such as:

- browser setup;
- test servers;
- fixture loaders;
- fake HTTP routes;
- DOM helpers;
- environment helpers.

Do not turn `support/` into a second application framework.

---

# 3. Testing taxonomy

We want four durable categories.

---

## A. Unit / contract / invariant tests

These are ordinary programmatic tests.

Characteristics:

```text
fast
deterministic
narrow
no browser unless intrinsically necessary
no remote service
no full application boot
```

Examples:

```text
modelRevisionFor(package) matches package identity
duplicate ZIP entries are rejected
CAPABILITY_DEFINITIONS are covered by both runtimes
inspectComposition identifies occurrences correctly
setModelSelection refuses dynamic bindings
bindCompositionOutputs reports TYPE_MISMATCH
ContextSourceNotSelected is thrown when appropriate
```

These should remain normal tests.

Do **not** rewrite implementation invariants in scenario language merely for
stylistic consistency.

Bad:

```text
Given there are eight Capability definitions
When the runtime registries are inspected
Then all eight appear in both registries
```

That is an implementation invariant and belongs in `test/unit/` or a narrow integration test.

---

## B. User-facing behavior tests

These describe what a researcher can see, do, or depend upon, and they are
written as executable Playwright scenarios in product language — see section 4,
which revises this. The scenario name is the promise; the body is the proof.

```js
test('failed authentication never falls back to development data', async ({ page }) => {
  await givenCentralRejectsTheCredentials(page);

  const tone = await whenTheResearcherConnectsToCentral(page, { password: 'wrong' });

  expect(tone).toBe('error');
  await thenNoProjectsAreListed(page);
  await thenDevelopmentDataIsNotDisplayed(page);
});
```

```js
test('stages a Tool to an existing form draft without publishing it', async ({ page, central }) => {
  await givenAProjectAndFormAreSelected(page);
  await givenThePackageIsBuilt(page);

  await whenTheResearcherStagesTheTool(page);

  thenTheAttachmentWasUploaded(central, 'segment_and_measure_v1.gather');
  thenTheFormWasNotPublished(central);
});
```

Some promises are only observable from the server side. "Gather never publishes
a form" cannot be seen in the DOM — it is seen by no request for it ever
arriving, which is why the stub Central's request log is a first-class thing a
test can read.

These specifications should live under:

```text
test/behavior/
```

A simple initial shape is:

```text
test/behavior/
├── central-context.test.mjs
├── library.test.mjs
├── function-gallery.test.mjs
├── review.test.mjs
└── publish.test.mjs
```

Do not over-segment these files yet.

---

## C. Targeted integration tests

Integration tests prove real boundaries that cannot be meaningfully covered by units alone.

Examples:

```text
wrapper → editor postMessage contract
editor → renderer Catalog delivery
generated Function usage → real web Capability runtime
real ORT-Web segmentation
real OpenCV.js measurement
package bytes → installTool → modelStore
local /central-api/staging proxy → Central-shaped HTTP service
nested iframe CSP topology
```

Each integration test should ideally prove **one important boundary**.

Avoid integration tests that boot the entire product merely to verify one local rule.

---

## D. Rehearsals

A rehearsal is a deliberately small number of slow, full workflows.

The canonical Composer rehearsal might be:

```text
Connect to Central
→ select project
→ select form
→ slot auto-selected
→ open first-party Tool
→ confirm/select model
→ provide sample image
→ real segmentation
→ real measurement
→ Review typed mappings
→ package ready
→ form ready
→ stage package to Central form draft
→ never publish form
```

A rehearsal proves that the assembled system still works across boundaries.

It is **not** where every regression promise should live.

There should be very few rehearsal tests.

---

# 4. Behavior tests are executable Playwright scenarios

**Revised during the pilot.** This section originally proposed `.feature` files
as the canonical product-behavior specification, with executable tests mapped to
each scenario.

The audit it asked for was done, and a scenario-mapped Gherkin runner was built
and working — roughly 120 lines, no Cucumber, mapping enforced in both
directions so a scenario without an implementation failed. It was then removed,
because it did not earn the second representation:

```text
Gherkin scenario -> mapping -> Playwright implementation
```

when this says the same thing once:

```text
Playwright behavior test = executable specification
```

The stated worry was that Gherkin scenarios must not become dead prose that
drifts from what the browser actually verifies. Deleting the prose is the
strongest available answer to that.

**The rule:**

> Behavior tests are executable Playwright scenarios written in product
> language. Gherkin-style Given/When/Then is a writing convention when useful,
> not a separate test format.

Given/When/Then survives in `test/support/steps.mjs` as ordinary functions named
the way a researcher would describe what they are doing. There is no step
registry, no regular-expression matching and no world object, so "go to
definition" works:

```js
test('stages a Tool to an existing form draft without publishing it', async ({ page, central }) => {
  await givenAProjectAndFormAreSelected(page);
  await givenThePackageIsBuilt(page);

  await whenTheResearcherStagesTheTool(page);

  thenTheAttachmentWasUploaded(central, 'segment_and_measure_v1.gather');
  thenTheFormWasNotPublished(central);
});
```

Using the Playwright **runner** rather than only its browser driver is what
makes the rest of the section's goals real: scenario names in output, failures
tied to one behavior, and traces and screenshots retained on failure without
anyone building that.

`.feature` files come back only if a concrete audience appears that reviews
behavior specifications without reading JavaScript. Right now they would be
ceremony.

# 5. Behavior tests must inspect rendered behavior

A recent Library defect demonstrated why store-level assertions are not enough:

```html
<ul class="library">undefinedundefinedundefined</ul>
```

The underlying Library state was correct, while the visible interface was broken.

Therefore:

> **A user-facing state transition is not behavior-tested until the rendered interface represents it correctly.**

Behavior tests should assert things such as:

```text
visible labels
visible rows
selected values
enabled / disabled actions
readiness states
errors
unknown / not-checked states
navigation results
copyable JSON
```

Avoid brittle assertions against incidental CSS classes or exact layout unless those details are themselves part of the behavior.

Example:

```gherkin
Feature: Starter Tools

  Scenario: First-party starter Tools are visible
    Given the starter catalog contains the first-party Tools
    And this browser has not seeded those starters before
    When the researcher opens Library
    Then "Quadrat Tally" is visible
    And "Segment and measure" is visible
    And "Authored photo" is visible
```

The executable test should inspect the visible DOM, not only `library.list()`.

---

# 6. Decompose green acceptance gates

When an acceptance gate becomes green, do not automatically keep the entire gate as a permanent test.

Instead:

```text
gate GREEN
    ↓
list the important promises it proved
    ↓
classify each promise
    ↓
move it to the cheapest durable layer
```

For each promise, choose:

```text
unit / contract
behavior
targeted integration
rehearsal
```

## Example decomposition

Suppose the acceptance run is:

```text
connect
→ projects
→ form
→ slot
→ Tool
→ model
→ sample
→ segmentation
→ measurement
→ Review
→ package
→ stage
```

The permanent regression suite might become:

```text
Central auth failure behavior
→ behavior test + deterministic browser HTTP responses

project/form/slot selection
→ behavior test

Library rendering
→ behavior test, asserting rendered DOM

inspectComposition
→ unit

model-selection semantics
→ unit + small behavior test

binding/type mismatch
→ unit + Review behavior test

package closure
→ unit / targeted integration

ORT-Web execution
→ one targeted integration test

OpenCV parity
→ fixture-based integration / contract test

editor ↔ renderer bridge
→ one targeted browser integration test

whole workflow
→ one rehearsal
```

This prevents unrelated changes from repeatedly paying the cost of OpenCV, ORT, nested iframes, and Central-shaped HTTP just to validate a small UI behavior.

---

# 7. Audit the current historical gates

Inventory the actual current gate scripts.

Examples may include:

```text
gate:central-context
gate:starters
gate:lifecycle
composer-bridge
tool-preview
gather-package
vertical-slice / rehearsal gates
```

Do not assume this list is complete.

For each gate, document:

This was done. The result:

| Gate | Original purpose | Where its promises went |
|---|---|---|
| central-context | Real Central context works | unit (client surface), behavior (source is a mode, failed auth shows nothing), integration (proxy topology) |
| starters | The Library seeds itself once | unit (seed-once bookkeeping), behavior (rendered rows), environment (the deployed origin may fetch starters) |
| lifecycle | Draft lifecycle through the Composer | integration (autosave, invalid JSON, byte-identical reload) — the Library CRUD rules were already unit-tested |
| models | Model selection works | unit (authoring API version), integration (selection against the real renderer) |
| environment | Deployment configuration | environment, as its own tier |
| rehearsal | The assembled product works | rehearsal, unchanged and singular |
| tool-preview | An authored Tool executes | integration |
| gather-package | `.gather` v2 works | rehearsal (install + execute in a browser) — packing, determinism, portability and refusals were already unit-tested |
| composer-bridge | The bridge protocol holds | integration |
| function-browser | The Function gallery works | integration |
| model-lab | Real browser inference | integration |
| agent-authoring | Can an agent author a Tool? | not a test — an experiment, `npm run experiment:agent-authoring` |

Three things surfaced that were not test-moving work:

```text
tool-preview   an assertion that compared a value to itself and could not fail
gather-package three byte-identical copies of one 34-line bridge harness
publishPanel   a staging confirmation erased by an unrelated rebuild (fixed)
```

The question for every assertion is:

> **What durable promise does this assertion prove, and what is the cheapest reliable layer that can prove it?**

Do not preserve assertions merely because they existed in the original gate.

---

# 8. Start with a small pilot

Do not reorganize the entire test suite in one pass.

Use one or two existing broad gates as the pilot.

Recommended:

```text
central-context
starters / lifecycle
```

These are good candidates because they already mix:

```text
domain state
browser rendering
HTTP behavior
timing
```

For each pilot:

1. State what the gate originally accepted.
2. List the durable promises it proves.
3. Classify those promises.
4. Move pure rules into unit/contract tests.
5. Add executable behavior scenarios for user-facing behavior.
6. Retain only necessary targeted integration coverage.
7. Decide whether any remaining end-to-end portion deserves to remain as a rehearsal.
8. Remove or demote redundant assertions from the original gate.

Do not migrate every historical M10/M11 gate until this pilot structure feels good.

---

# 9. Test execution classes

Keep the initial execution model simple.

We want roughly:

```text
unit
behavior
integration
rehearsal
live
```

Tags can be added where the runner benefits from them, but directory and script organization should do most of the work initially.

Possible tags:

```text
@fast
@browser
@integration
@slow
@live
@rehearsal
```

Do not build an elaborate tagging system before we need one.

---

# 10. When to run what

Create a short developer testing guide.

The intended workflow should be obvious.

## Normal coding / inner loop

Run:

```text
relevant unit tests
relevant behavior scenario
```

Target:

```text
seconds to low minutes
```

---

## Before committing a feature or sub-goal

Run:

```text
full unit suite
relevant behavior suite
relevant targeted integrations
```

---

## When closing a milestone STOP / acceptance goal

Run the acceptance run needed to prove the goal is complete.

Then immediately perform the decomposition step:

```text
acceptance run GREEN
→ identify durable promises
→ add/move regression coverage
→ classify the old gate as:
     retire
     targeted integration
     rehearsal
```

A STOP is not fully closed until this has been considered.

---

## Merge / CI

Prefer mandatory CI coverage from:

```text
unit / contract
deterministic behavior
stable targeted integrations
```

Do not make flaky remote/live rehearsals mandatory merge blockers merely because they exist.

---

## Before a demo, release, or major architecture change

Run:

```text
rehearsal suite
```

and any explicitly relevant live tests.

---

# 11. Live tests must be explicit

Real Central, deployed renderers, and other network-dependent systems can provide valuable evidence.

They should not become accidental default dependencies.

Prefer:

```text
normal behavior
→ deterministic local/stubbed responses

live verification
→ explicit command + explicit environment
```

Conceptually:

```bash
npm run test:unit
npm run test:behavior
npm run test:integration
npm run test:rehearsal

CENTRAL_UPSTREAM=...
CENTRAL_EMAIL=...
CENTRAL_PASSWORD=...
npm run test:live:central
```

Exact names should follow repository conventions after audit.

Never silently switch a normal test into live mode merely because credentials are available in the environment.

---

# 12. Flakiness is usually a scope problem first

When a test intermittently fails because of:

```text
renderer startup
nested iframe readiness
OpenCV load
ORT cold start
remote HTTP timing
```

first ask:

> Does the behavior under test actually require this dependency?

Often the correct fix is:

```text
extract the durable behavior to a deterministic lower-level test
keep one integration/rehearsal that owns the expensive boundary
```

Do not solve generalized flakiness with larger arbitrary sleeps.

When asynchronous readiness is genuinely required, wait for the semantic condition.

Prefer:

```text
wait for renderer device frame ready
```

over:

```text
sleep 10 seconds
```

---

# 13. Acceptance criteria remain in milestone documents

Do not remove acceptance criteria from M11 or future milestone documents.

They serve a different purpose from regression tests.

Use this vocabulary:

```text
Acceptance criteria
→ definition of done

Acceptance run / gate
→ evidence used to declare work GREEN

Regression tests
→ durable guarantees after GREEN

Rehearsal
→ assembled-system confidence
```

We can still say:

```text
M11 GREEN
STOP C complete
```

But `gate:*` should no longer automatically mean:

> permanent test that runs forever.

---

# 14. Suggested initial repository structure

Keep the first reorganization modest.

For the wrapper, something like:

```text
apps/wrapper/
├── src/
├── test/
│   ├── unit/
│   ├── behavior/
│   │   ├── central-context.feature
│   │   ├── central-context.test.mjs
│   │   ├── library.feature
│   │   └── library.test.mjs
│   ├── integration/
│   │   ├── composer-bridge.test.mjs
│   │   └── central-proxy.test.mjs
│   ├── rehearsal/
│   │   └── composer-vertical-slice.test.mjs
│   ├── fixtures/
│   └── support/
└── package.json
```

For Gather/domain packages:

```text
packages/<package>/
├── src/
└── test/
    ├── unit/
    ├── integration/
    └── fixtures/
```

If moving every existing colocated test immediately would create unnecessary churn, the pilot may move the tests it touches first and establish the convention for new work.

However, the intended direction is:

> **Executable tests live under `test/`, not beside production implementation in `src/`.**

Avoid running two permanent conventions indefinitely.

---

# 15. Desired scripts

After auditing the current test runners, converge toward a small set of obvious commands.

Conceptually:

```bash
npm run test:unit
npm run test:behavior
npm run test:integration
npm run test:rehearsal
npm test
```

Where:

```text
npm test
→ unit + deterministic behavior + stable integration
```

Rehearsal and live tests should remain explicit unless we later decide otherwise.

Do not add many narrowly named commands if directory-based selection can keep the interface simpler.

Historical `gate:*` commands may remain temporarily during migration, but should be retired or renamed once their role is clear.

---

# 16. Desired developer decision table

The testing guide should eventually make this easy:

| I changed… | Run… |
|---|---|
| pure Gather domain logic | unit |
| composition inspection/binding | unit + relevant integration |
| wrapper UI | behavior |
| Function Gallery rendering | behavior |
| renderer/browser Capability | unit + Capability integration |
| native/web Capability contract | unit + parity integration |
| editor/renderer bridge | bridge integration |
| package/install | unit + package integration |
| Central proxy/auth boundary | behavior + Central integration |
| complete demo workflow | rehearsal |

A developer should not need historical knowledge of which `gate:*` script happened to cover the area.

---

# 17. Pilot acceptance criteria

Stop after establishing the foundation and migrating the pilot coverage.

We want:

```text
✓ testing terminology documented

✓ tests organized under test/
✓ initial directory structure stays simple

✓ user-facing behavior represented as executable scenarios
✓ ordinary unit/contract tests remain ordinary tests
✓ targeted integration tests are explicit
✓ rehearsals are explicit and few

✓ at least one broad historical gate is decomposed
✓ rendered UI behavior is tested where user-visible
✓ important guarantees from the gate are not lost

✓ live/network-dependent tests require explicit invocation
✓ documentation explains when to run each suite
✓ developer-facing scripts are simple and predictable

✓ no product features added during the testing refactor
```

Report the first pilot before rolling the strategy through every historical gate.

---

# 18. What to report after the pilot

For each decomposed gate, report:

```text
old gate purpose
old runtime
known flakiness / timing dependencies

durable behaviors extracted
unit/contracts extracted
targeted integrations retained
rehearsal retained or retired

new test file locations
new commands

new runtime:
  unit
  behavior
  integration
  rehearsal
```

Also report any tests that remain hard to classify.

Do not force an awkward classification merely to finish the reorganization.

---

# 19. Design principle going forward

After every future acceptance STOP:

```text
make acceptance criteria green
        ↓
ask what we learned is worth protecting
        ↓
encode each promise at the cheapest durable layer
        ↓
keep full-stack execution only where composition itself is the thing being tested
```

The goal is not maximum test count.

The goal is:

```text
fast feedback
clear ownership
determinism
meaningful user behavior
strong domain contracts
purposeful integration coverage
a small number of trustworthy rehearsals
```

That is the testing foundation we should build on as Gather grows.
