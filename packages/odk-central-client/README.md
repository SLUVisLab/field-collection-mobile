# odk-central-client

Smallest useful JavaScript client for a **mobile ODK Central data-collection workflow**, built directly on ODK's documented **REST** and **OpenRosa** protocols.

It is intentionally **not** a JavaScript clone of [pyODK](https://github.com/getodk/pyodk): it covers exactly the M4 vertical slice and grows only in response to real product workflows.

```text
Central ──▶ download XForm ──▶ XFormsHost ──▶ React/native UI ──▶ serialize ──▶ submit ──▶ Central
```

## Scope

Covered now (the vertical slice):

- server configuration / base URL handling;
- authentication: App User token, web-user session, basic, bearer;
- OpenRosa form listing (`GET /v1/projects/:id/formList`);
- XForm XML download (`GET /v1/projects/:id/forms/:xmlFormId.xml`);
- OpenRosa form manifest / resource discovery (`GET /v1/projects/:id/forms/:xmlFormId/manifest`);
- form attachment listing / download;
- OpenRosa submission upload (`POST /v1/projects/:id/submission`);
- structured, retry-aware HTTP errors.

Deliberately **out of scope** (add only when a real workflow needs it): OData, broad App User/Public Link administration, submission edit/update flows, and per-endpoint convenience wrappers.

## Example

```js
import { OdkCentralClient, createAppUserAuth } from 'odk-central-client';

const central = new OdkCentralClient({
  baseUrl: 'https://central.example.org',
  projectId: 1,
  auth: createAppUserAuth(appUserToken), // App User is the recommended survey-client auth
});

const forms = await central.listForms();
const xml = await central.downloadForm({ formId: 'my-form' });

// ... render + edit through odk-xforms-react, then serialize the instance ...

await central.submit({
  xml: submissionXml,
  attachments: [{ name: 'photo.jpg', contentType: 'image/jpeg', uri: fileUri }],
});
// -> { status: 201, message: 'full submission upload was successful!', instanceId: 'uuid:...' }
```

Submission notes (live-validated against stock Central):
- success is `201` with an `OpenRosaResponse` message; the result echoes the `instanceId`;
- resubmitting the **same** `instanceId` with **different** XML fails `409` → `OdkCentralError` with code `DUPLICATE_INSTANCE` (non-retryable);
- a resubmit with an **identical** `xml_submission_file` is idempotent (`201`) — that is how extra media parts are attached across requests;
- inline binary attachment bytes (`Buffer`/`Uint8Array`/`ArrayBuffer`) are wrapped in a `Blob`; native file references (`{ uri, name, type }`) are passed through untouched.

## Two attachment surfaces (not interchangeable)

Central exposes a form's media/data resources through **two different protocol surfaces**, and this client keeps them intentionally distinct:

| Method | Protocol | Route | Auth | Use |
| --- | --- | --- | --- | --- |
| `getFormManifest({ formId })` | **OpenRosa** | `GET /forms/:xmlFormId/manifest` | **App User** (field client) | Primary Gather Mobile resource discovery |
| `listFormAttachments({ formId })` | **Central REST** | `GET /forms/:xmlFormId/attachments` | **Web User** (admin) | Form-management / administrative workflows |

An App User calling the REST `listFormAttachments` will get **`403`** — that is expected, not a bug. For the field-client flow, use the manifest:

```js
const [form] = await central.listForms();          // OpenRosa formList
if (form.manifestUrl) {                              // advertised only when resources are expected
  const resources = await central.getFormManifest({ formId: form.formId });
  // resources: [{ filename, hash, downloadUrl }]
  for (const r of resources) {
    const res = await central.downloadFormAttachment({ formId: form.formId, filename: r.filename });
    // stream res bytes to disk; verify against r.hash (md5:...)
  }
}
```

`getFormManifest` returns `[]` for a form with no resources (Central answers the manifest endpoint with an empty `<manifest>` even when `formList` omits `manifestUrl`). These APIs remain **provisional** pending further live validation; no unified "attachments" abstraction is introduced yet.

## Entity Lists / Datasets (read surface)

> **Terminology:** an *Entity List* (Central UI term) is called a **Dataset** in the
> Central developer API. This client uses the API term `Dataset` in method names.

ODK **Entities** are the persistent subjects of longitudinal workflows (e.g. a plant
tracked across many observation submissions). This client exposes a small **read** surface
over Central's REST/admin Dataset endpoints (Web User; App Users get `403`):

| Method | Route | Returns |
| --- | --- | --- |
| `listDatasets()` | `GET /projects/:id/datasets` | Dataset summaries |
| `getDataset({ name })` | `GET /projects/:id/datasets/:name` | property schema + linked/source forms |
| `updateDataset({ name, accessFilter?, ownerOnly?, approvalRequired? })` | `PATCH /projects/:id/datasets/:name` | updated Dataset metadata |
| `listEntities({ name })` | `GET /projects/:id/datasets/:name/entities` | Entity **metadata** (no `data`) |
| `getEntity({ name, uuid })` | `GET /projects/:id/datasets/:name/entities/:uuid` | one Entity incl. `currentVersion.data` |
| `updateEntity({ name, uuid, data?, label?, baseVersion })` | `PATCH /projects/:id/datasets/:name/entities/:uuid?baseVersion=N` | updated Entity detail |
| `downloadDatasetEntitiesCsv({ name })` | `GET /projects/:id/datasets/:name/entities.csv` | raw `Response` (REST/admin CSV) |

Two important, protocol-faithful distinctions this surface preserves:

- **`listEntities` is metadata, not bulk data.** Central's list entries carry `uuid` and
  `currentVersion` (label/version/conflict fields) but **not** each Entity's property
  `data`. Read one Entity's `data` with `getEntity`; for bulk tabular data use the CSV —
  never fan out one `getEntity` per row.
- **Two different CSVs.** `downloadDatasetEntitiesCsv` returns the REST/admin,
  OData-flavored export (`__id,label,…,__createdAt,__version`). This is **not** the
  field-client Entity-List CSV (`name,label,__version,…`) that the stock XForms engine
  consumes — that one is delivered as a **form attachment** (`<mediaFile type="entityList">`
  in the OpenRosa manifest) and fetched with `downloadFormAttachment`. Different shapes,
  different auth, not interchangeable.
- **Access filtering is dataset metadata.** Use `updateDataset({ accessFilter: ... })`
  to apply/remove Entity delivery restrictions for restricted actors (App Users/Public
  Links) on linked-form CSV delivery. When `accessFilter` is present, Central ignores
  legacy `ownerOnly`.
- **Concurrency is explicit.** `updateEntity` requires an explicit `baseVersion` unless
  `force: true` is explicitly provided by the caller (never implicit). Stale baseVersion
  rejections are surfaced as `ODK_CENTRAL_STALE_ENTITY_BASE_VERSION` (non-retryable).
- **Version/conflict fields are server-owned lineage metadata.** In ordinary online
  updates, `currentVersion.version` increments and `currentVersion.baseVersion` points to
  the prior version. Branch fields (`branchId`, `trunkVersion`, `branchBaseVersion`) and
  `conflictingProperties` may be `null`, but top-level `conflict` can remain `soft`/`hard`
  when the Entity has unresolved historical branch lineage. Callers should not normalize
  these fields away or infer offline-branch semantics from one field in isolation.
- **Existing-Entity offline gate (characterized).** If the form XML + linked Entity List
  CSV are already cached locally, the stock `@getodk/xforms-engine` can still load the
  form, select an existing Entity, and serialize an observation update with no network
  access in-process. This package does **not** implement an Offline Store or upload queue;
  that remains composition-root responsibility.
- **Locally-created Entity offline propagation is not automatic.** Creating an Entity
  offline in one form (registration serialization) does not make it appear in another
  offline form's choice list until a host-managed sync/overlay updates the local
  Entity-List view. The engine consumes whatever cached resource map it is given; it does
  not own cross-form Entity materialization, local list mutation, or deferred sync
  ordering policy.

Property values are returned exactly as Central sends them — **strings** — with no type
coercion and no invented Gather Entity model. **Form-driven Entity mutation stays ordinary
XForms/OpenRosa submission semantics; this client does not independently mutate Entities
when submitting a form** (`submit()` posts the serialized instance; Central applies the
Entity create/update). These Entity methods are **provisional** pending M4.6/M4.7 validation.

## Actor Properties (minimal setup surface)

M4.7 delivery filtering relies on Central Actor Properties. The client exposes a minimal
project-level surface for registering/listing actor-property names:

| Method | Route | Returns |
| --- | --- | --- |
| `listActorProperties({ extendedMetadata? })` | `GET /projects/:id/actor-properties` | registered names (and distinct values when extended metadata is requested) |
| `registerActorProperty({ name })` | `POST /projects/:id/actor-properties` | raw Central success payload |

Actor assignment on App Users remains intentionally outside the public SDK surface for now;
live tests and experiments use private/raw REST helpers for dedicated fixture identities.

### Field-client Entity List delivery (manifest)

The stock engine consumes an Entity List as a **form resource**, discovered via the
OpenRosa manifest (App User). `getFormManifest` marks each entry so callers can tell a
linked Entity List from ordinary media without special-casing transport:

```js
const entries = await central.getFormManifest({ formId: 'silphium_flower_survey_entities' });
// entries: [{ filename, hash, downloadUrl, type, integrityUrl, isEntityList }, ...]
const entityList = entries.filter((e) => e.isEntityList);   // type === 'entityList'
const media      = entries.filter((e) => !e.isEntityList);  // static media (type === null)
// Both download the same way — no Entity-specific transport:
const csv = await central.downloadFormAttachment({ formId, filename: entityList[0].filename });
```

Verified live (Central v2026.2): the linked Entity List appears as
`<mediaFile type="entityList">` with an `<integrityUrl>` (→ the Dataset's integrity
endpoint), while static media is a plain `<mediaFile>`. The field-client CSV columns are
`name(=Entity UUID), label, __version, …properties`. **Hash caveat:** an `entityList`
entry's `hash` is a *dataset content signature* (echoed as the download `ETag`), **not**
md5 of the CSV bytes — treat it as a change token and use `integrityUrl` for Entity-level
integrity. Static-media `hash` is md5 of the bytes as usual.


## Design boundaries

Per the package architecture, `odk-central-client` **must not** own: XForms evaluation, form rendering, React state, WebView behavior, local database design, offline queue persistence, conflict-resolution policy, a new sync protocol, media processing, or an independent asset backend. It depends on **no** XForms package; the mobile app is the composition root.

### Media boundary

Attachments are passed as **opaque bodies** the client never reads or transforms: a Blob-like `data` (a `Blob`/`File`, or a platform file object like an `expo-file-system` `File`), or a `uri` reference. No media crosses the XForms WebView bridge, and `downloadFormAttachment` returns the raw `Response` so the host app decides how to persist bytes. See **React Native / Expo media submission** below for the platform-specific body rules.

### Runtime neutrality / testability

The only networking dependency is an injectable `fetch` (defaults to the global `fetch`, present in React Native and Node 18+). This keeps the client runtime-neutral and lets the whole surface be unit-tested with a mock transport — no live server required. `FormData` is likewise injectable.

### React Native / Expo media submission

The client builds the submission as standard OpenRosa multipart: one `xml_submission_file` part (filename `submission.xml`) plus one part per attachment, each appended as `append(fieldName, body, filename)`. This shape is validated on **Node** and on **React Native (Expo SDK 57, New Architecture, `expo/fetch`)** against a live stock Central, with byte-for-byte attachment round-trips.

The app owns turning a native media URI into an uploadable body; the client owns the multipart semantics. Rules for submitting media from a mobile app:

- **Provide attachment `data` as a Blob-like body.** Both are byte-verified on device:
  - `data: await (await fetch(fileUri)).blob()` — standards `Blob`;
  - `data: new File(fileUri)` from `expo-file-system` — **preferred for large media** (photos/videos), since it stays file-backed instead of materializing the whole file into an in-memory JS `Blob`.
- **Do not** pass raw bytes (`ArrayBuffer`/`Uint8Array`) as `data` on React Native — `expo/fetch` cannot build a `Blob` from a byte container. (Inline bytes are fine on Node/browser and are wrapped automatically.)
- **Do not** set a `Content-Type` header — `FormData`/`fetch` must generate the multipart boundary.
- Known Expo SDK 57 seams observed during validation (documented so callers don't rediscover them): a `{ uri, name, type }` FormData part throws `Unsupported FormDataPart implementation`, and a JS `new File()` can throw `Cannot assign to property 'name'`. The client avoids both by appending the caller's Blob-like body directly.

## Authentication

| Strategy | Factory | How it authenticates |
| --- | --- | --- |
| App User | `createAppUserAuth(token)` | Actuates Central's `/v1/key/<token>/…` route prefix (recommended for survey clients). |
| Session | `createSessionAuth({ email, password })` | `POST /v1/sessions` → bearer token (performed lazily by `ensureAuth()`). |
| Basic | `createBasicAuth({ email, password })` | HTTP Basic header. |
| Bearer | `createBearerAuth(token)` | Pre-obtained bearer token. |

## Status

**Scaffold.** Request-building and response-parsing are implemented and unit-tested against a mock transport. Validation against a **live stock ODK Central** instance is the next step (see `TODO`s referencing live-server hardening). Fill-out will focus on real response schemas, pagination/verbose form details, and manifest-driven attachment download.

## Development

```bash
cd packages/odk-central-client
npm test   # or: node --test "test/**/*.test.mjs"
```

## Primary references

- [ODK Central API overview](https://docs.getodk.org/central-api/)
- [Central authentication](https://docs.getodk.org/central-api-authentication/)
- [Central OpenRosa endpoints](https://docs.getodk.org/central-api-openrosa-endpoints/)
- [Central form management](https://docs.getodk.org/central-api-form-management/)
- [Central submission management](https://docs.getodk.org/central-api-submission-management/)
- [Central Backend OpenAPI (`docs/api.yaml`)](https://github.com/getodk/central-backend/blob/master/docs/api.yaml)
- [pyODK](https://github.com/getodk/pyodk)
