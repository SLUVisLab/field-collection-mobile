# Version Two — Release Planning

> **Purpose:** Working document to walk through and resolve the open design questions
> around modernizing and hardening the Gather field-collection app for its second major
> version. This is a living doc — we capture questions, options, and tradeoffs here,
> record decisions as we make them, and turn agreed items into tracked work.

**Status legend:** 🔵 Open · 🟡 Leaning · 🟢 Decided · ⚪ Deferred

**Reference model:** Several items below borrow from the CI/CD + release setup on our
recent Flutter project (GitHub Actions + Fastlane + release-please + Gherkin QA). Where
that applies, it's called out as *[Flutter model]*.

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [0. Strategic Framing: Build vs. Adopt — Why not just use ODK?](#0-strategic-framing-build-vs-adopt--why-not-just-use-odk)
  - [0.1 Option C in depth: own the frontend, use ODK as the backend](#01-option-c-in-depth-own-the-frontend-use-odk-as-the-backend)
  - [0.2 Worked example: mapping a nested field-site layout onto ODK Entities](#02-worked-example-mapping-a-nested-field-site-layout-onto-odk-entities)
  - [0.3 What's still ours: the authoring + rendering split](#03-whats-still-ours-the-authoring--rendering-split)
  - [0.4 De-risking spikes: C0 (backend) and C0.5 (engine)](#04-de-risking-spikes-c0-backend-and-c05-engine)
  - [0.5 The custom-widget authoring model](#05-the-custom-widget-authoring-model)
- [Suggested Sequencing & Roadmap](#suggested-sequencing--roadmap)
- [1. CI/CD & Release Workflow](#1-cicd--release-workflow)
- [2. App UI & Structure](#2-app-ui--structure)
- [3. Data Model & Structure Overhaul](#3-data-model--structure-overhaul)
- [4. User Management, Groups & Permissions](#4-user-management-groups--permissions)
- [5. Task Library / Marketplace (Extensible Tasks)](#5-task-library--marketplace-extensible-tasks)
- [6. Programmatic Data Access (Public REST API)](#6-programmatic-data-access-public-rest-api)
- [7. Single Sign-On (Google & Microsoft)](#7-single-sign-on-google--microsoft)
- [8. Infrastructure Consolidation & Open-Source Packaging](#8-infrastructure-consolidation--open-source-packaging)
- [Cross-Cutting Themes](#cross-cutting-themes)
- [Decision Log](#decision-log)

---

## Executive Summary

Gather is being modernized and hardened for a second major version. Having just migrated
off the deprecated MongoDB Atlas Device Sync (Firebase Auth + a custom HTTP API, Realm kept
local), this doc plans the larger v2. Eight areas:

| # | Area | Essence | Horizon |
|---|---|---|---|
| 1 | **CI/CD & Release** | Store distribution (App Store/Play) off painful internal builds; quality gates; release automation | Near-term |
| 2 | **App UI & Structure** | ODK-style per-item field list; strip authoring from mobile → web (mobile = pure collection) | Near/mid |
| 3 | **Data Model Overhaul** | Nestable collections (leaf-only records), spreadsheets → import/export, discovery-mode items | Mid/large |
| 4 | **Groups & Permissions** | Multi-group membership, Slack-style switcher, per-group RBAC, web authoring | Mid |
| 5 | **Task Library / Marketplace** | Publishable tasks as **declarative widget graphs + models** (no untrusted code); on-device CV/ML | Large (differentiator) |
| 6 | **Public REST API** | Per-user tokens for programmatic data access | Near-term |
| 7 | **SSO** | Google + Microsoft via Firebase (OIDC) | Near-term |
| 8 | **Infra Consolidation** | Standards over SDKs; Docker/compose self-host + SaaS; end vendor sprawl | Mid/large |

**The single highest-leverage move:** build **one OIDC-based, group/role-scoped, revocable
auth/identity layer** and **retire the static `x-api-key`**. It underpins sections 1.3, 4.3,
6, 7, and 8.3 at once — do it once, expose it to mobile login, SSO, the public API, and
service-to-service auth.

**Guiding principles:** (a) **depend on standards, not proprietary SDKs** (the Atlas Device
Sync deprecation is why); (b) keep the **mobile collector experience dead-simple**, pushing
complexity into web authoring + the data model + the task pipeline; (c) **`groupId` as the
consistent tenancy boundary**, reused for SaaS multi-tenancy.

**The differentiator:** Section 5 — a safe, marketplace-style **task library** where authors
ship **declarative widget compositions + models as data** (never code), unlocking custom
**on-device CV/ML** (OpenCV present; ONNX to be added). PetalCounter is the working prototype
to harvest from.

---

## 0. Strategic Framing: Build vs. Adopt — *Why not just use ODK?*

> 🔵 **Open — the meta-question that gates this entire roadmap.** Everything below assumes we
> keep building a custom platform. That assumption deserves an explicit decision *before* we
> invest in v2.

**The honest premise.** Open Data Kit already exists, is mature, free, open-source, offline-
first, and battle-tested by a large community. Three years ago, the rational advice would have
been "just use ODK." We built custom tooling because we wanted functionality ODK couldn't give
us at the time. The question at this inflection point: **is that still true, and is the one
remaining differentiator worth the cost of maintaining a whole platform?**

**What ODK does better than we ever will (for free):** the "boring 90%" — offline sync,
XLSForm authoring, Entities/longitudinal data, a hardened Android collector, Central server,
RBAC, exports, a funded full-time maintainer team and community. Sections 1, 2, 3, 4, 6, 7,
and 8 of this doc are, to a first approximation, **re-solving problems ODK already solved** —
and a small team maintaining that surface is a small team **not** working on the differentiator.

**What ODK genuinely can't do (our real edge):**
- **On-device CV/ML as first-class field capture** — runtime-interactive image processing,
  model inference, tap-to-pick/ROI/scale-reference measurement returning real units. (See 5.6
  — "ODK can't do this.")
- **A cross-platform (incl. iOS) collector.** ODK Collect is **Android-only** (confirmed —
  requires Android 5+); ODK's only iPhone story is **browser-based Web Forms**, which can't run
  native on-device ML. Our Expo/RN app runs natively on **both iOS and Android**. This is a
  *structural* edge ODK can't easily match — and, given iPhone-heavy BYOD contexts, co-equal
  with the ML story, not secondary.
- The **integrated declarative task marketplace** (5.5) — cool, but only valuable *if* people
  want to build/share tasks, which is unproven.

**The reframe: this may not be binary.** The sharpest question isn't "build everything vs.
adopt ODK" — it's **which layer do we own?** We don't have to own the whole stack to keep our
differentiator. Two interop shapes exist:
- **Plugin (rejected):** our ML rides *inside* ODK Collect via its external-app intents. Dead
  on arrival for us — external apps are **Android-only** and don't exist in ODK's iOS/Web-Forms
  path, so iPhone users lose the differentiator entirely.
- **Own the frontend, rent the backend (promising):** we keep our **own cross-platform (iOS +
  Android) collector** — where native on-device ML is first-class on *every* device — but it
  **speaks ODK's open standards** to use **ODK Central** as the backend (forms, submissions,
  storage, exports, longitudinal Entities). We build the app; ODK runs the server. Detailed in
  **0.1**.

**Options.**

| Option | What | Upside | Downside |
|---|---|---|---|
| **A — Full pivot to ODK** | Adopt ODK Central + Collect; retire the custom platform. Deliver ML as an ODK external-app integration or a Collect fork. | Lowest maintenance; ride a funded ecosystem; free "90%." | Constrained by ODK's model; Android-centric collector; we become a plugin, not a product; sunk-cost loss. |
| **B — Keep building the full platform** | The current 8-section roadmap. | Full control; integrated ML marketplace; iOS; our UX. | Highest cost; re-solving solved problems; the boring 90% starves the differentiator. |
| **C — Own the frontend, use ODK as the backend** | Keep our **cross-platform collector + native ML**, but speak ODK's open standards (OpenRosa submission, Central API, OData, Entities) so **ODK Central is the server**. Detailed in [0.1](#01-option-c-in-depth-own-the-frontend-use-odk-as-the-backend). | Keeps **iOS + native ML** (our real edges); sheds server, data model, auth, storage, exports, and infra to ODK; standards, not lock-in. | We own a full mobile app (not a plugin); bounded by the **XForms/Entities data model**; coupled to ODK's protocols. |

**My take (for discussion, not a decision).** The iOS reality reshapes this. The *plugin*
interpretation of C — our ML living inside ODK Collect via external-app intents — is **dead**:
those intents are Android-only and absent from ODK's iPhone (Web Forms) path, so iPhone users
would lose the differentiator entirely. But the *other* reading of C is the strongest option on
the board: **own the frontend, rent the backend.** Keep our cross-platform collector (the only
way to own iOS + first-class native ML) and let **ODK Central** be the server via open
standards. That preserves both real edges while shedding the "boring 90%" (server, storage,
exports, auth, longitudinal data) to a funded, documented, externally-maintained backend. Full
**B** (own everything) is justified only if we need server-side capabilities ODK can't give us;
full **A** (adopt Collect too) is off the table precisely because of iOS. The failure mode to
avoid is **B by inertia** — re-building sync, storage, exports, and auth that ODK already gives
away.

**Suggested next step:** a **backbone spike** (see 0.1, C0) — have our app publish one form to
ODK Central and submit one instance end-to-end over OpenRosa, no ML yet. That single spike
de-risks the entire "own frontend / ODK backend" thesis before we commit.

**Open sub-questions:**
- Own our auth/login, or adopt Central **app-users + OIDC** (sheds Sections 4/7)?
- Self-host **ODK Central** vs. **ODK Cloud** for the SaaS story?
- How much of our richer **data-model** ambition (Section 3 nesting) do we give up to fit
  XForms + Entities?
- Is the **task marketplace** (5.5) a real user need, or a nice-to-have we're assuming?
- Migration: import existing Gather records into Central, or clean v2 cutover?

**Leaning:** 🟡 Lean **C — own the frontend, use ODK as the backend.** It keeps iOS + native ML
and hands the rest to ODK. Validate with the C0 backbone spike before committing; accept the
XForms/Entities data-model ceiling as the price. Revisit A/B explicitly only if the spike or the
data-model ceiling proves blocking.

### 0.1 Option C in depth: own the frontend, use ODK as the backend

> 🔵 The refined Option C. The bet: **keep our own cross-platform (iOS + Android) collector —
> where native on-device ML is first-class — and use ODK Central as the backend over open
> standards.** We build the *app*; ODK runs the *server*.

> **If adopted, this supersedes most of Sections 3, 4, 6, 7, and 8** (data model, users/groups,
> public API, SSO, infra) — those become "configure ODK Central" rather than "build it."

**The product, in one line.** Our existing Expo/RN app stays the collector — same UI, same
offline capture, same native OpenCV/ML — but instead of a custom API + Firebase + a local-only
Realm, it **publishes forms to** and **submits records into ODK Central** using ODK's open
protocols. Ingestion, storage, exports, viewing, auth, and longitudinal data all live in
Central; the app and its ML tasks are the only things we own.

**The integration surface (all open, documented, stable).**

- **Authoring → publish.** Our declarative authoring compiles to an **XLSForm** (or XForm XML)
  and pushes it with `POST /v1/projects/{projectId}/forms` (Central accepts `.xlsx` or XForm
  XML directly), then `POST …/draft/publish`. We never build a form server.
- **Submission (the backbone).** Implement the **[OpenRosa Form Submission API](https://docs.getodk.org/openrosa/)**
  — a multipart POST of the instance XML + media attachments to Central. This is the *exact*
  standard ODK Collect uses (stable since 2011); Central is fully OpenRosa-compliant. Our
  offline queue stays ours (Realm), flushing to Central on connectivity.
- **Longitudinal / revisits.** ODK **Entities/Datasets** — a form declares a Dataset schema and
  its submissions create/update **Entities**. Covers our Section 3.4 predefined/longitudinal
  need without building it.
- **Extraction & viewing.** Central gives submission tables, an **OData feed**, CSV/JSON export,
  and **pyODK** for free — most of Section 6 (public API) evaporates.
- **Auth & permissions.** Central **App Users** (tokens) authorize submission; **project
  roles/assignments** provide RBAC; web users log in through Central (OIDC in recent versions).
  Most of Sections 4 and 7 become ODK's job.

```
  Our app (iOS + Android, native ML)            ODK Central (backend)
  ──────────────────────────────────           ─────────────────────
  authoring  ── compile → XLSForm ──────────►   POST /forms → publish
  capture UI + native OpenCV/ML tasks
  offline queue (Realm) ── OpenRosa submit ─►   submissions + media storage
                          (instance XML +        │
                           attachments)          ├─► OData / CSV / pyODK  (viewing/export)
  revisits ── Entities API ─────────────────►   Datasets / Entities (longitudinal)
```

**What we build vs. what we get for free.**

| Concern | Under Option C (frontend + ODK backend) |
|---|---|
| **Cross-platform collector UI (iOS + Android)** | **Ours** |
| **Native on-device CV/ML tasks** | **Ours** — the differentiator |
| **Authoring that compiles to XLSForm** | **Ours** (a compiler, not a server) |
| **Offline queue + OpenRosa sync adapter** | **Ours** (thin; standard protocol) |
| Server, submissions DB, media storage | **ODK Central** |
| Exports / OData / programmatic API (Section 6) | **ODK Central** |
| Users, roles, projects, SSO (Sections 4/7) | **ODK Central** |
| Longitudinal data model (Section 3.4) | **ODK Entities** |
| Dockerized self-host / SaaS packaging (Section 8) | **ODK Central** (already Dockerized) or **ODK Cloud** |

**Feasibility: medium build, low novelty risk.** OpenRosa and the Central API are open,
documented, and stable, and third-party clients already submit to Central. The app shell exists
today (offline Realm store, camera, media, native OpenCV). The real work is well-scoped:
1. **Instance-XML serialization** from our data model to a form's XForm shape.
2. An **authoring → XLSForm compiler** (or hand-authored XLSForms to start).
3. **Mapping ML task outputs** to XForm question types (integer/decimal/image/geopoint/text/binary).
4. An **OpenRosa submission client** + robust offline flush.
5. **Entity** create/update for longitudinal.

**The honest limits (the "it constrains the API" intuition, made concrete).**
- **Data-model ceiling.** Everything must express as **XForms** question types + groups/repeats
  + **Entities** (flat property bags). Our richer Section 3 nesting ambitions must bend to that
  shape — some get simplified or dropped.
- **ML output shape.** Task results must land in standard fields. Great for measurements
  (counts, areas, points, images); exotic outputs need an **escape hatch** (serialize JSON into
  a text field, or attach a sidecar file).
- **Protocol coupling.** We track ODK's XForms/OpenRosa/Entities spec — but these are stable
  open standards, so the risk is low.
- **No custom server logic.** Server-side validation, derived fields, or webhooks are limited to
  what Central offers, unless we add a small sidecar service later.

**The upside you flagged: clean separation of concerns.** Data ingestion, storage, viewing, and
export are a **solved, documented, externally-maintained boundary.** We own the *experience*
(collector + ML); ODK owns the *records*. Either side can evolve independently against a stable
contract — and we shed the maintenance of the entire backend.

**Phased path:**
- **C0 — Backbone spike (de-risk the thesis):** our app publishes one XLSForm to Central and
  submits one instance over OpenRosa, end-to-end — a plain number/text form, **no ML**. Proves
  the whole "own frontend / ODK backend" idea before committing.
- **C1 — Native ML task → field:** a PetalCounter task
  ([CountPetals.js](../tasks/petalcounter/lib/CountPetals.js)) writes count/area into the
  submission; add media-attachment upload.
- **C2 — Offline queue + Entities:** hardened offline flush; longitudinal via Entities
  (registration + follow-up forms).
- **C3 — Authoring→XLSForm compiler + task registry:** our declarative authoring emits XLSForms;
  wire OData/pyODK export docs for power users.

**Open sub-questions:**
- Keep our own login, or fully adopt Central **app-users + OIDC** (sheds Sections 4/7)?
- **Self-host Central** vs. **ODK Cloud** for our SaaS story? (Central is Dockerized — fits the
  8.5 packaging goal without us building a server.)
- How much richer **data-model** ambition (Section 3 nesting) do we sacrifice to fit
  XForms + Entities — and is that acceptable?
- Escape hatch for exotic ML outputs: **JSON-in-a-text-field** vs. a companion attachment?
- Multi-tenancy: **one Central per client** vs. **Central projects as tenants** (Section 8.6)?
- Migration: import existing Gather records into Central, or a clean **v2 cutover**?

**Leaning:** 🟡 **Most promising path.** Own the cross-platform frontend (iOS + native ML = our
real edges); rent **ODK Central** as the backend over open standards. Ship **C0** as a backbone
spike first; accept the XForms/Entities data-model ceiling as the price of shedding most of
Sections 3/4/6/7/8.

### 0.2 Worked example: mapping a nested field-site layout onto ODK Entities

> 🔵 A stress-test of the "data-model ceiling" (0.1) against our canonical case. Verdict:
> **it maps cleanly — the nesting collapses to addressing metadata on flat leaf entities, and
> we own the traversal UI.**

**The canonical case.** An experimental plant field site: **Field Site → Block → (Column ×
Row) → Plant**, where a plant is addressed like *"North Farm · Block 2 · Column 5 · Row 34"*.
Collectors want to **walk the field** — down each column, row by row, then the next column.

**The key reframe: hierarchy is an *addressing scheme*, not a storage tree.** ODK
[Entity Lists](https://docs.getodk.org/entities-intro/) are flat "spreadsheets shared across
forms": each Entity is a row with a `name` (id), a `label`, and arbitrary string
**properties**. There are no nested tables and no enforced parent/child links — the docs are
explicit that to relate Entities you "save one Entity's ID to a property in another." So we
**don't store the tree; we store the leaves and put the coordinates on each leaf**, then
reconstruct the hierarchy by *grouping on properties*. This lands exactly on our **3.2**
decision (the plant is the leaf; hierarchy is metadata on it).

**The mapping — one `plants` Entity List:**

| `name` (id) | `label` | `field_site` | `block` | `col` | `row` | `geometry` | `status` |
|---|---|---|---|---|---|---|---|
| `nf-b2-c5-r34` | B2 · C5 · R34 | North Farm | 2 | 5 | 34 | `-33.86 151.2 0 0` | pending |
| `nf-b2-c5-r35` | B2 · C5 · R35 | North Farm | 2 | 5 | 35 | … | pending |

- **Pre-generating this list is our differentiator.** The "define your field-site layout"
  designer emits the rows (cartesian product of blocks × columns × rows, or just a survey's
  subset) and uploads them to Central via [CSV upload or the Entity API](https://docs.getodk.org/central-entities/).
  ODK never needs to know how they were generated.
- The **id encodes the address**, but coordinates are *also* separate numeric properties so we
  can sort and filter on them.

**The "walk down each column" traversal is ours, for free.** Because `block` / `col` / `row`
are numeric properties, ordering is just a sort — column-major (`block, col, row`) or
**serpentine** (even columns ascending by row, odd descending, to avoid backtracking). Our app
renders that walk; **ODK Collect's cascading-select UI never enters the picture** — we use
Central purely as storage. (A stock-ODK user would instead build a block→column→row cascade
with `select_one_from_file` + [`choice_filter`](https://docs.getodk.org/form-datasets/) — also
valid, but unnecessary when we own the UI.)

**Where measurements go — the canonical 1→many pattern** (ODK's own `trees` +
`tree_measurements`):
- **Each data-collection event is a form submission** carrying `plant_id` + measurements/photos.
  Full history lives in submissions, linked to plants by id at analysis time.
- **Optionally write a few status properties back onto the plant Entity** (`status=done`,
  `last_height=…`) so the app can show collectors what's already done and drive the walk. Photos
  stay in submissions (Entities can't hold media yet).

**When to add more lists.** Keep the single denormalized `plants` list unless a higher level
needs its **own data or lifecycle** (block-level treatments, site metadata, block reassignment).
Then add `blocks` / `field_sites` lists whose children carry a parent-id property, cascaded with
`choice_filter`. For most surveys, one flat list is the un-confusing answer.

**Bonus — entity access filters.** Central's access filter can deliver *only block 2's plants*
to a given collector (filtered by the `block` property): both a performance win (Entities
otherwise sync in full to every device) and a natural "you're on block 2 today" scoping that
ties back to our group/assignment ideas at plant granularity.

**Honest limits for this case:**
- **No enforced referential integrity** — parent links are string properties; our layout
  generator owns keeping them consistent.
- **Properties can't be deleted once added** (only ignored) — design the plant schema deliberately.
- **No media on Entities** — fine; photos ride in submissions.
- **Full entity sync to every device** until ODK ships partial sync — mitigated by the access
  filter for large sites.

**Takeaway:** for this canonical nested layout, the XForms/Entities ceiling is **not binding**.
The richer-nesting worries in Section 3 mostly dissolve once the tree is treated as *addressing*
over flat leaf Entities — reinforcing the Option C leaning.

### 0.3 What's still ours: the authoring + rendering split

> 🔵 Answers the natural worry: *"even with Option C, don't we still build a form builder, a
> DB, an API, and a mobile form UI — i.e. parallel infrastructure?"* Short answer: a rendering
> **UI** must be ours (ODK Collect is Java/Android-only), but **not** a form *engine*, a
> designs DB, or a data API. The parallel infra is far thinner than two full stacks.

**We still need surveys.** ODK Collect composes **dozens** of question types into forms; we
currently have ~7 task types authored via spreadsheets. Because Collect is Java/Android-only,
the cross-platform (iOS + Android) form **UI** genuinely has to be ours. The question is how
much we *reuse* vs. *reimplement*.

**Adopt ODK's vocabulary** (for consistency):

| Ours today | ODK term | Notes |
|---|---|---|
| Survey (the design) | **Form** | the template |
| Task (data-entry type) | **question type / widget** | XLSForm `type` + `appearance` |
| Composable ML task | **custom widget** | the differentiator |
| Result / observation | **Submission** | |
| Item | **Entity** | |
| Collection | **Entity List / Dataset** | |

**The reuse that shrinks the work: `@getodk/xforms-engine`.** ODK Web Forms is a **TypeScript**
engine ([getodk/web-forms](https://github.com/getodk/web-forms), **Apache-2.0**, published on
npm as `@getodk/xforms-engine` + `@getodk/xpath`) with a **deliberate engine/UI split** — the
maintainers explicitly aim to "use the engine to drive other kinds of frontends… eventually
mobile applications." Form logic is **100%** and basic question types **91%** in their own
feature matrix. So we **reuse the engine** (relevance, constraints, calculations, repeats,
XPath, and every question type's semantics) and build **only the widget *views*** in React
Native — we're skinning an engine, not rebuilding JavaRosa.

**What we do NOT build:**
- A **designs database** — ODK Central stores Forms, versions them, and distributes blank forms
  via the OpenRosa Form List API. Our current `GET/PUT /surveys/designs`
  ([utils/api.js](../utils/api.js)) collapse into Central.
- A **designs API, data API, data explorer, form-logic engine, generic widget library** — all
  Central + the reused engine.

**What we DO build (the genuinely-ours list):**
1. **Authoring.** v1 = users author **XLSForm spreadsheets** (which they *already do today*) →
   Central converts XLSX→XForm on upload. Later = a **client-only web builder SPA** that
   compiles to XLSForm and POSTs to Central — a static site with **no backend of its own**.
2. **Mobile rendering.** An RN widget-view layer driven by `@getodk/xforms-engine`.
3. **The differentiator — the ML task library:** native OpenCV/ONNX **custom widgets** + the
   injected primitive palette. Where the investment concentrates.
4. A thin **OpenRosa/Central sync adapter** (submit + form pull).

**The elegant custom-widget trick.** An ML task is just a **standard field + a custom
`appearance`** — e.g. an `integer` field with `appearance="ml:petal-count"`. Central stores a
plain integer, so **data ingestion is 100% standard with zero server support**. Our RN renderer
sees the appearance and swaps in the native widget that produces the integer. (Same insight as
the dead Android external-app idea — but now in-app *and* cross-platform.)

**On library size (your instinct is right).** We don't need a huge generic library: the engine
already knows the dozens of types, so render the **common ones well first** (text, number,
select, photo, geopoint) and grow by demand. Concentrate on the **ML custom widgets + injected
primitives** — that's the differentiator, not boilerplate.

**So the corrected picture.** There are two sides, but not two full stacks. ODK's side = server
+ data + generic form logic. **Our side is three client-side things — the authoring UX, the
rendering UI, and the ML task library — all talking to Central's APIs.** No parallel server, no
parallel DB, no data API; even survey *storage* is Central's.

**Honest caveats / spike needed.**
- The `web-forms` repo was **relocated** into Central Frontend (packages still publish to npm —
  alive, not abandoned); still **maturing** (appearances only 47%); **no documented
  custom-widget plug-in API yet**.
- **C0.5 spike:** run `@getodk/xforms-engine` under **React Native / Hermes** and render one
  form + one custom ML widget. If it won't embed, fall back to **Enketo / `@getodk/web-forms`
  in a WebView** with native ML widgets bridged in.

**Open sub-questions:**
- Does `@getodk/xforms-engine` run under RN/Hermes as-is, or need a WebView fallback?
- Custom-widget injection: extend the engine, or have our renderer intercept by `appearance`?
- XLSForm `appearance` vs. a custom `type` for ML widgets — which does Central accept cleanly?
- v1 authoring: spreadsheets only, or ship the GUI builder sooner?
- Does our own richer authoring risk drifting from XLSForm/XForm semantics the engine can't
  interpret?

**Leaning:** 🟡 Reuse `@getodk/xforms-engine` for form logic + generic widgets; build only the
RN widget UI, the ML custom-widget contract (field + `appearance`), and a client-only authoring
path (spreadsheets now, SPA later). Adopt ODK's vocabulary. Validate embeddability with the
C0.5 spike before committing.

### 0.4 De-risking spikes: C0 (backend) and C0.5 (engine)

> 🔵 Two cheap experiments that together validate the whole Option C bet: **C0** proves a
> non-Collect client can talk to Central; **C0.5** proves we can reuse ODK's form engine +
> inject a native ML widget. Do them before committing to the architecture.

**C0 — Backend backbone (OpenRosa ↔ Central).**
*Proves:* a custom cross-platform client can publish a Form and submit data **without** ODK
Collect.
1. Stand up ODK Central (Docker) or a sandbox; create a Project.
2. Author a minimal XLSForm (text + integer) → `POST /v1/projects/{id}/forms?publish=true`.
3. Pull the blank form via OpenRosa **Form List** (`/formList` + form XML).
4. From a Node script, build an instance XML and submit via OpenRosa **Form Submission**
   (multipart `POST /submission`); attach one media file.
5. Confirm the Submission lands in Central; export CSV.

*Slots into:* replaces `GET/PUT /surveys/designs` in [utils/api.js](../utils/api.js); the submit
step becomes the **sync adapter** behind the Realm upload queue.
*Pass* = a row from a non-Collect client appears in Central. *Fail* = auth/multipart/format
blocker → fallback: proxy a real Collect submission and mirror its request shape.

**C0.5 — Engine embedding (`@getodk/xforms-engine` in React Native).**
*Proves:* the engine runs under **Hermes** and can render a form **plus** one native ML widget.
1. New RN/Expo screen; `npm i @getodk/xforms-engine`.
2. Load the C0 form's XForm; drive the engine; render text + integer with plain RN inputs.
3. Add a field with `appearance="ml:petal-count"`; intercept it in the renderer; mount the
   existing PetalCount widget ([CountPetals.js](../tasks/petalcounter/lib/CountPetals.js));
   write its integer back into the engine node.
4. Submit the instance via the C0 path.

*Proves:* engine portability, the `appearance`→custom-widget interception, and the round-trip to
a Submission.
*Pass* = a petal count from the native widget lands as a normal integer in a Central Submission.
*Fail* = engine needs browser APIs Hermes lacks → fallback: `@getodk/web-forms` (Vue) in a
WebView with the ML widget bridged natively.

### 0.5 The custom-widget authoring model

> 🔵 What makes an ML task authorable as **data, not code**: a shared input/output *envelope*
> with a **pluggable compute core**. Two cores are in scope — an OpenCV pipeline (a typed graph)
> and an ONNX model (a flat template). This is the differentiator, and it likely wants to be its
> own library.

**The shared envelope (every widget, regardless of core).**
- **Typed inputs** collected via auto-rendered UI controls: `camera → Image`,
  `colorPicker (over: photo) → Color`, `slider → Scalar`, `geo → Point`… These are the source
  nodes; the runtime renders them from a control palette, so there's no bespoke screen per
  widget.
- **A compute core** (pluggable — see A/B below).
- **Output coercion** to an ODK primitive (`integer` / `decimal` / `text` / `geopoint`), plus an
  optional intermediate image attached as Submission media.
- **Presents to ODK as one field**: `appearance="ml:<widget-id>"`. Central sees only the
  primitive — zero server knowledge of the internals. This is the seam that makes the whole
  thing composable with ODK.

**Compute core A — OpenCV pipeline (a typed DAG).**
A JSON graph of **whitelisted `react-native-fast-opencv` ops**, each with a typed signature.
Params are literals or bound to inputs. Terminal **reducers** (count peaks, count contours,
measure area) bridge `Mat → Scalar`. The petal counter
([CountPetals.js](../tasks/petalcounter/lib/CountPetals.js)) expressed as data:

```json
{
  "id": "petal-count",
  "core": "opencv",
  "output": { "as": "integer", "from": "count" },
  "inputs": [
    { "id": "photo", "ui": "camera",      "type": "Image" },
    { "id": "hue",   "ui": "colorPicker", "type": "Color", "over": "photo" }
  ],
  "pipeline": [
    { "id": "small", "op": "resize",            "in": "photo", "params": { "maxDim": 512 } },
    { "id": "hsv",   "op": "cvtColor",          "in": "small", "params": { "code": "BGR2HSV" } },
    { "id": "mask",  "op": "inRange",           "in": "hsv",   "params": { "lower": "={hue.lower}", "upper": "={hue.upper}" } },
    { "id": "clean", "op": "morphology",        "in": "mask",  "params": { "op": "open", "kernel": 5 } },
    { "id": "edt",   "op": "distanceTransform", "in": "clean" },
    { "id": "count", "op": "countPersistentPeaks", "in": "edt", "params": { "rel": 0.03 } }
  ]
}
```

*Who writes what:* **platform** ships the op palette + interpreter + coercers; **author** writes
the JSON DAG (no JS); **field user** just runs the inputs.
*Hard parts:* a small deliberate **type set** (`Image, Mask, Color, Scalar, Contours, Points,
Keypoints`); hand-written **reducers** (persistence isn't an OpenCV call — it's our `UnionFind`);
**three param scopes** (runtime / design-time / author-fixed); **live preview** of intermediate
Mats (already emitted as base64 today); **Mat lifecycle** (free intermediates or OOM).

**Compute core B — ONNX model (a flat template).**
Simpler authoring surface: the pipeline collapses to **preprocess → run → decode**, so there's no
graph to compose — just a fixed template parameterized by data.

```json
{
  "id": "leaf-disease",
  "core": "onnx",
  "model": "assets/leaf-disease-int8.onnx",
  "inputs": [{ "id": "photo", "ui": "camera", "type": "Image" }],
  "preprocess": { "size": 224, "layout": "NCHW", "color": "RGB", "mean": [0.485,0.456,0.406], "std": [0.229,0.224,0.225] },
  "task": "classification",
  "labels": ["healthy", "rust", "blight", "mildew"],
  "decode": { "reduce": "argmax", "threshold": 0.5 },
  "output": { "as": "text", "from": "label" }
}
```

*Task templates → primitive:* `classification → argmax → text`; `detection → count boxes → integer`
(+ annotated image media); `regression → decimal`; `segmentation → area/coverage → decimal`
(+ mask media).
*Who writes what:* **platform** ships the ONNX **runtime** (`onnxruntime-react-native`) + the
task-template decoders; **author** supplies a trained `.onnx` + the preprocess/decode contract +
labels — **all data**.
*Hard parts:* shipping/**versioning model binaries** (size; bundle vs. download-on-demand);
**licensing/provenance** of author-supplied models; **device perf** (quantization, NNAPI/CoreML
delegates); the main failure mode is a **preprocess/decode mismatch** with how the model was
trained; and you still have to **obtain/train** a model (which the app doesn't do).

**Compute core C — interactive / stateful ML (the human-in-the-loop case).**
Some models need a **loop with cached state**, not a one-shot pass. The canonical case is
**Segment Anything** (MobileSAM / EfficientSAM / EdgeSAM for on-device): a heavy **encoder**
runs **once per photo** → image embedding (cached), then a light **decoder** runs in ~ms on each
user **prompt** (foreground/background taps, a box, or the previous low-res mask fed back for
refinement). "Encode once, decode per tap" is what makes real-time interaction feasible on
device — and it's why on-device ML shines here (no network round-trip per tap).

```json
{
  "id": "leaf-area-interactive",
  "core": "onnx-sam",
  "models": { "encoder": "assets/mobilesam-enc-int8.onnx", "decoder": "assets/mobilesam-dec.onnx" },
  "inputs": [{ "id": "photo", "ui": "camera", "type": "Image" }],
  "preprocess": { "size": 1024, "normalize": "sam" },
  "interaction": {
    "ui": "maskEditor",
    "prompts": ["point:foreground", "point:background", "box"],
    "live": true,                         // re-run decoder on every edit (embedding cached)
    "phases": ["pre", "post"],            // seed before; correct after
    "controls": ["accept", "undo", "reset", "brush-touchup"]
  },
  "decode": { "select": "user-choice|max-iou", "refine": "low-res-mask-feedback" },
  "output": {
    "primary": { "as": "decimal", "from": "area_cm2" },   // needs a fiducial for real scale
    "media":   { "as": "image",   "from": "overlay" },
    "extra":   [{ "as": "integer", "from": "region_count" }]
  }
}
```

Core C adds three primitives the flat template lacks: a **cached intermediate** (embedding
persists across decoder calls), a **bidirectional control** (`maskEditor` both renders the mask
and emits prompts — input and output are one canvas), and a **declared interaction protocol**
(prompt types, pre/post phases, live vs. on-demand, accept/undo/reset).
*Hard parts:* **coordinate bookkeeping** (display px ↔ 1024×1024 model space ↔ original
resolution); **decoder input marshalling** (`image_embeddings, point_coords, point_labels,
mask_input, has_mask_input, orig_im_size`) hidden from the author; **encoder cost/size**;
mask→primitive needs a **fiducial** for real area; embedding/tensor **lifecycle**.

**How much of this is model-specific? Drivers vs. widgets.**
This is the crux of "can authors compose *many* models." The honest answer: **you don't build
one universal interactive engine — you ship a small, curated set of hand-written *core drivers*,
one per model *archetype*, and authors *configure* them (no code).** Two populations, not one:

- **Core-driver authors (us / advanced contributors, real code):** write a runner + decoder
  (+ any interaction control) for a *class* of model — written **once per archetype**, not per
  model. SAM is not a widget; it's the `onnx-sam` **driver** (the two-stage runner + the
  `maskEditor` control). Yes, that driver is a chunk of SAM-family-specific code — but it's
  written once and **amortised across every promptable-segmentation widget anyone authors**.
- **Widget authors (the no-code population, data only):** pick an existing driver, point it at
  model weights + a preprocess/decode contract + declare I/O. A "leaf area," "lesion area," or
  "canopy" widget is *configuration* over the one `onnx-sam` driver.

So "a wide variety of models" is true **within an archetype's I/O contract**, not "any arbitrary
model with zero code." A handful of archetypes cover most on-device vision:

| Archetype | New code to add it | New model in it |
|---|---|---|
| Classifier (image → logits) | tiny (core B template) | data only |
| Detector (image → boxes+scores) | a decode/NMS driver, once | data only |
| Single-shot segmenter (image → mask) | a mask-decode driver, once | data only |
| **Promptable/interactive (SAM family)** | the core-C driver, once | swap the two `.onnx` files |
| Regression / keypoints / embedding | small decoders, once | data only |

**New archetype = platform code; new model within an archetype = author data; new
parameterisation of a widget = survey-designer/field data.** That boundary is deliberate and
small. And it's the **proven industry pattern**, not a bet: MediaPipe Tasks (incl. an
`InteractiveSegmenter`), the TFLite Task Library, and Hugging Face `pipeline("image-segmentation"
/ "mask-generation")` all work exactly this way — a fixed set of *task types*, each with
task-specific pre/post code, into which compatible models plug as data.

Mapping it back to the SAM example: `inputs` / `output` / `preprocess` are **generic envelope**;
`interaction.*`, the two-model split, and `decode.refine` are the **`onnx-sam` driver's** config
surface; and `maskEditor` is **reusable across any promptable segmenter**, not SAM-only. The
SAM-specific tensor marshalling lives inside the driver, invisible to authors.

**When to use which.**

| | OpenCV DAG (A) | ONNX template (B) | Interactive (C) |
|---|---|---|---|
| Shape | composed graph, one-shot | pre → run → decode, one-shot | encode-once, decode-per-interaction |
| Best at | geometry, colour, counting | perception (ID/classify/detect) | user-guided segmentation / correction |
| Authoring | *composition* (wire ops) | *configuration* (fill template) | *configuration* over a platform driver |
| Platform cost | palette + interpreter | runtime + decoders | + stateful runner + bidirectional UI |

Both sit behind the same widget interface, so a single form can mix them freely — and a hybrid
(colour-mask crop → classify) is just core A feeding core B, which is why the cores may
eventually need to **compose**.

**Adopt vs. build: runtimes & references (don't reinvent the engine).** Verified state of the
RN-relevant tooling (Aug 2026):

| Tool | What it is | RN-native? | Role for us |
|---|---|---|---|
| `react-native-fast-tflite` | TFLite runtime (Nitro, zero-copy; CoreML/Metal + Android GPU/NNAPI delegates; runtime model-swap; MIT; Margelo) | ✅ | **Adopt** as a core B/C engine |
| `onnxruntime-react-native` | Official ONNX on-device runtime | ✅ | **Adopt** (SAM/MobileSAM ship as ONNX) |
| `@huggingface/transformers` (transformers.js) | `pipeline()` = model + pre/post via ONNX Runtime **WASM/WebGPU**; browser/Node; Apache-2.0; **`mask-generation`/SAM currently unsupported** | ❌ (browser) | **Reference** for pre/post decode |
| MediaPipe Tasks | Google task APIs incl. **`InteractiveSegmenter`** (point→mask); Android/iOS/Web/Python | ❌ (no official RN) | **Architectural reference** |
| TFLite Task Library | older task APIs, largely **superseded** (TFLite→LiteRT; folded toward MediaPipe) | ❌ | skip; heir is `fast-tflite` |

The decisive distinction: **a runtime is not a task library.** `fast-tflite`/`onnxruntime` run
tensors in and out — *"you are responsible for interpreting the raw data yourself"* — so the
per-archetype **decoder is ours by design** (that *is* the driver layer). Net: **adopt** the
runtime + CV ops (`react-native-fast-opencv`) + capture (VisionCamera); **port** pre/post from
the transformers.js / MediaPipe references; **build** only the envelope + authoring + coercion.
Core C/SAM is the most bespoke (transformers.js can't do mask-generation; MediaPipe's interactive
segmenter is neither RN nor arbitrary-SAM) → build it on `onnxruntime-react-native` with a
MobileSAM encoder+decoder.

**One runtime or two?** Keep the driver interface **runtime-agnostic**, ship **one** first (each
runtime adds tens of MB + native build surface), and add the second only on concrete need — the
driver layer makes that *additive*, not a rewrite. Leaning **ONNX-first** (`onnxruntime-react-native`):
it's the broadest model-acquisition target (PyTorch→ONNX via Optimum is the smooth path, which
directly serves "a wide variety of models") and the natural home for SAM/core-C — our flagship
differentiator. Add `react-native-fast-tflite` later as the **fast path** for live
VisionCamera-frame classifiers/detectors, where its zero-copy + GPU delegates + Margelo-stack
coherence (same author as our `react-native-fast-opencv`) pay off. (Core A / the petal counter
needs *no* model runtime at all.)

**This wants to be its own library.** The envelope + both cores are **ODK-agnostic and
survey-agnostic** — pure on-device RN vision/ML dataflow. Package it standalone (e.g.
`@org/rn-vision-tasks`) with Gather depending on it; the ODK adapter (`appearance` → widget,
output → primitive) stays a thin shim in the app. Keeps the engine testable, reusable, and
independently versioned — and it's the piece with value beyond this one app.

**Sequencing (don't build the editor first).**
- **v1:** 2–3 hand-written widgets, but **driven by these JSON specs internally** — refactor the
  petal counter to run from its spec (proves core A + the type system); add one ONNX classifier
  (proves core B).
- **v2:** publish the palette + JSON authoring format (power users write specs directly).
- **v3:** a visual node editor with live preview — sugar over a foundation that already works.

**Open sub-questions.**
- `onnxruntime-react-native` maturity on both platforms; NNAPI (Android) / CoreML (iOS)
  delegate support and quantization story?
- One runtime or two: ship ONNX-first behind a runtime-agnostic driver, add `fast-tflite` only
  when a live-frame perf case or a TFLite-only model demands it?
- Model distribution: bundle in the app vs. download-on-demand (via Central media / an assets
  CDN) keyed to the Form version?
- One shared type set across both cores; how do hybrids (A→B) declare the handoff?
- Preview/debug UX for authors without shipping a full editor in v1.
- Provenance/licensing policy for author-supplied models.
- Which archetypes/drivers ship first, and how strict/validated is a driver's model contract?

**Leaning:** 🟡 One widget **envelope**, a **curated set of pluggable compute cores/drivers**
(A OpenCV DAG · B ONNX template · C interactive/SAM-family — extensible by *platform* code per
archetype), with widgets authored as **data** on top and packaged as a **standalone RN library**
the survey app consumes. "Compose many models" = configuration **within** an archetype's
contract (the proven Task-Library pattern), not arbitrary models with zero code. Start by
expressing the petal counter as an OpenCV spec (A), add one ONNX classifier (B), then the
`onnx-sam` interactive driver (C) as the human-in-the-loop proof.

---

## Suggested Sequencing & Roadmap

> First-pass ordering by **dependency** and **priority** — refine later. Phases are
> dependency tiers, not fixed timelines.

**Phase 0 — Foundations (unblockers, do first)**
- **Shared auth/identity layer** (OIDC, per-user, group/role-scoped, revocable) — retire the
  static `x-api-key`. *Unblocks 4.3, 6, 7, 8.3.* **← highest leverage**
- **Groups + membership model** (`groupId` scoping) (4.1) — foundational for 4, 6, 8.6.
- **Settle terminology** (3.5 + 4.1): tenant / template / record / item.
- **Migration path off Atlas** (8.2, first step) — highest lock-in risk.

**Phase 1 — Near-term wins (mostly independent, ship early)**
- **CI/CD to stores** (1.2/1.4/1.5) — TestFlight + Play tracks; release-please; PR quality
  gates (1.6).
- **SSO** (7) — Google/Microsoft on the new auth layer.
- **Public REST API** (6) — expose the auth layer to scripts (read-first).
- **Mobile: remove authoring** (2.2) — shrinks surface before the UI redesign.

**Phase 2 — Core product reshape**
- **Data model overhaul** (3) — nestable collections, spreadsheets as import/export; leaf-only
  records *(decided)*. *Depends on groups (Phase 0).*
- **Web client authoring home + RBAC** (4.3/4.4) — where authoring lands.
- **Mobile group switcher** (4.2).
- **Per-item field-list UI** (2.1) — ODK-style collection redesign.

**Phase 3 — Differentiator**
- **Task marketplace, Phase 1** (5.1/5.4) — formalize registry, split `tasks-core` /
  `tasks-library`, curated flag-toggled tasks.
- **Declarative widget architecture** (5.5) + **CV widget palette harvested from PetalCounter**
  (5.6).
- **Model-driven ML** (5.2 Option C) — **add ONNX runtime**, port PetalCounter as reference.

**Phase 4 — Consolidation & scale**
- **Infra packaging** (8.5) — single `docker-compose`; env-selectable managed vs. self-hosted.
- **Storage → S3/MinIO** (8.2) — end the dual-vendor split.
- **Evaluate Postgres+JSONB vs. Mongo** (8.2/8.4) — Directus/Authentik ecosystem.
- **SaaS multi-tenancy** (8.6) on the `groupId` boundary.

**Deferred / opportunistic**
- Discovery-mode item identity (3.4) · Gherkin behavioral tests (1.7) · sandboxed expression
  language & arbitrary custom-code tasks (5.2 Option D).

**Dependency snapshot:**

```
Phase 0: Auth layer ──┬─► SSO (7)
  + Groups            ├─► Public API (6)
  + Terminology       ├─► RBAC/Web authoring (4.3/4.4)
  + Atlas migration   └─► Data model (3) ─► Per-item UI (2.1)
                                          └─► Task marketplace (5) ─► ML tasks
Phase 1 CI/CD (1) ── mostly independent, ship anytime
Phase 4 Infra (8) ── needs storage/auth seams from Phase 0
```

---

## 1. CI/CD & Release Workflow

Current state (v1): Expo Application Services (EAS) Build, driven partly by a GitHub
Actions workflow ([.github/workflows/eas-build.yml](../.github/workflows/eas-build.yml)),
distributing **internal** (Ad Hoc / registered-device) builds for both platforms. Pain
points: iOS Ad Hoc device registration, expired provisioning profiles, manual profile
regeneration, no store presence, limited automated quality gates.

### 1.1 Build tooling — EAS vs. GitHub Actions + Fastlane 🔵

**Question:** Do we stay on EAS Build (and just build better workflows around it), or
migrate to self-managed GitHub Actions + Fastlane like the Flutter app?

**Context / important difference:** This is an **Expo-managed** React Native app. EAS
runs `expo prebuild` to generate the native `ios/`/`android/` projects from
[app.config.js](../app.config.js) and applies config plugins. Fastlane alone does **not**
do this — going pure Fastlane means either committing to the bare workflow (checking in
`ios/`/`android/`) or scripting prebuild ourselves. That's the biggest hidden cost of a
migration.

| Option | Pros | Cons |
|---|---|---|
| **A. Stay on EAS, improve workflows** | Least effort; native credential mgmt handled; prebuild + config plugins "just work"; EAS Submit to stores; consistent with current setup | Hosted cost at scale; build-queue latency; less low-level control; vendor lock-in |
| **B. GitHub Actions + Fastlane (self-managed)** | Full control; unifies tooling with Flutter project; own the pipeline; potentially cheaper at high volume on self-hosted runners | Must manage prebuild, signing (`match`), macOS runners (cost/maintenance); significant setup; we re-own everything EAS abstracts |
| **C. Hybrid — GH Actions orchestrates EAS + EAS Submit** | Keeps prebuild/credentials on EAS but centralizes triggers/logic in Actions; incremental from where we are today | Still on EAS for the heavy lifting (cost/lock-in remains) |

**Open sub-questions:**
- What's our monthly build volume, and where does EAS pricing bite vs. macOS runner minutes?
- Do we want to stay Expo-managed long-term, or is a bare/Fastlane workflow the direction for v2?
- How much does "matches our Flutter tooling" reduce team cognitive load?

**Leaning:** 🟡 Likely **C (hybrid)** short-term (low risk, gets us store submission via
EAS Submit) with a spike to evaluate **B** if EAS cost/control becomes limiting. Decision TBD.

### 1.2 Store distribution & retiring internal builds 🔵

**Goal:** Ship to the **Apple App Store** and **Google Play Store**; stop relying on
internal / Ad Hoc distribution (especially the painful iOS UDID registration loop).

**Beta/testing tracks that replace internal distribution:**
- **iOS → TestFlight:** no per-device UDID registration; internal testers (up to 100,
  fast) and external testers (up to 10,000, light review). This alone removes most of our
  iOS pain.
- **Android → Play Console testing tracks:** internal / closed / open testing; internal
  track installs in minutes.

**Submission mechanics:** EAS Submit can push to both stores (pairs with option 1.1.A/C),
or Fastlane `pilot` (TestFlight) / `supply` (Play) (pairs with 1.1.B).

**Open sub-questions:**
- Do we go straight to public store listings, or live on TestFlight + Play closed testing
  during v2 hardening?
- Who owns the Apple App Store Connect + Play Console org accounts under **Imaging for Good**?
- App review readiness: privacy nutrition labels, data-safety form, screenshots, support URL.

**Note:** This intersects heavily with **1.3** — public store listing forces the access-control
question.

### 1.3 Access control — limiting who can use the app 🔵

**Tension:** The app serves a **specific research group**, but a public App/Play Store
listing means *anyone can download it*. We need to decouple **who can install** from
**who can use**.

**Options:**
| Option | Mechanism | Fit |
|---|---|---|
| **A. Public listing + auth gate** | Anyone downloads, but only provisioned accounts can log in / use. We already have Firebase Auth + an API-key'd backend — enforce an allowlist / invite-only registration / admin approval. | Strong fit; cleanest separation; scales |
| **B. Closed testing tracks only** | Stay on TestFlight (invite) + Play closed testing; never publish publicly. Limits install to invited emails. | Good for a fixed research group; caps tester counts; not a "real" store presence |
| **C. Private/unlisted enterprise dist** | Apple Business Manager custom apps / Play private app to an org. | Heavier setup; best if strictly one institution |

**Backend reality:** Even with a public listing, the app is useless without a valid
provisioned account — Firebase Auth + the custom API already gate all data. So **A** may
give us public discoverability *and* real access control with the least friction.

**Open sub-questions:**
- Invite-only vs. admin-approved vs. domain-restricted (e.g. only `@imagingforgood.org`) registration?
- Is there a **free tier** vs. paid/tiered concept, or is access simply "provisioned or not"?
  (If tiering is real, that's a product/monetization sub-thread to spin out.)
- Where does the allowlist live — Firebase custom claims, a backend users table, or both?

**Leaning:** 🟡 **A — public (or closed-beta first) listing with an auth-enforced allowlist.** Decision TBD.

### 1.4 Automatic build triggers 🔵

**Goal:** Modernize the GitHub workflow triggers *[Flutter model]*.

Current: [eas-build.yml](../.github/workflows/eas-build.yml) triggers on push to
`main` / `hotfix/*` / `feature/*` + `workflow_dispatch` (with profile + platform inputs).

**To define:**
- Branch → environment mapping (e.g. `main` → production, `develop`/`staging` → testing,
  PR → smoke/dev).
- Tag-driven release builds vs. branch-driven.
- Path filters to skip builds on docs-only changes.
- Concurrency controls (cancel superseded builds).

**Action:** Port the trigger matrix from the Flutter project and adapt to EAS profiles
(`development` / `testing` / `production`).

### 1.5 Release automation — release-please 🔵

**Goal:** Adopt release-please for automated versioning + changelogs *[Flutter model]*.

**To define:**
- Conventional Commits enforcement (commitlint on PRs).
- release-please config: version bumps in [app.config.js](../app.config.js) `version` +
  native versions, `CHANGELOG.md` generation, release PR flow.
- How release-please tags tie into the production build trigger (1.4) and store submission (1.2).

**Action:** Reuse the Flutter release-please workflow as a template; adapt versioning to
Expo's `version` + `runtimeVersion` policy and store build numbers.

### 1.6 PR & build quality gates 🔵

**Goal:** Automated checks on PRs and builds — lint, code checks, style enforcement, unit
tests, and conditional smoke builds.

**Proposed gates:**
- **Lint / static analysis:** ESLint (+ React/React Native plugins), TypeScript check if/when we adopt TS.
- **Formatting:** Prettier `--check`.
- **Unit tests:** Jest + React Native Testing Library — run on every PR.
- **Smoke build:** trigger a build in specific scenarios — e.g. before a **production**
  release, run a full build to catch native/config breakage (like the Node/eas-cli engine
  and expired-profile failures we just hit).
- **Commit hygiene:** commitlint (Conventional Commits) to feed release-please (1.5).

**Open sub-questions:**
- Do we have/seed a unit test suite yet? (Bootstrapping cost.)
- Required vs. advisory checks — which block merge?
- Where do smoke builds run (EAS build minutes vs. a lightweight `expo prebuild` compile check)?

### 1.7 Behavioral tests → QA checklists ⚪ (lower priority)

**Goal:** Author behavioral tests for major user workflows in **Gherkin** *[Flutter model]*.
**Not** automated yet — used to generate **QA checklists** for manual testers before a release.

**Candidate workflows to spec in Gherkin:**
- Register / login / logout (Firebase Auth).
- Pull survey designs from API, create/edit a design, sync back.
- Run a survey end-to-end (each task type), capture media, upload results (media → Firebase Storage, then `POST /surveys/results`).
- Offline capture → later upload.

**Action:** Write `.feature` files as living QA references; revisit automation
(e.g. Detox/Maestro) in a later phase.

---

## 2. App UI & Structure

Two big shifts for v2: (a) redesign the in-field data-collection UI around a
**per-item field list** (ODK-style) instead of a linear task wizard, and (b) **strip all
authoring/management** (survey design editing + spreadsheet upload) out of mobile so the
app is a pure, hand-it-to-an-intern **data collection** tool, with authoring living in the
web client.

### 2.1 Survey collection layout — per-item field list 🔵

**Current behavior:** [screens/TaskAction.js](../screens/TaskAction.js) is a **linear
wizard**. You tap an item in [screens/CollectionList.js](../screens/CollectionList.js),
then step through every task in `surveyDesign.tasks` sequentially (fade in/out between each
`taskAction` component from [tasks/TaskManifest.js](../tasks/TaskManifest.js)). Only after
the *last* task does `itemCompleted()` save the observation and advance to the next item.
It's forward-only — you can't see or revisit fields out of order, and there's no at-a-glance
progress for an item.

**Proposed design (ODK-style):** Tapping an item opens an **item detail screen = a single
scrollable list of fields**, one row per task:

| Task type | Row rendering |
|---|---|
| Text / Number / Barcode | Inline input box (fill directly in the list) |
| Choice | Inline selector (or tap-in if long) |
| GeoPoint | Row with captured coords / "Tap to capture" |
| Photo | Thumbnail preview (or placeholder) |
| MultiPhoto | Gallery thumbnail strip / placeholder |
| Video | Video thumbnail placeholder |

- Tapping a media/complex row opens the **existing `taskAction` recording interface**
  (reused as-is), which returns to the list on completion.
- Each row shows **completion status**; the header/footer shows **item progress (x / y)**.
- A prominent **call-to-action button** — "Complete item XYZ" — at the bottom (or top)
  finalizes and saves the observation.
- Fields become **editable in any order** and **revisitable**; partial progress + resume
  is natural (vs. today's forward-only flow).

**Implementation notes / where it touches code:**
- Introduce a new **item-form screen** between `CollectionList` and `TaskAction`.
- Extend [TaskManifest.js](../tasks/TaskManifest.js) so each task type can provide a
  compact **list-row / preview** renderer (and, where applicable, an **inline input** mode)
  alongside its existing `taskAction`.
- Decouple observation persistence from the wizard: `addObservation` should support
  incremental per-field updates instead of one save at the end
  ([contexts/SurveyDataContext.js](../contexts/SurveyDataContext.js)).
- Reuse existing `taskAction` components as the drill-in "recording interface."

**Open sub-questions:**
- Which task types render **inline** vs. **drill-in modal**? (Text/Number inline is clear;
  Choice depends on option count.)
- **Required vs. optional** fields, and do we **validate/block** "Complete item" until
  required fields are done?
- Progress model: simple count (x/y) or required-vs-optional aware?
- Video/multiphoto **thumbnail generation** — real thumbnails vs. placeholder icons in v1 of this redesign?
- Do we keep the fade-based single-task view anywhere, or fully replace it?

### 2.2 Remove authoring/management from mobile → web-only 🔵

**Principle:** The mobile app should be **solely a data-collection tool** — something you
hand to an intern or lab member to go collect data in the field. Survey **design editing**
and **spreadsheet uploading** belong in the **web client**, not on the device.

**Mobile surfaces to remove (all in [App.js](../App.js#L50) nav graph):**
- `SurveyBuilder`, `NewSurvey` — survey design authoring
- `TaskSelector`, `TaskSetup` — task configuration (the `taskSetup` half of TaskManifest)
- `CollectionDesignList`, `CollectionName`, `NewItem` — design-side collection/item creation
- `UploadSurveys` — spreadsheet/xlsx upload (+ [utils/xlsxUtils.js](../utils/xlsxUtils.js))

**Mobile keeps (data collection only):**
- Pull designs: `GET /surveys/designs` via `loadDesignsFromAPI`
  ([contexts/SurveyDesignContext.js](../contexts/SurveyDesignContext.js)).
- Pick a design → collect data (the 2.1 flow).
- Upload results: `POST /surveys/results` ([utils/api.js](../utils/api.js)).

**Web client owns:** design authoring, task/collection/item setup, and xlsx import
(parity check needed against [reference/web-client](../reference/web-client)).

**Open sub-questions:**
- **Field-time item creation:** interns often need to add items/samples *in the field*
  (a very ODK use case). Do we fully lock collections/items to web authoring, or keep a
  minimal on-device "add item to a collection"? (This is the one piece of "management"
  that may need to stay.)
- Does the web client currently support **all task types' setup** + **xlsx import** at parity
  before we remove them from mobile?
- Drop the `taskSetup` components + `PUT /surveys/designs` upsert usage from mobile entirely,
  or keep the code dormant?
- Keep a **read-only** design/collection explorer on mobile (e.g. a trimmed
  [screens/SurveyExplorer.js](../screens/SurveyExplorer.js)) so field users can review
  what they're collecting?
- What's the sequencing — remove authoring **before or after** the 2.1 redesign? (They're
  independent; removing authoring first shrinks surface area for the redesign.)

**Dependency:** 2.2 assumes the web client is the source of truth for designs — ties back to
**1.3 access control** (who can author vs. who can collect) and the API contracts already
in place.

---

## 3. Data Model & Structure Overhaul

This is the largest and most open-ended area: rethinking how we represent **what gets
collected** (the schema), **what it's collected about** (the physical/abstract items), and
**the records themselves** — while deciding the future role of spreadsheets and how much
structural flexibility we expose without drowning users in complexity.

> **⚠️ Revisit in light of Section 0 (ODK Entities).** Much of this section predates the
> "own the frontend, use ODK as the backend" direction ([0.1](#01-option-c-in-depth-own-the-frontend-use-odk-as-the-backend)).
> **ODK Entities** — a *new* ODK capability that did **not** exist when this project began, and
> the thing that makes riding ODK's backend viable at all — already solves much of what's
> proposed below, and elegantly. The [0.2 worked example](#02-worked-example-mapping-a-nested-field-site-layout-onto-odk-entities)
> shows our canonical field-site hierarchy mapping onto a single flat Entity List (coordinates
> as properties; the tree as an *addressing scheme*, not stored nesting). If we adopt Option C,
> expect this section to shrink dramatically: **3.2 nesting**, **3.3 spreadsheets** (Entities +
> CSV import already cover this), and **3.4 longitudinal/field-time items** (Entity Lists +
> the `trees`/`tree_measurements` 1→many pattern) largely become "model it as Entities" rather
> than "build it." Kept below **as-is for now** so we don't lose the original thinking; treat
> the Entities mapping as the leading candidate when we return to it.

### 3.0 Current model & its constraints (context)

Today we conflate several concerns into "surveys defined via XLSX":

- A **survey design** = an ordered list of **tasks** (the things we record — see
  [tasks/TaskManifest.js](../tasks/TaskManifest.js): text, number, choice, photo,
  multiphoto, video, geopoint, barcode).
- A **physical layout** = **collections → items** (e.g. a field → plants), authored via
  XLSX, **hard-capped at two levels** because that's what fits a spreadsheet.
- **Observations** = recorded task data, tied to a specific item, stored as JSON.

The spreadsheet trick (borrowed from ODK's XLSForm) is powerful for **bulk item creation**
(thousands of plants; drag-fill + autocomplete in Excel/Sheets; users already keep their
experimental layouts as spreadsheets) — but it forces the whole model into a flat,
2-level, tabular shape and makes spreadsheets a *first-class citizen of the data model*
rather than just an I/O format.

### 3.1 How ODK separates these concerns (reference)

From the ODK docs ([XLSForm](https://docs.getodk.org/xlsform/),
[Entities](https://docs.getodk.org/central-entities/)):

- **Form / schema** — the `survey` sheet (fields = `type`/`name`/`label`), `choices`,
  `settings`. Nesting comes from **groups** (`begin_group`/`end_group`) and **repeats**
  (`begin_repeat`/`end_repeat`), *not* from the spreadsheet's row/column shape.
- **Entities** — each managed item is an **Entity** (physical: a tree; or abstract: a site
  visit). Same-type Entities live in an **Entity List** (formerly "Dataset"). Entities
  have **properties**. Registration forms *create* Entities (in the field, offline),
  follow-up forms *use/update* them.
- **Submissions** — the filled instances (our "observations").
- **Spreadsheets are I/O, not the model** — bulk **CSV import** populates Entity Lists;
  Entities can also be created manually in the web UI or on-the-fly by a submission.
- **Conflicts** — parallel offline updates use last-write-wins, surfaced for review.

**Mapping:**

| Ours (v1) | ODK analog | Proposed (v2) |
|---|---|---|
| Survey design (tasks) | Form / schema | Schema/template (renamed — see 3.5) |
| Task | Field / question | Field |
| Collection → Item (2 levels, XLSX) | Entity List → Entity | Nestable item tree / entity lists |
| Observation (JSON) | Submission | Record/observation |
| XLSX as data model | XLSForm + CSV import | Spreadsheet as **import/export only** |

### 3.2 Infinitely nestable collections/sub-collections 🔵

**Goal:** Replace the 2-level `collection → item` cap with **arbitrary nesting**
(collections within collections), which the user likens to **nested directories** for a
human-readable interface.

**Options:**
| Option | Shape | Notes |
|---|---|---|
| **A. Recursive tree (adjacency list)** | Each node has a `parentId`; items are leaf (or any) nodes | Natural "nested directory" UX; simple to render as an expandable tree; easy partial loads |
| **B. Materialized path / nested set** | Store path like `/field/blockA/row3/plant12` | Human-readable, great for search/breadcrumbs; more care on moves/renames |
| **C. Keep flat + grouping metadata** | Flat items with tags/attributes | Least disruptive; but doesn't truly deliver nesting |

**🟢 Decided — records attach to leaf items only.** Only leaf **items** hold recorded
data; intermediate **collections/sub-collections** are structure, not recording targets.
We've seen use cases for recording on a mid-tree node, but that's better modeled as **its
own survey** rather than complicating the tree semantics.

**Open sub-questions:**
- Depth limits (UX/performance) vs. truly unbounded?
- How does nesting interact with the mobile collection UI (Section 2.1) — breadcrumbs,
  drill-down, "current location"?
- Realm/DB representation: recursive schema in Realm, or a path string + index?

**Leaning:** 🟡 **A (recursive tree)** for the model + a directory-style drill-down UI;
possibly store a materialized path alongside for readable breadcrumbs/search. Recording is
leaf-only (decided above).

### 3.3 Future of spreadsheets / XLSX 🔵

**Tension:** Spreadsheets are limiting as the *core model*, but genuinely excellent for
**bulk item creation** — thousands of rows, drag-fill, autocomplete — and **our users
already maintain field/experimental layouts as spreadsheets.** Dropping them entirely
would remove a real workflow advantage.

**Reframe (from ODK):** Separate **schema/template authoring** from **bulk item data**.
Spreadsheets don't need to be the model; they can be a **first-class import/export format**
that populates a richer underlying representation.

| Option | Description |
|---|---|
| **A. Spreadsheet as import/export only** | Core model = nestable entity tree (3.2); XLSX/CSV is one way to *bulk-load* or *export* items. Keeps the drag-fill workflow, drops the structural limits. |
| **B. Keep XLSX first-class + extend** | Add conventions (e.g. path columns) to encode nesting in sheets | Familiar, but re-inherits spreadsheet constraints |
| **C. Drop spreadsheets entirely** | Web authoring UI only | Cleaner model, but loses a workflow users love; likely too disruptive |

**Open sub-questions:**
- Can a flat CSV encode a nested tree acceptably (e.g. a path/parent column) for import?
- Round-trip fidelity: export tree → edit in Excel → re-import without data loss?
- Is bulk creation the *only* thing we need spreadsheets for, or also editing/QA?

**Leaning:** 🟡 **A** — keep spreadsheets as a beloved **import/export path**, not the model.

### 3.4 Field-time item creation & open-ended collection 🔵

**Question:** Must every recorded task attach to a **predefined item**, or can items be
created in the field? (Directly connects to Section 2.2's "field-time item creation.")

**Scenarios to support:**
- **Predefined layout** — items defined up front (web/spreadsheet), intern just fills them
  in. (Today's model.)
- **Auto-create on record** — if a referenced item doesn't exist, create it implicitly.
- **On-the-fly / ad-hoc mode** — start recording without a predefined layout; items are
  born as you go.
- **Open-ended discovery** — "photograph every mushroom we find in this forest" — count
  unknown ahead of time; each find is a new item/entity. (Maps directly to ODK
  **registration forms** creating **Entities** in the field, offline.)

**🟢 Clarified — longitudinal follow-up is already handled by predefined items.** Because
collections and items are **predefined**, a data collector can revisit the same predefined
item across sessions and add new data — that's exactly what the current setup does. We do
**not** need a separate cross-form entity mechanism to get longitudinal revisits for the
predefined case.

**Design implications:**
- Need a notion of **item identity** for field-created items (client-generated id + label);
  we already client-generate `BSON.ObjectId`s.
- **Offline creation + later sync**, with a possible **conflict** case — do we need
  conflict handling, or is our data append-mostly?
- A per-survey **collection mode** flag: `predefined` vs. `ad-hoc/discovery`?

**🔵 Deferred (future design question) — discovery-mode item identity.** For open-ended
collection (e.g. the **mushroom-in-the-woods** survey), an item needs a **persistent
identity scoped to that survey** — a collection + name + ID — created the first time we
encounter it. On a later visit we can **re-open that same item and add new data**; a new
find becomes a **new item** recorded for the first time. What the create/revisit UX and
identity model look like is a design question we're **deferring** — but it's the discovery
analog of the predefined-item longitudinal behavior above.

**Open sub-questions:**
- One unified item model (some predefined, some field-created), or distinct modes?
- If field-created, how are labels/identity assigned so records stay meaningful and
  re-findable on revisit?
- Discovery-mode: how does a collector **find and re-select** a previously created item in
  the field (search by name, map, recent list)?

**Leaning:** 🟡 Predefined collections/items remain the primary model (covers longitudinal
today). Discovery/ad-hoc item creation with persistent per-survey identity is a **deferred**
future mode, not v2-blocking.

### 3.5 Terminology — replacing "survey" ⚪

**Problem:** "Survey" is disliked and overloaded (it conflates the *template* and the *act
of collecting*). We want a better word (or words) — and ODK's split of **Form** (template)
vs **Submission** (record) vs **Entity** (item) suggests we may need **more than one**
term.

**Candidate replacements for the template/design concept:**
- **Protocol** / **Collection Protocol** — fits field-science framing
- **Datasheet** / **Field Sheet** / **Recording Sheet**
- **Template** / **Form** / **Field Form**
- **Study** / **Project** (if it's the umbrella) vs. the recording template inside it

**Open sub-questions:**
- Do we need distinct words for **template** vs. **a filled record** vs. **an item/entity**?
- Should "**task**" also be renamed (→ "field"/"question"/"measurement") for consistency?
- Match the web client's terminology so both surfaces agree.

**Leaning:** 🟡 Likely **"Protocol"** (template) + **"Record/Observation"** (filled) +
**"Item/Entity"** (subject). Final wording TBD — worth a quick team vote.

### 3.6 Guiding tension (call-out)

Every decision here trades **power vs. simplicity**. Infinite nesting, ad-hoc items, and
longitudinal follow-up are powerful but can overwhelm a field intern. The design bar:
**an intern can be handed the app and collect data without training**, while power users
get flexible structure via the web authoring tools. Keep the *mobile* surface simple; put
the *complexity* in web authoring + the underlying model.

---

## 4. User Management, Groups & Permissions

Introduce **multi-tenancy**: one account can belong to several **groups**, seeing only the
surveys for the group it's currently acting in, with a **Slack-style workspace switcher**
on mobile. All **authoring/management** (survey design + spreadsheet upload + survey
management) consolidates into the **web client** behind **robust roles & permissions**.
This extends **1.3 (access control)** and **2.2 (mobile = collection only)**, and scopes
the **3.x data model** to groups.

### 4.1 Groups / workspaces model (Slack analogy) 🔵

**Goal:** A single identity ([contexts/AuthContext.js](../contexts/AuthContext.js) /
Firebase Auth) with membership in **multiple groups**. Surveys, collections/items, and
records are **scoped to a group**; a user only sees the surveys for the group they're in.

**Model sketch:**
- `Group` (a.k.a. workspace/team/lab) — the tenant boundary.
- `Membership` — join of `user ↔ group` **carrying a role** (see 4.3); a user has many
  memberships.
- `Survey`/design, collections/items, and records all gain a **`groupId`** owner.

**Open sub-questions:**
- Term for the tenant: **Group** vs. Workspace vs. Team vs. Lab vs. Organization? (Match
  the survey-terminology decision in 3.5.)
- One flat level of groups, or do groups nest (org → lab → project)? (Interacts with 3.2.)
- Can a survey be **shared across groups**, or is it strictly owned by one?
- Does a **record** belong to the group active at capture time (immutable), even if the
  user later leaves that group?

### 4.2 Mobile group switcher 🔵

**Goal:** A simple **toggle to switch the active group** on mobile, à la Slack workspaces —
the mobile app's only "management" concession, since it stays collection-focused (2.2).

**UX sketch:**
- A **current-group indicator** + switcher (drawer header / avatar menu).
- Switching re-scopes the survey list (`loadDesignsFromAPI` filtered by active group) and
  where new records are attributed.
- Persist the **last active group** locally (AsyncStorage) so restart resumes it.

**Open sub-questions:**
- What if a user is in **exactly one** group — hide the switcher entirely?
- Offline: is the active group cached so a collector can switch/collect without connectivity?
- Does switching mid-collection need guardrails (don't strand an in-progress record under
  the wrong group)?

### 4.3 Roles & permissions (RBAC) 🔵

**Goal:** More robust roles so authoring/management can live safely in the web client, with
clear separation between who **designs** surveys and who **collects** data.

**Candidate role set (per-group):**
| Role | Web authoring | Spreadsheet upload | Survey mgmt | Mobile collection | View data |
|---|---|---|---|---|---|
| **Owner/Admin** | ✅ | ✅ | ✅ (+ manage members) | ✅ | ✅ |
| **Designer/Author** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Collector** | ❌ | ❌ | ❌ | ✅ | own/limited |
| **Viewer** | ❌ | ❌ | ❌ | ❌ | ✅ (read-only) |

**Enforcement — important architectural note:** roles must be enforced **server-side**, not
just hidden in the UI. The mobile app currently authenticates to the API with a **static
`x-api-key`** ([utils/api.js](../utils/api.js)), which is **not user- or group-scoped**. To
enforce per-group roles we'll need the API to verify a **per-user credential** (e.g. Firebase
**ID token** / custom claims) and authorize by membership + role. This is a real backend
change and overlaps with **1.3**.

**Open sub-questions:**
- Where do memberships/roles live — Firebase **custom claims**, a backend users/memberships
  table, or both (claims for fast checks, DB as source of truth)?
- Fixed role set vs. granular permissions? (Start fixed; granular later.)
- Cross-group **super-admin** (us/support) role?
- Invite flow: admin invites by email → provisions membership (ties to 1.3 allowlist).

### 4.4 Web client as the authoring/management home 🔵

**Goal:** Everything removed from mobile in **2.2** lands in the web client as first-class,
role-gated features: **survey design**, **spreadsheet/XLSX upload** (if retained per 3.3),
and **survey management** (versioning, publish, archive), all **scoped per group**.

**Open sub-questions:**
- Does the web client already have group/role scaffolding, or is this net-new
  ([reference/web-client](../reference/web-client))?
- Publish/versioning model: draft vs. published surveys (echoes ODK form drafts) so field
  collectors only pull **published** designs?
- Member management UI (invite, assign roles, remove) — Owner/Admin only.
- API surface: new endpoints for groups, memberships, and group-scoped survey/design/record
  queries (extends the contracts in [utils/api.js](../utils/api.js) + the API team's set).

**Leaning:** 🟡 Per-group RBAC with a fixed role set (Owner / Designer / Collector /
Viewer), server-side enforcement via per-user tokens, and a Slack-style group switcher on
mobile. Terminology + nesting TBD.

---

## 5. Task Library / Marketplace (Extensible Tasks)

**The key differentiator vs. ODK.** Today's task types are **hardcoded** into the app; we
want researchers/developers to **publish and install custom tasks**, turning Gather from a
"budget ODK clone" into an extensible platform — modeled on **Alexa Skills** and the
open-source **Mycroft** voice-assistant skill marketplace.

### 5.0 Current state (context)

Tasks are a **static registry**: [tasks/TaskManifest.js](../tasks/TaskManifest.js) maps a
`typeID` → `{ taskAction, taskSetup, taskModule }`. Each task type is a folder under
[tasks/](../tasks/) with three parts:
- **`taskModule`** — a [Task](../tasks/Task.js) subclass (static `typeID`,
  `typeDisplayName`, `typeDescription`, `typeIcon`, setup/action view paths).
- **`taskSetup`** — design-time config UI (moving to web per 2.2).
- **`taskAction`** — collection-time capture UI.

This registry pattern is already a good seam for a plugin system — adding a task today
means editing the manifest and shipping a release. The **PetalCounter**
([tasks/petalcounter/lib/CountPetals.js](../tasks/petalcounter/lib/CountPetals.js), OpenCV
flood-fill/segmentation, currently disabled in the manifest) is the proof that **on-device
CV tasks** are viable.

**Platform reality check:**
- ✅ **OpenCV.js is present** — `react-native-fast-opencv` ([package.json](../package.json#L53)),
  used by PetalCounter.
- ⚠️ **ONNX runtime is NOT in the project yet** — no `onnxruntime`/tflite/ort anywhere in
  the codebase. On-device neural inference would require **adding** a runtime
  (e.g. `onnxruntime-react-native`) before ML tasks are possible. (Correcting the
  assumption that it's already available.)

### 5.1 Concept — Tasks Core vs. Tasks Library 🔵

- **Tasks Core** — the vetted, built-in set shipped with the app (today's manifest).
- **Tasks Library** — a separate **repo / registry** ("marketplace") where developers
  publish tasks. After passing **review + automated tests**, a task is added to the
  library. In the web client, a group/account can **install library tasks beyond Core**,
  and those then appear as **options when building survey tasks**.

**Naming:** likely **`tasks-core`** and **`tasks-library`** (own repos/folders).

### 5.2 The hard problem — delivering tasks onto devices 🔵

React Native **can't load arbitrary native modules at runtime**, and running **untrusted
third-party code** on collectors' devices is a real security concern. Options, roughly in
order of increasing power *and* risk:

| Option | How custom tasks reach the device | Power | Risk / cost |
|---|---|---|---|
| **A. Curated, compiled-in library + feature flags** | Library tasks are vetted and **bundled into the app**; groups just **enable/disable** which appear. Delivery via app releases + **EAS Update** (OTA JS). | Low-med | Low — safest; but "install" = toggle a pre-shipped task, not true 3rd-party injection |
| **B. Declarative/config-driven tasks** | Tasks defined by a **declarative schema** (data, not code) fetched at runtime; a generic renderer interprets it. | Med | Low-med — safe & injectable, but limited to what the schema expresses (great for form-like, weak for arbitrary logic) |
| **C. Model-driven ML tasks** | Bundle the **runtimes** (OpenCV + ONNX); a library task ships a **model file + declarative pre/post pipeline**. The "custom" part is the **model + config**, not native code. | Med-high | Med — enables custom on-device ML *safely*; needs a stable inference/pipeline contract |
| **D. Sandboxed custom JS** | Fetch task JS and run it in a **sandboxed JS engine** (e.g. QuickJS) with a constrained API. | High | High — arbitrary logic, but hard to sandbox safely; heavy review burden |

**The unique unlock (C):** With OpenCV already bundled and ONNX added, **custom on-device
ML data-collection tasks** become possible — e.g. count/segment/classify from a photo — where
library authors contribute **weights + a declarative pipeline** rather than shipping code.
PetalCounter is the hand-written prototype of exactly this shape.

### 5.3 Publish/review pipeline 🔵

Modeled on Alexa/Mycroft skill submission (ties to **Section 1 CI/CD**):
- Developer submits a task to the **`tasks-library`** repo (PR).
- **Automated tests** run (contract conformance, lint, maybe a sample-input harness);
  human **review** for safety/quality.
- On pass → merged/published into the library registry; becomes installable in the web client.

**Open sub-questions:**
- What's the **task contract/SDK** a third party codes against (inputs, outputs, lifecycle,
  permitted capabilities)? This is the foundation — 5.2's options all need it.
- Versioning & compatibility: how do library tasks declare the app/runtime versions they need?
- Trust model: who can publish? Vetted authors only, or open with review? Signing?
- For ML (C): allowed model formats/size limits; where models are hosted/delivered; how
  they're cached on-device.
- How does an **installed** library task get **injected** at runtime given the chosen 5.2
  option (bundle flag vs. fetched schema vs. fetched model+pipeline)?

### 5.4 Recommended phasing (leaning) 🟡

A "really simple first pass" that still delivers the differentiator:

1. **Phase 1 — formalize the registry + curated library.** Refactor `TaskManifest` into a
   cleaner plugin registry; split **`tasks-core`**; add a **`tasks-library`** of vetted
   tasks; let the web client **enable/disable** tasks per group (Option A). Delivery via
   releases + EAS Update. *(Achievable now; ~80% of the seam already exists.)*
2. **Phase 2 — model-driven ML tasks.** Add an **ONNX runtime**, define a **model + declarative
   pipeline** contract (Option C), and port PetalCounter to it as the reference task. This
   is the real "unique capability" milestone.
3. **Phase 3 (stretch) — sandboxed custom logic** (Option B/D) if arbitrary third-party
   behavior is needed beyond declarative + model-driven tasks.

**Leaning:** 🟡 Start with **A (curated, flag-toggled library)** to ship the marketplace UX
safely, then invest in **C (model-driven ML)** as the differentiator. Defer **D** (arbitrary
sandboxed code) until there's proven demand — the security/maintenance cost is high.

### 5.5 Chosen architecture — declarative component composition (feasible ✅) 🟡

**The unlock that makes the marketplace safe:** authors **never ship code — they ship
data.** Everything that executes is a **pre-compiled, vetted widget** already in the app.
A library task = a **declarative graph of widgets + a model artifact**, injected as data
(OTA-deliverable, reviewable, no `eval`, no native linking). This is essentially **B + C
combined**, and it's the generalization of what **PetalCounter already does**
(capture → preprocess → infer/segment → postprocess → display/confirm → record).

**Building blocks:**
1. **Component registry** — compiled-in primitives with **typed inputs/outputs**:
   - *Sensor sources:* camera/image, video, microphone/audio, GPS/geopoint, LiDAR/depth,
     barcode.
   - *Transforms:* resize, crop, normalize, colorspace, threshold, morphology (OpenCV).
   - *Inference:* a widget that runs the bundled **ONNX/OpenCV** on an input tensor/image.
   - *Outputs/UI:* number, choice, overlay preview, confirm/adjust.
2. **Task schema / DSL** — JSON describing the **pipeline** (wire each widget's outputs →
   the next widget's inputs) plus display + validation. Linear sequence = simple case;
   a **typed DAG** is what ML tasks need.
3. **Model reference** — weights (ONNX/tflite) + pre/post steps expressed *as components*.
4. **Runtime interpreter** — reads the schema, instantiates widgets, wires the typed data
   flow, executes. (The generalized `taskAction`.)

**Why it's safe & reviewable:**
- No untrusted execution — author input is inert (schema + weights).
- **Type-safety as a gate:** components declare I/O types; a schema **validator rejects
  incompatible wiring at publish time** (automated CI check in `tasks-library`), so broken
  tasks never reach a device — and marketplace review becomes largely **automatable**.

**Honest constraints:**
- Authors are bounded by the **widget vocabulary we ship**; anything novel needs a **new
  compiled component** (app release). Acceptable — the sensor/transform/ML vocabulary is
  finite and reusable.
- **Platform availability per component** must be declared (e.g. **LiDAR/depth is
  iOS-only / device-limited**; some sensors Android-only). Tasks using an unavailable
  component are hidden/blocked on that device.
- For the ~5% needing real logic (a formula, a conditional), provide a **whitelisted,
  sandboxed expression language** (pure expressions, no I/O) for computed fields — **not**
  full JS. Covers glue logic without reopening Option D's risk.

**Open sub-questions:**
- Linear pipeline first, or typed **DAG** from the start? (DAG needed for real ML.)
- Minimum viable **widget set** for Phase 2 (which sensors/transforms/outputs ship first)?
- Where are **models hosted/delivered/cached**, and size limits?
- Scope of the **expression language** (operators/functions) — start tiny.
- Does the schema/DSL live in the same `tasks-library` repo, versioned alongside the widget
  registry's capability manifest?

### 5.6 Exposing OpenCV usefully within the architecture 🔵

**The challenge:** OpenCV is a huge, **low-level imperative** library operating on `Mat`s;
our architecture is **declarative, typed, and composable**. Dumping 1000+ raw ops as
widgets would overwhelm authors and make the type system meaningless. The answer is
**granularity + a semantic type system + visual authoring**.

**1. Three tiers of CV widgets (granularity):**
| Tier | What it is | Examples | Audience |
|---|---|---|---|
| **Primitives** | Thin typed wrappers over single OpenCV ops | `cvtColor`, `threshold`, `GaussianBlur`, `morphologyEx`, `inRange`, `findContours`, `connectedComponents` | Power users composing from scratch |
| **Recipes** | Curated multi-op blocks from real patterns | `ColorMask` (blur→HSV→inRange), `CleanMask` (open→close), `SegmentLargestBlob`, `MeasureArea` | Most authors |
| **Domain tasks** | End-to-end saved pipelines | "Count objects by color", "Measure leaf area" | Non-CV researchers |

Most of these **already exist, hand-written, inside**
[tasks/petalcounter/lib/CountPetals.js](../tasks/petalcounter/lib/CountPetals.js) — the
practical way to seed the library is to **harvest reusable blocks from working pipelines**.

**2. A semantic image/CV type system (not just "Mat"):** give wiring real meaning and
safety with types like `Image(RGB)`, `Image(Gray)`, `Image(HSV)`, `Mask` (binary),
`Contours`, `Keypoints`, `Region/BBox`, `Overlay`, `Number`. Widgets declare which they
accept/emit, so the publish-time validator can **reject nonsense wiring** (e.g. feeding an
HSV image where a binary mask is expected) and even **auto-suggest/insert conversions**
(RGB→Gray). This is what makes a huge op surface tractable.

**3. Visual, preview-driven authoring:** CV work is empirical — you tune by *looking*. The
authoring UI should show the **intermediate result at every stage** (PetalCounter already
emits base64 previews at each step — that's the exact seam). Tuning HSV ranges/thresholds
against a **live preview** (plus an eyedropper to pick colors) is what makes OpenCV *feel
useful* rather than like blind parameter-guessing.

**4. Design-time vs. runtime-interactive parameters:** a param can be **fixed by the author**
*or* **set by the field collector** — e.g. tap-to-pick a target color, draw an ROI, or
place a **scale reference**. Runtime-interactive CV params are a genuine differentiator
(ODK can't do this).

**5. Calibration / real-world measurement:** research CV usually needs units, not pixels.
Ship a **scale-reference widget** (fiducial marker / known-size object → px-to-mm) that
pairs with contour/area widgets to output real measurements — high research value.

**6. Curated palette, grown by demand:** expose a vetted **~30–50 primitives + ~10–15
recipes**, not all of OpenCV. Keeps the type system, docs, and automated review tractable;
extend when real tasks need it.

**7. Performance & lifecycle:** OpenCV pipelines allocate many `Mat`s; the interpreter must
own **buffer lifecycle** (`OpenCV.clearBuffers()` is already used) and batch work to avoid
bridge overhead — design the runtime to run a pipeline as one native pass where possible.

**8. Shared vocabulary with ONNX inference:** the same typed image/tensor flow feeds the
**inference widget** (5.5) — OpenCV handles pre-processing (resize/normalize) and
**post-processing** (contours/measurement on a model's output `Mask`), so CV recipes and ML
tasks compose seamlessly.

**Open sub-questions:**
- Which **~40 ops** make the first curated palette? (Harvest from PetalCounter + common
  research CV: color segmentation, thresholding, morphology, contour/blob analysis,
  measurement, template matching.)
- How rich is the **preview/tuning** UI in v1 (per-stage thumbnails vs. full interactive tuning)?
- Auto-conversion policy: silently insert `RGB→Gray`, or force authors to be explicit?

---

## 6. Programmatic Data Access (Public REST API)

> **Priority: near-term — likely ship *before* the full v2.** Lower complexity than the
> other sections and independently valuable.

**Goal:** Let **power users access their own data directly** via a REST-style API — scripts,
notebooks, HTTP calls — without going through the web client portal.

**Current state:** We already have a REST API (`https://openfieldworks.org/api`,
[utils/api.js](../utils/api.js)) but it authenticates with a **single static `x-api-key`**
shared by the app — **not** per-user, not scoped, not safe to hand to end users. The gap is
**authentication + access control for external callers**, not the API surface itself.

**What's needed:**
- **Per-user credentials** — issue **personal access tokens** (revocable, user-generated in
  the web client) instead of sharing the app key. (Same underlying need as **4.3**: move
  off the static key to per-user auth.)
- **Scoped authorization** — tokens scoped to the **groups** the user belongs to and their
  **role** (4.1/4.3): read-only vs. read/write, per group.
- **Read-first surface** — prioritize **data export** (records, and optionally designs):
  list/query with **pagination**, filtering by group/survey/date, JSON (and likely CSV).
- **Self-serve docs** — publish an **OpenAPI/Swagger** spec so power users can discover
  endpoints and generate clients.
- **Guardrails** — rate limiting, API **versioning** (`/v1`), least-privilege defaults,
  token revocation + audit.

**Open sub-questions:**
- Token model: **personal access tokens** (simplest for researchers) vs. OAuth2 client
  credentials? (Lean PAT.)
- Read-only first, or read/write (programmatic ingest) from day one?
- Export formats beyond JSON — CSV now, or later?
- Does this reuse the **same auth layer** as the mobile app's future per-user tokens (4.3),
  so there's one identity/authorization system, not two?
- Media handling: do records' media (Firebase Storage URLs) get **signed URLs** for
  programmatic download?

**Leaning:** 🟡 **Revocable per-user personal access tokens**, **group/role-scoped**,
**read-first** with pagination + OpenAPI docs, built on the **same per-user auth layer** as
4.3 (do the auth work once, expose it both to the app and to external scripts).

---

## 7. Single Sign-On (Google & Microsoft)

> **Priority: minor / near-term.** Complements the auth work in **1.3 / 4.3 / 6**.

**Goal:** Add **Google** and **Microsoft** SSO widgets to **both** the web client and the
mobile app, so users can sign in with an existing account instead of creating a new
username/password.

**Current state:** Auth is **Firebase email/password** ([firebase.js](../firebase.js),
[contexts/AuthContext.js](../contexts/AuthContext.js) — `initializeAuth` +
AsyncStorage persistence). Firebase Auth **natively supports** Google
(`GoogleAuthProvider`) and Microsoft (`OAuthProvider('microsoft.com')`), so this is
additive — the existing email/password path can stay.

**What's needed:**
- **Web client:** straightforward — `signInWithPopup` / `signInWithRedirect` with the
  Google / Microsoft providers.
- **Mobile (the gotcha):** the Firebase **JS SDK's `signInWithPopup` does NOT work in React
  Native**. Use a native/Expo OAuth flow to obtain a credential, then
  `signInWithCredential`:
  - Google — `expo-auth-session` (or `@react-native-google-signin`).
  - Microsoft — `expo-auth-session` against Azure AD, then
    `OAuthProvider('microsoft.com').credential(...)`.
- **Provider config:** enable Google + Microsoft in the Firebase console; create a **Google
  OAuth client** and an **Azure AD app registration** with correct **redirect URIs**; add
  iOS reversed-client-id / URL schemes to [app.config.js](../app.config.js).
- **Account linking:** decide Firebase's **one-account-per-email** behavior — link
  Google/Microsoft/password identities that share an email via `linkWithCredential` to
  avoid duplicate accounts.

**Open sub-questions:**
- **Domain restriction** as access control: constrain to org domains (Google Workspace `hd`
  / Azure AD tenant) so SSO doubles as an allowlist mechanism (ties to **1.3**)?
- Which providers ship first — Google, Microsoft, or both together?
- Do SSO users still need explicit **group provisioning** (4.1) after first sign-in, or does
  domain → group mapping auto-enroll them?
- Keep email/password enabled alongside SSO, or SSO-only for new users?

**Leaning:** 🟡 Add both providers via Firebase (web: popup/redirect; mobile: expo-auth-session
+ `signInWithCredential`), keep email/password, and evaluate **domain-restricted SSO** as a
low-friction access-control path for 1.3.

---

## 8. Infrastructure Consolidation & Open-Source Packaging

**Premise:** Gather should be an **open-source, self-hostable** tool — another team should
be able to clone **one or two repos**, run **a single `docker-compose`**, and have a working
instance without wiring up a sprawl of managed accounts. Simultaneously, we want to offer a
**hosted SaaS** on our own infrastructure. The North Star: **depend on standards, not
proprietary SDKs**, so managed and self-hosted deployments are the *same code* with swappable
backends.

### 8.0 Current stack & pain (context)

| Concern | Today | Pain |
|---|---|---|
| Survey data + designs (JSON) | **MongoDB Atlas** | Managed lock-in; Atlas **Device Sync deprecation already bit us** (this whole migration) |
| Media (image/video) | **Firebase Storage** | Data **split** across two vendors |
| API | **Firebase Functions** | Vendor-coupled deploy |
| Web client | **Firebase Hosting** | Vendor-coupled deploy |
| Auth / login | **Firebase Auth** | Managed; **not self-hostable** (tension with open-source premise) |

Two structural problems: **(1) a dual-vendor data split** (Atlas + Firebase Storage), and
**(2) lock-in / deprecation risk** across proprietary services (policy changes, SDK
deprecations, uptime dependence).

### 8.1 The guiding principle — standards over SDKs 🟡

What bit us with Atlas Device Sync was depending on a **proprietary SDK**. The fix is to
depend on **open interfaces** so any backend is swappable:
- **Auth → OIDC/OAuth2** (not a vendor SDK)
- **Object storage → the S3 API** (not Firebase Storage SDK)
- **Data → a portable DB** (Mongo or Postgres) behind our own API, never a device-sync SDK
- **API + web → containers**, deployable anywhere

If every dependency is spoken in a **standard protocol**, managed services (Firebase/Atlas/GCS)
become one *implementation* and self-hosted (MinIO/Authentik/containerized DB) another — same
app code.

### 8.2 Data layer consolidation 🔵

**Clarify two separate things** (the brief conflated them): a **database host** and
**object storage**. *S3 is object storage — you don't run Mongo "on S3."*

- **Structured data (surveys/designs/records):**
  - **A. Self-hosted MongoDB** (container/VM) — closest to today; JSON-native; minimal data
    reshaping.
  - **B. Migrate to PostgreSQL (+ JSONB)** — relational for groups/users/memberships (4.x)
    **plus** JSONB for flexible survey/record payloads. Unlocks a huge open-source ecosystem
    (incl. Directus and Authentik, which both need Postgres). Bigger migration.
- **Media/object storage:** replace Firebase Storage with an **S3-compatible** API →
  **MinIO** for self-host, or **S3/GCS** for managed/SaaS. One storage interface, swappable
  backend. Ends the dual-vendor split.

**Open sub-questions:**
- **Mongo vs. Postgres+JSONB** — keep JSON-native simplicity, or migrate to unlock the SQL
  tooling ecosystem (Directus, Authentik share Postgres)? *(Big lever.)*
- Any migration = **export/copy/reshape** existing Atlas data — plan a one-time migration path.
- Do media references become **S3 keys + signed URLs** (ties to the API in Section 6)?

### 8.3 Auth & API-key consolidation 🔵

**The tension:** Firebase Auth is easy and drives the SSO path (Section 7), but it's **not
self-hostable** — a self-hoster would still need our Firebase project, breaking the
"clone-and-run" premise.

- **Option A — keep Firebase Auth** (near-term): least churn (we *just* migrated to it), good
  SSO, but managed-only; self-hosters depend on it.
- **Option B — self-hostable OIDC IdP (Authentik / Keycloak):** fully open-source,
  self-hostable, **federates Google/Microsoft SSO** (covers Section 7), issues OIDC tokens,
  and can manage **service-to-service credentials** and **personal access tokens** (Section
  6). **Authentik** (the "authentik with a k" tool) is the modern, lighter choice; Keycloak
  the heavier incumbent. Resolves the self-host tension.
- **Provider-agnostic seam:** if the app/API consume **OIDC**, we can run **Firebase Auth for
  our SaaS** and **Authentik for self-hosters** with the same code.

**API keys:** unify the various needs behind the IdP — app↔API service auth, **per-user PATs**
for programmatic access (Section 6), all **revocable + scoped** (groups/roles, 4.3). Retire
the single static `x-api-key` ([utils/api.js](../utils/api.js)).

**Leaning:** 🟡 Abstract auth behind **OIDC**; keep **Firebase Auth** for our hosted SaaS
short-term; offer **Authentik** as the self-hostable IdP — same OIDC contract either way.

### 8.4 Admin / data-management tooling 🔵

**Directus** (raised in the brief) is a strong open-source **data platform / admin UI** — but
**it only supports SQL databases (Postgres, MySQL, …), *not* MongoDB.** So:
- If we **stay on Mongo (8.2.A):** admin via **Mongo Express / Compass** (lighter, Mongo-native).
- If we **move to Postgres (8.2.B):** **Directus** gives a polished admin UI, REST/GraphQL,
  RBAC, and could even accelerate parts of the **web client** and **public API** (Section 6).

This makes Directus a **real argument in favor of Postgres** — worth weighing in the 8.2 decision.

### 8.5 Packaging & deployment 🔵

**Target:** clone → `docker-compose up` → working instance. A single compose file
orchestrating:
- **API** (container; replaces Firebase Functions)
- **Web client** (container; replaces Firebase Hosting)
- **Database** (MongoDB or Postgres)
- **Object storage** (MinIO, S3-compatible)
- **IdP** (Authentik, optional/self-host) and/or **Directus** (if Postgres)

**Open sub-questions:**
- **One or two repos?** (e.g. a mono-repo, or `api` + `web` + a top-level `deploy` compose repo.)
- Config via **`.env` + documented variables** (echoes our current EAS env-var approach).
- Managed-service **adapters** (Firebase/Atlas/GCS) selectable via env, so the same compose
  can run fully self-hosted **or** point at managed backends.
- Deploy targets: a VM/container host (not "S3" — that's storage). Provide sane defaults +
  docs.

### 8.6 Managed vs. self-hosted, and the SaaS path 🔵

- **Self-host (open-source):** full control, no vendor lock-in, no per-seat cost — but the
  operator owns **uptime, backups, scaling, security**.
- **Managed (our SaaS):** we run it for clients with their own accounts on our
  infrastructure; better uptime/reliability, we absorb ops — but hosting cost + responsibility.
- **Same codebase, swappable backends** (8.1) lets us serve **both**: SaaS on managed
  services where reliability matters, self-host on the open-source bundle.

**Open sub-questions:**
- SaaS multi-tenancy: reuse the **groups** model (4.1) as tenant isolation, or separate
  deployments per client?
- Which managed services stay for SaaS (Firebase Auth? Atlas? GCS?) given uptime/reliability
  vs. lock-in tradeoffs?
- Migration path off Atlas as the first concrete consolidation step (highest lock-in risk).

**Leaning:** 🟡 Standards-based seams (OIDC / S3 / containers); **MinIO** to end the media
split; **Authentik** as the self-hostable IdP with Firebase retained for SaaS; **seriously
evaluate Postgres+JSONB** (unlocks Directus + Authentik ecosystem); ship a **single
`docker-compose`** with env-selectable managed vs. self-hosted backends.

---

## Cross-Cutting Themes

Threads that recur across sections — resolve these once and many sections fall into place:

- **One auth/identity layer (1.3 · 4.3 · 6 · 7 · 8.3):** per-user, group/role-scoped, OIDC-
  based, revocable tokens — powering mobile login, SSO, the public API, and service auth.
  **Retire the static `x-api-key`.** Build once; expose everywhere.
- **Standards over proprietary SDKs (8.1):** the Atlas Device Sync deprecation is the
  cautionary tale — depend on OIDC, S3 API, containers, portable DBs.
- **Power vs. simplicity (2 · 3 · 5):** keep the *mobile collector* experience dead-simple;
  push complexity into web authoring, the data model, and the task pipeline.
- **Terminology (3.5 · 4.1):** settle the vocabulary — tenant (Group/Workspace), template
  (vs. "survey"), record, item — across web + mobile at once.
- **Group scoping (3 · 4 · 6 · 8.6):** `groupId` as the consistent ownership/tenancy boundary,
  reused for SaaS multi-tenancy.
- **ODK Entities as the backend data model (0.1 · 0.2 · 3 · 4 · 6):** a *new* ODK capability
  (post-dates this project's start) that already, elegantly, solves much of Sections 3–6 —
  flat Entity Lists with properties, 1→many for longitudinal, CSV/API import, access filters.
  If Option C holds, prefer **"model it as Entities"** over building it; revisit Section 3
  through this lens.

---

## Decision Log

| Date | Topic | Decision | Notes |
|---|---|---|---|
| _pending_ | 0. Build vs. adopt (ODK) | — | Gating meta-question; leaning C = own frontend (iOS + native ML) + ODK Central backend over OpenRosa/Entities; validate w/ C0 spike |
| _pending_ | 0.2 Nested layout → ODK | — | Field site→block→col/row→plant maps to one flat `plants` Entity List (coords as properties); traversal UI is ours; ceiling not binding |
| _pending_ | 0.3 Authoring + rendering | — | Reuse `@getodk/xforms-engine` (Apache-2.0) for form logic + generic widgets; build only RN widget UI + ML custom widgets (field+`appearance`); designs live in Central (no designs DB/API of ours); spike RN/Hermes embedding |
| _pending_ | Terminology (adopt ODK) | — | Favor ODK vocabulary: survey→Form, task→question type/widget, result→Submission, item→Entity, collection→Entity List; supersedes 3.5 Protocol/Record leaning pending revisit |
| _pending_ | 0.5 Widget authoring model | — | One widget envelope (typed inputs → compute core → ODK primitive) w/ a curated set of pluggable **drivers**: A OpenCV DAG · B ONNX template · C interactive/SAM-family; new archetype = platform code, new model-in-archetype = author data (the MediaPipe/TFLite/HF Task-Library pattern); adopt runtimes (ONNX-first, `fast-tflite` later) + CV ops + VisionCamera, port pre/post from transformers.js/MediaPipe, build only envelope/authoring/coercion; packaged as a standalone RN library |
| _pending_ | 1.1 Build tooling | — | Leaning hybrid (C) |
| _pending_ | 1.2 Store distribution | — | TestFlight + Play tracks to retire Ad Hoc |
| _pending_ | 1.3 Access control | — | Leaning public + auth allowlist (A) |
| _pending_ | 3.2 Nesting | — | Leaning recursive tree + readable path |
| 2026-08-24 | 3.2 Recording target | **Records attach to leaf items only** | Mid-node recording → model as its own survey |
| _pending_ | 3.3 Spreadsheets | — | Leaning import/export only, not the model |
| 2026-08-24 | 3.4 Longitudinal | **Predefined items already cover longitudinal revisits** | No separate cross-form entity needed for predefined case |
| _pending_ | 3.4 Field-time items | — | Predefined primary; ad-hoc/discovery deferred |
| _pending_ | 3.4 Discovery mode | — | Deferred: persistent per-survey item identity (collection+name+ID) |
| _pending_ | 3.5 Terminology | — | Leaning Protocol / Record / Item; team vote |
| _pending_ | 4.1 Groups model | — | Multi-group membership; records scoped to group |
| _pending_ | 4.3 RBAC | — | Fixed roles (Owner/Designer/Collector/Viewer), server-side enforced |
| _pending_ | 4.3 API auth | — | Move off static x-api-key → per-user token for group/role scoping |
| _pending_ | 4.2 Group switcher | — | Slack-style switcher on mobile; persist last active group |
| _pending_ | 5.1 Tasks Core/Library | — | Split tasks-core + tasks-library marketplace |
| _pending_ | 5.2 Task delivery | — | Leaning curated+flags (A) → model-driven ML (C); defer sandboxed JS (D) |
| _pending_ | 5.5 Task architecture | — | Declarative widget composition + model as data; typed I/O validated at publish |
| _pending_ | 5.6 OpenCV exposure | — | 3 tiers (primitive/recipe/domain) + semantic image types + preview authoring; harvest from PetalCounter |
| _pending_ | 6. Public API auth | — | Per-user PATs, group/role-scoped, read-first; shares 4.3 auth layer (pre-v2) |
| _pending_ | 7. SSO | — | Google + Microsoft via Firebase; mobile needs expo-auth-session + signInWithCredential |
| _pending_ | 8.1 Infra principle | — | Standards over SDKs: OIDC / S3 API / containers / portable DB |
| _pending_ | 8.2 Data + storage | — | Self-host Mongo vs Postgres+JSONB; MinIO/S3 for media (end dual-vendor split) |
| _pending_ | 8.3 Auth backend | — | OIDC seam; Firebase for SaaS, Authentik self-host |
| _pending_ | 8.4 Admin tooling | — | Directus (SQL-only) → argues for Postgres; else Mongo Express/Compass |
| _pending_ | 8.5 Packaging | — | Single docker-compose; env-selectable managed vs self-hosted backends |
| _pending_ | 5.0 ONNX runtime | — | Not yet in project; must add (e.g. onnxruntime-react-native) for ML tasks |
