# M1 — DOM Contract Discovery (Plan)

Part of **C0.5 — ODK XForms Engine Compatibility Spike**. This document is **planning only**.
Reference: `reference/Task_ Plan C0.5 — ODK XForms Engine Compatibility Spike in Gather Mobile.md`
(in the main repo).

> Goal of M1: determine the exact browser/XML-DOM API surface that
> `@getodk/xforms-engine@1.0.3` (and its bundled `@getodk/xpath`) require at runtime, and
> emit a **machine-readable** `dom-contract.json` plus a human summary, so M2 can pick/shim a
> Hermes DOM implementation without guessing.

---

## 0. Context findings (verified against the installed package)

- **Pinned engine version:** `@getodk/xforms-engine@1.0.3` (installed in the main repo's
  `node_modules`). All M1 analysis is pinned to this exact version.
- **Engine declares `engines.node: ^24.16.0`, `npm: 11`** but installs fine under Gather's
  **Node 22 / Yarn 1** with `--ignore-engines`. Treated as a package-manager constraint only
  (per plan) until Hermes runtime testing (M2) proves otherwise.
- **Package ships both `dist/` (bundled JS + `.d.ts`) and full `src/` TypeScript** → enables a
  TS-type-aware static pass, not just grep.
- **Reactive core is Solid.js** (`solid-js` peer/dep), **not Vue**. (Irrelevant to M1's DOM
  contract; recorded because it changes M3's adapter design.)
- **`@getodk/xpath` is bundled into the engine's `dist`**, not installed as a separate package.
  M1 still needs xpath's DOM assumptions, so we analyze xpath from ODK source (see §3).
- **Early DOM-usage probe** (token counts in `dist/index.js`) — a preview, not the contract:
  `getAttribute` 109, `localName` 169, `namespaceURI` 106, `nodeType` 74, `parentNode` 35,
  `setAttribute` 26, `createElement(NS)` 12/8, `querySelector(All)` 6/3, `DOMParser` 2,
  `XMLSerializer` 1, `lookupNamespaceURI` 9, **`MutationObserver` 0**, `createNSResolver` 0.
  → Signal: usage is **XML-DOM-centric** (namespaces, attributes, traversal, serialization),
  which is the "good" outcome for feasibility.

## 1. Gather repo areas involved

M1 is intentionally **non-invasive** — it does not touch the running app.

- **No app coupling.** M1 lives entirely in `experiments/m1-dom-contract/` with its own
  `package.json`/`tsconfig.json` (the app has no TypeScript or Jest today).
- **Read inputs only:** the installed `@getodk/xforms-engine` package (`dist` + `src` + `.d.ts`)
  and a read-only checkout of ODK `packages/xpath` (§3).
- **Outputs:** artifacts written to `experiments/m1-dom-contract/out/`. Nothing is imported by
  `App.js`, Metro, or Babel. Hermes is **not** exercised in M1 (that's M2).

## 2. Branch & module structure

Working branch/worktree: `agents/milestone-m1-planning-xforms-engine` (this worktree). The
original plan named `experiment/odk-xforms-engine`; we keep the milestone worktree as the home
and treat that as the umbrella experiment branch.

```
experiments/m1-dom-contract/
  PLAN.md                 # this file
  package.json            # isolated devDeps: typescript, ts-morph, (jsdom for dynamic pass)
  tsconfig.json
  src/
    staticScan.ts         # ts-morph/type-checker pass → DOM-typed symbol inventory
    dynamicTrace.ts       # OPTIONAL: Proxy-wrapped jsdom to log actually-touched members
    merge.ts              # merge static + dynamic → dom-contract.json + dom-contract.md
    rankCandidates.ts     # score candidate DOM libs against the contract
  fixtures/
    *.xml                 # small real XForms to drive the dynamic pass
  vendor/xpath/           # read-only ODK packages/xpath source @ matching version (git-ignored)
  out/
    dom-contract.json     # machine-readable inventory
    dom-contract.md       # human-readable summary
    candidates.md         # DOM libraries ranked vs contract (hand-off to M2)
```

## 3. Sourcing the `@getodk/xpath` source

Chosen approach (pragmatic default): **clone ODK `central-frontend` read-only** and check out the
commit/tag whose `packages/xpath` matches the version bundled into engine 1.0.3; copy
`packages/xpath` into `experiments/m1-dom-contract/vendor/xpath/` (git-ignored) purely for
analysis. This is **not a fork and not a copy into app source** — it is reference input for the
static scan. Version match will be verified against the bundled xpath in the engine's `dist`.

Fallback if a clean version match can't be established: analyze xpath **only** as bundled inside
the engine `dist`, and record reduced confidence for the xpath-specific portion of the contract.

## 4. Method — two complementary passes

### 4a. Static analysis (primary)
Use **ts-morph** (TypeScript compiler API) over the engine `src`/`.d.ts` and vendored xpath `src`:
- Resolve every **property access**, **`new` expression**, and **`instanceof`** whose declared type
  originates in **`lib.dom.d.ts`** (e.g. `Document`, `Element`, `Node`, `Attr`, `NamedNodeMap`,
  `DOMParser`, `XMLSerializer`, `XPathEvaluator/Result`, `NodeList`, `HTMLCollection`).
- Bucket results as `Interface → member[]`, and additionally tag each by category:
  namespace APIs, XML serialization, node mutation, selector APIs, DOM constants (`nodeType` and
  friends), global constructors / `instanceof` targets, and APIs reached indirectly via xpath.
- Record provenance (file:line) and whether each came from engine vs xpath.

Rationale for TS-aware over grep: distinguishes real DOM `Element.children` from unrelated
`.children` on non-DOM objects, and captures members reached through typed intermediates.

### 4b. Dynamic instrumentation (corroborating, optional-but-recommended)
Run the engine's Node + **jsdom** path (ODK's own behavioral reference) with a **Proxy** wrapping
`Document`/`Element`/`Node`/`DOMParser`/etc. that logs every property get/call while:
- parsing a real XForm, and
- driving minimal engine interactions (load form, read nodes).
Merge the observed set with the static set to catch anything hidden by bundling/reflection and to
flag statically-referenced-but-never-exercised APIs.

### 4c. Merge & candidate ranking
`merge.ts` unions the two passes into `dom-contract.json` with per-member flags
`{ static: bool, dynamic: bool, category, provenance }`. `rankCandidates.ts` scores
`@xmldom/xmldom`, **LinkeDOM**, and one more lightweight standards-compatible XML DOM against the
contract (supported / missing / partial), producing the M2 hand-off shortlist.

## 5. Dependencies / tools (isolated toolchain)

- `typescript`, `ts-morph` (static pass)
- `jsdom` (dynamic pass only)
- Node 22 + Yarn 1 with `--ignore-engines` for anything under the engine's manifest
- No new dependencies added to the Gather app itself.

## 6. Deliverables (from the plan)

- `out/dom-contract.json` — machine-readable inventory (by interface → member).
- `out/dom-contract.md` — human-readable summary of required APIs.
- Explicit **static vs dynamic** distinction per API.
- `out/candidates.md` — candidate DOM libraries ranked against the contract.

## 7. Success / failure criteria (M1-specific)

**Success:** We can state with reasonable confidence — *"these are the DOM APIs Gather must provide
for engine 1.0.3"* — detailed enough to evaluate candidate libraries without guessing.

**Failure:** DOM requirements can't be meaningfully isolated because the engine depends broadly on
browser APIs beyond XML/DOM, **or** substantial runtime behavior can't be identified without
reverse-engineering/modifying the engine. If so, document the specific offending API/assumption and
record it as **elevated Strategy-A risk** for the final go/no-go.

## 8. Risks & unknowns

- **Bundling hides call sites:** minified/bundled `dist` may obscure some references → mitigated by
  analyzing shipped `src` + the dynamic pass.
- **xpath version match:** must confirm the vendored xpath equals the bundled one; mismatch reduces
  confidence (fallback in §3).
- **Static false negatives:** dynamically constructed access or `any`-typed escapes → dynamic pass
  covers these; residual gaps are recorded, not hidden.
- **Temporal / non-DOM globals:** engine uses `temporal-polyfill`, `papaparse`, `mdast-*`. These are
  **not DOM** and are explicitly out of M1 scope, but any *global*/`instanceof` expectations they
  add will be noted separately so M2 isn't surprised.
- **Coverage of the dynamic pass** is only as broad as the fixture forms exercise; static remains the
  authority for breadth.

## 9. Milestone dependency map

```
M1 (this) ──contract──▶ M2 (Hermes DOM shim) ──runtime──▶ M3 (Solid→RN adapter) ──▶ M4 (native widget → setValue)
```
M1 has **no** dependency on the RN app or Hermes; it unblocks everything downstream.

## 10. Definition of done for M1 (planning → ready to execute)

When approved, execution proceeds as: scaffold the isolated toolchain → vendor+verify xpath →
run static pass → run dynamic pass → merge → rank candidates → write both artifacts → classify
result and hand the candidate shortlist to M2. **No execution until then.**
