# M11 Phases 1–4 — plan and open questions

What the next stretch involves, checked against the code rather than against
the milestone description, and the questions that should be answered before
any of it starts.

[The phase definitions](./planning/m11-gather-tool-composer.md) still hold. What
changes here is the **starting point**, because probing the running deployment
turned up a gap the phases assumed away.

---

## The finding that reorders everything

The Composer's catalog handshake, asked of the live renderer:

```text
components   27
functions    25 → add, subtract, multiply, divide, equals, … formatDate,
                  pluralize, openUrl
```

Twenty-five upstream Basic Catalog functions and **zero Gather functions**. No
`image_segment`, no `measure_area`, no `gather_persistAsset`, no
`gather_completeComposition`. `apps/renderer/src/App.jsx` builds its catalog as

```js
new Catalog(GATHER_CATALOG_ID, [...components], [...basicCatalog.functions.values()])
```

so the Composer's agent cannot author the Tool that was proven on hardware
yesterday. It does not know those functions exist.

**Phase 1 was described as "surface the Model Catalog". Its real first step is
smaller and more basic: make Capabilities authoring resources at all.** Models
are a *choice within* a capability call; there is no point offering a model
picker for a function the agent cannot write.

Two related facts, same cause — the web renderer was built to prove *rendering*
and never grew the authoring surface:

- it registers no host functions either, so a Tool cannot express persistence
  or completion in the Composer;
- it has no Model Catalog and no capability runtime, using
  `fixtureCapabilities` through the legacy action adapter rather than the
  `action.functionCall` path the mobile runtime uses.

Everything needed exists in `src/` and `packages/`. None of it is wired into
`apps/renderer`.

---

## Phase 1 — Capabilities and Models as authoring resources

```text
1a  register capability + host functions in the web renderer's Catalog
1b  decide how a model choice is discoverable                      ← Q1
1c  annotate compatible models per capability                       Q1
1d  a picker, if a picker is still wanted after 1b                  Q1
```

**1a is the unblocking step** and is nearly mechanical: `capabilityFunctions`
and `createHostFunctions` already exist and are already used by
`GatherProvider`. The renderer needs its own binding of them — which raises Q2,
because a registered function has to *do* something when pressed.

Reusable as-is: `gather-capabilities` definitions and `acceptedModelProfiles`,
`buildModelCatalog` / `modelsForCapability`, `createModelRef`, `TASK_PROFILES`.

**Gate.** The Composer's catalog lists `image_segment` and `measure_area`, and
an agent can author a call to one with an explicit `ModelRef`.

## Phase 2 — the browser Model Lab

Blocked on one unanswered mechanical question (Q3) before any design:

- `onnxruntime-web` is **not** a dependency; only `onnxruntime-react-native`.
- Bundled model bytes are React Native `require()` handles into
  `assets/models/*.onnx`, resolved by Metro. There is no web path to them.
- The renderer's CSP is `connect-src 'self'`, so it cannot currently fetch a
  model from anywhere else.

Scope stays as written: `segmentation.binary.v1` and `classification.ranked.v1`
only, reusing the declared `ModelPackage` transforms. No second inference
framework, no arbitrary ONNX playground.

**Gate.** Select a compatible model → choose a sample image → run → inspect a
useful result.

## Phase 3 — compatibility as a report

The least blocked of the four. `validateModelPackage`, `TASK_PROFILES`,
`acceptedModelProfiles` and content revisions all exist; this is an adapter
that renders their existing answers, plus Q5's statement of what a green report
means.

**Gate.** A researcher can understand *why* a model will or will not work.

## Phase 4 — Tool dependency selection

One real architectural question (Q4): `defaultModelRefFor` lives in
`src/compute/models/modelPolicy.js`, which is app code. Resolving `default` to
an exact revision at publish time needs that policy somewhere the Composer can
reach, and "app-owned defaults" is a recorded invariant.

**Gate.** Before publishing, every model-backed operation resolves to a known
compatible `ModelRef`, and the author can see the dependency graph.

---

## Open questions

### Q1 — How does a model choice reach the Composer without a patch?

The bridge carries `components`, `functions` and `theme`. There is no model
channel, and adding one to the protocol means changing the Composer shell,
which is the patch we do not want.

| | approach | cost |
| --- | --- | --- |
| **a** | Put model choice **in the capability's own input schema** — `modelRef` as a described union/enum of available `ModelRef`s. The agent discovers models through the function it is already configuring. | zero protocol change; couples discovery to schemas and grows them |
| **b** | Renderer serves `/gather/models.json`; the Composer shell fetches it | needs the shell to know it exists → a patch |
| **c** | A Gather picker rendered **inside the renderer iframe** | zero patch; the picker lives in the preview pane, which is strange UX |

**Recommendation: (a) for discovery, defer the picker.** It is the only option
that keeps the zero-patch result and needs deciding before 1b–1d have a shape.

### Q2 — Does the web renderer *execute* capabilities, or only advertise them?

A registered function must do something when pressed in preview. Fixture
responses are instant, deterministic and need no model bytes; real execution is
Phase 2. Phase 1 almost certainly wants fixtures — but then a Tool that
"works" in the Composer has not run a model, and the preview's honesty depends
on saying so.

### Q3 — Where do model bytes come from in a browser?

`require()` will not work. Serve `.onnx` from the renderer origin (grows the
image, and `u2netp` is small but `mobilenet-v3-large` is not)? Fetch from
Central? A separate model host? Whatever the answer, `connect-src 'self'`
changes with it, and the CSP is the thing that already cost us a day.

### Q4 — Who resolves `default` → an exact `ModelRef` at publish time?

`modelPolicy` is app-side, and the invariant says defaults are app-owned. Three
readings, and they are not equivalent:

- move `defaultModelRefFor` into `gather-models` so app and web share it —
  is a shared package still "app-owned"?
- have the Composer publish `default` unresolved and let the device resolve at
  run time — loses the immutability Phase 4 exists to provide;
- have the Composer resolve against the Model Catalog it was given — correct
  only if that catalog came from the same distribution that will run the Tool.

### Q5 — What does a green Model Lab run *mean*?

Native execution stays authoritative, which is settled. But an author who sees
a good result in the browser will believe something about the device. Whether
that belief is warranted — same preprocessing, same postprocessing, different
runtime and different numerics — needs a stated contract before the Lab
suggests one implicitly.

### Q6 — What do the host functions do in preview?

`gather_persistAsset` and `gather_completeComposition` are bound to a live
XForms instance. In the Composer there is neither an instance nor a camera
(Permissions Policy blocks it — measured). So what happens when an author
presses "Accept and submit" in the preview pane? Without an answer, the most
important control in any Gather Tool is the one the Composer cannot
demonstrate.

---

## Suggested order

```text
Q1, Q2   decide            → both gate Phase 1's shape
1a       register capability + host functions in the web renderer
1b–1c    model discovery through the chosen mechanism
3        compatibility report            (cheapest, and informs the picker)
Q3       decide                          → gates Phase 2 entirely
2        Model Lab
Q4       decide                          → gates Phase 4
4        dependency view and publish-time resolution
```

Phase 3 is deliberately pulled earlier than its number: it is the least blocked,
and knowing what a compatibility verdict looks like is what makes a model picker
worth designing.
