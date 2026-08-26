# C0.5 M2 Final Decision (M2.1-M2.3)

## 1) Selector usage inventory

- Report: [`m2.1-selector-inventory.md`](./m2.1-selector-inventory.md)
- Machine-readable: [`m2.1-selector-inventory.json`](./m2.1-selector-inventory.json)
- Runtime (A) selector capability used by xforms-engine:
  - `:scope > <tag>`
  - child combinator `>`
  - selector lists `,`
  - attribute presence selectors (e.g. `[nodeset]`, `[ref]`)
  - attribute value selectors (e.g. `[form-definition-source="repeat-group"]`)
  - universal selector `*`
  - `:not(...)`
  - unscoped `matches(...)` fallback selectors

## 2) Selector implementation selected

- Selected implementation: **isolated slimdom selector adapter** (no external selector dependency).
- Rationale:
  - ODK-required selector subset is small and bounded by inventory.
  - Avoided external selector packages that introduced either DOM-assumption incompatibilities (e.g. `nwsapi` expecting browser event APIs) or larger dependency/runtime risk.
  - Kept behavior explicit and testable against jsdom.

## 3) Selector adapter implementation

- Adapter: [`selectorAdapter.js`](../selectorAdapter.js)
- Slimdom DOM compatibility installer: [`installDomCompatibility.js`](../installDomCompatibility.js)
- Behavior provided:
  - `Element.matches`
  - `Element.querySelector`
  - `Element.querySelectorAll`
  - `Document.querySelector`
  - `Document.querySelectorAll`

## 4) Selector semantic comparison vs jsdom

- Report: [`m2.1-selector-semantic-comparison.md`](./m2.1-selector-semantic-comparison.md)
- Machine-readable: [`m2.1-selector-semantic-comparison.json`](./m2.1-selector-semantic-comparison.json)
- Result: **equivalent for tested ODK-required selectors** on namespace-heavy XML fixture.

## 5) M2.1 verdict

- **GREEN**

## 6) Node jsdom-vs-slimdom XForms comparison

- Report: [`m2.2-node-equivalence.md`](./m2.2-node-equivalence.md)
- Machine-readable: [`m2.2-node-equivalence.json`](./m2.2-node-equivalence.json)
- Compared:
  - form load/init
  - state snapshots
  - `setValue` updates
  - calculate / relevant / constraint transitions
  - select/itemset behavior
  - repeat add/remove behavior
  - serialized instance payload

## 7) Representative forms/fixtures used

- Main M2.2/M2.3 fixture:
  - [`representative-xform.xml`](../fixtures/representative-xform.xml)
  - [`representative-xform.js`](../fixtures/representative-xform.js)
- M2.1 selector fixture:
  - [`selector-fixture.xml`](../fixtures/selector-fixture.xml)

## 8) M2.2 verdict

- **GREEN**

## 9) RN/Hermes runtime implementation

- Probe logic:
  - [`xformsHermesProbe.js`](../xformsHermesProbe.js)
  - [`metroEntry.js`](../metroEntry.js)
- Optional manual probe screen module (not wired into production navigation):
  - [`M2SlimdomXformsProbeScreen.js`](../M2SlimdomXformsProbeScreen.js)

## 10) Android debug/release results (M2.3)

- Android debug:
  - Metro: **PASS** (for dist-entry probe)
  - Hermes execution: **FAIL** (`await` parse failure in xforms-engine dist bundle)
- Android release:
  - Metro: **FAIL** (same top-level `await` parse/transform issue)
  - Hermes: **NOT RUN** (bundle failed)

## 11) iOS debug/release results (M2.3)

- iOS debug:
  - Metro: **PASS** (for dist-entry probe)
  - Hermes execution: **FAIL** (`await` parse failure in xforms-engine dist bundle)
- iOS release:
  - Metro: **FAIL** (same top-level `await` parse/transform issue)
  - Hermes: **NOT RUN** (bundle failed)

## 12) Compatibility shims required

- Added:
  - slimdom DOM compatibility installer (`DOMParser`, `XMLSerializer`, core DOM constructors, bootstrap `document`)
  - selector adapter methods listed above
- Not added:
  - broad Node/browser polyfill layer
  - ODK source patch/fork

## 13) M2.3 verdict

- **RED**
- Blocking findings:
  1. Default package import `@getodk/xforms-engine` fails Metro resolution (package entrypoint resolution issue in this toolchain).
  2. Direct dist entry import bundles in debug but fails Hermes parsing due top-level `await` in `dist/index.js` (`BLOB_BEHAVIOR = await detectBlobBehavior()`).

## 14) Final M2 assessment

- **RED** for direct stock Hermes execution path in current Gather Metro/Hermes setup.
- M2.1 and M2.2 are strong/green, but M2.3 blocker prevents M2 completion as GREEN/YELLOW.

## 15) Recommendation for M3

- **Do not proceed to M3 Strategy A yet**.
- First resolve M2.3 package/runtime blockers (entrypoint resolution + top-level-await compatibility) without patching/forking ODK.
- If that cannot be done with narrow, maintainable toolchain changes, stop Strategy A and run the fallback architecture spike (headless WebView bridge) before investing in M3 client-state work.

---

## Suggested commit split

1. **M2.1 selector inventory + adapter**
   - selector inventory generator + report
   - selector adapter + semantic comparison
2. **M2.2 Node semantic equivalence**
   - Node scenario harness + jsdom/slimdom comparison reports
3. **M2.3 Hermes runtime probe**
   - Hermes probe modules + Metro matrix gate + final M2 decision report
