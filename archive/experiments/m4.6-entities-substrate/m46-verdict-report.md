# M4.6 — Entity Substrate Vertical Slice — VERDICT

**Date:** 2026-08-28
**Engine:** `@getodk/xforms-engine@1.0.3` (stock, unforked)
**Live server:** `https://central.openfieldworks.com` — client `v2026.2.4`, server `v2026.2.2`
**Dataset / Entity List:** `plants` · **Forms:** `silphium_plant_registration`, `silphium_flower_survey_entities`

## Verdict: ✅ GREEN

Gather can use **stock** Central + OpenRosa + the **stock** XForms engine to discover a
Dataset, receive its Entity List as a form resource, load it into the engine, select an
Entity, read its properties, **create** an Entity through an ordinary submission, and
**update** an Entity through an ordinary submission — all verified against live Central on
both iOS and Android/Hermes, with **no engine fork and no app-side XForms/Entity evaluator**.

## Acceptance checklist (all satisfied)

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | live Dataset discovery works | M4.6.1/6.2 `listDatasets`/`getDataset` (live) |
| 2 | live Entity retrieval works | M4.6.2 `listEntities` (metadata) / `getEntity` (data) (live) |
| 3 | App User receives linked `plants.csv` | M4.6.3 manifest → `downloadFormAttachment` (live, md5/ETag) |
| 4 | static and dynamic form resources coexist | M4.6.3 `type="entityList"` + `integrityUrl` vs plain media |
| 5 | stock engine consumes `plants.csv` | M4.6.4 iOS+Android (+ Node pre-flight) |
| 6 | `select_one_from_file` works | M4.6.4 — 8 choices materialized from CSV |
| 7 | selected value is real Entity UUID | M4.6.4 — `/data/plant` = system UUID |
| 8 | `instance()` property lookup works | M4.6.4 — site/block/column/row/plant_code/`__version` |
| 9 | registration XForm creates real Entity | M4.6.5 iOS + REST verify (version 1, correct props) |
| 10 | observation XForm updates selected Entity | M4.6.6 iOS+Android + REST verify |
| 11 | Entity version increments appropriately | M4.6.6 — version 1 → 2 both platforms |
| 12 | ordinary observation data stays submission history | M4.6.6 — measurements NOT promoted to properties |
| 13 | iOS runtime passes | M4.6.4 / 6.5 / 6.6 iOS `ok:true` |
| 14 | Android runtime passes | M4.6.4 / 6.6 Android `ok:true` |
| 15 | no engine fork | engine used only through published `loadForm`/client APIs |
| 16 | no app-side XForms/Entity evaluator | choices/derivations/versioning all done by the engine |

## What was proven (concrete facts)

- **Dataset schema (live):** `plants` has `site, block, column, row, plant_code, geometry,
  status, registered_on, last_observed` — **no `species`**. Property values are strings.
- **Two distinct resource surfaces:** REST/admin Dataset API (Web User; App User → 403) vs
  the OpenRosa field-client manifest (App User) that delivers the Entity List CSV.
- **Manifest distinguishes resource kinds:** `<mediaFile type="entityList">` with an
  `<integrityUrl>` for `plants.csv` vs a plain `<mediaFile>` for `silphium-reference.jpg`.
  Both download through the same `downloadFormAttachment` API.
- **entityList hash semantics:** the manifest `<hash>` for an Entity List is a **dataset
  content signature** (= the download's weak `ETag`), **not** md5 of the CSV bytes; static
  media hash *is* md5(bytes). Treat the entityList hash as a change token; use `integrityUrl`
  for Entity-level integrity.
- **Field-client CSV shape:** `name(=Entity UUID), label, __version, …properties`.
- **Engine consumes the CSV via the generic `fetchFormAttachment` seam** — 8 choices,
  selected value = system UUID, `instance('plants')` lookups correct (e.g.
  `site=Tyson, block=A, column=1, row=2, plant_code=Tyson-A-C1-R2, __version=1`).
- **Form-driven create:** registration submission → Central Entity created (version 1,
  label = calculated `plant_code`, correct `save_to` properties, `creatorId` = App User).
- **Form-driven update:** observation submission with `<entity update="1" baseVersion="1">`
  → status changed, `last_observed=today`, **version 1→2**, `conflict:null`; measurement
  fields (`flower_head_count`, `plant_height_cm`) stayed in submission history and were
  **not** promoted to Entity properties.
- **`odk-central-client.submit()` never mutates Entities directly** — it posts the serialized
  instance; Central applies the create/update from the `<entity>` block in the XML.

## Code changes (packages/files, and why)

- `packages/odk-central-client/src/config.js` — added Dataset/Entity REST endpoints.
- `packages/odk-central-client/src/OdkCentralClient.js` — `listDatasets`, `getDataset`,
  `listEntities` (metadata), `getEntity` (data), `downloadDatasetEntitiesCsv` (raw Response).
- `packages/odk-central-client/src/openrosa.js` — `parseManifest` now carries `type`,
  `integrityUrl`, `isEntityList` (backward-compatible) so callers distinguish an Entity List
  from static media without special-casing transport.
- `packages/odk-central-client/README.md` — documented the Entity read surface, the two-CSV
  distinction, the entityList hash caveat, and the two required notes (below).
- `packages/odk-xforms-host/src/index.js` — `loadForm(xml, attachments)` + `XFormsResourceAttachment` typedef.
- `packages/odk-xforms-webview/src/{createWebViewSidecarHtml,WebViewXFormsHost}.js` — the
  generic `fetchFormAttachment` seam: bridge carries `attachments`, sidecar serves each `jr:`
  URL from an in-memory map as a standard `Response`. Not Entity-specific.
- Experiment harnesses: `M46EntitySlice.js` (6.4), `M465RegisterSlice.js` (6.5),
  `M466UpdateSlice.js` (6.6); Node pre-flights `proveEngineCsv/Registration/Observation.mjs`.
- `scripts/run-android-gate.sh` — hardened for the emulator (cold boot + `10.0.2.2` packager host).

## Tests

- **Unit** (no network): `odk-central-client` 52 pass (Dataset/Entity methods, manifest
  `entityList` discrimination, error/version mapping); `odk-xforms-host` 2; `odk-xforms-webview`
  7 (sidecar `fetchFormAttachment` seam + attachment forwarding).
- **Live Central** (opt-in, env-gated): read path (`entities.live`), dynamic resource
  (`entity-resource.live`), form-driven create (`entity-create.live`). All pass.
- **Browser/sidecar-equivalent (Node engine):** `proveEngineCsv` (CSV consumption),
  `proveRegistration` (create block), `proveObservation` (update block) — all GREEN.
- **RN runtime:** iOS + Android deterministic result JSON (`m464/465/466-*-runtime-result.json`),
  all `ok:true`, each write REST-verified.

## Live evidence (sanitized)

Fixtures: `datasets.list.json`, `dataset.plants.json`, `entities.list.json`,
`entity.detail.json`, `manifest.entities.xml`, `plants.csv`, `registration.submission.template.xml`.
Runtime results: `m464/465/466-{ios,android}-runtime-result.json`. Raw live captures and logs
are gitignored (they embed App User tokens in `/key/<token>/` URLs).

## Deviations from upstream

**None in the shipping path.** The engine is used only through its published `loadForm`
option `fetchFormAttachment` — a standard client seam, not a patch. The single shim is
**Node-preflight only**: the engine's bundled Emscripten (tree-sitter XPath) loader reads
`__dirname`, which is undefined in Node ESM, so the pre-flight scripts set `globalThis.__dirname`.
This never runs in the React Native / WebView path (the WebView provides a real browser env)
and is not part of any package.

## Remaining gaps (classified)

- **protocol/client:** APIs remain **provisional** pending M4.7 (concurrency/`updateEntity`,
  actor properties, access filter). No delete/restore/purge, no OData — intentionally.
- **engine:** none observed for online create/update. Offline-entity behavior is unproven
  here (deferred to M4.7.5/6).
- **mobile host:** the `fetchFormAttachment` attachments cross the RN→WebView bridge in
  memory; fine for `plants.csv` (KB-scale). Large Entity Lists may need a streaming/URL
  strategy — revisit if a real dataset is large.
- **future offline-store responsibility:** cross-form locally-created offline Entities are
  out of scope (M4.7.6 characterization).

## Required documentation notes (recorded in the client README)

- "Entity Lists are called **Datasets** in the Central developer API but **Entity Lists** in
  end-user Central terminology."
- "Form-driven Entity mutation remains part of ordinary XForms/OpenRosa submission semantics;
  `odk-central-client` does not independently mutate Entities when submitting a form."

## Recommendation

**Proceed to M4.7** (Entity delivery, access filtering, concurrency, offline boundary). The
online Entity substrate is proven end-to-end on both platforms with the stock engine and a
minimal, protocol-faithful client surface.
