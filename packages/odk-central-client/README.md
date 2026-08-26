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
- form attachment listing / download;
- OpenRosa submission upload (`POST /v1/projects/:id/submission`);
- structured, retry-aware HTTP errors.

Deliberately **out of scope** (add only when a real workflow needs it): OData, Entities/Datasets, submission edit/update flows, and per-endpoint convenience wrappers.

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
```

## Design boundaries

Per the package architecture, `odk-central-client` **must not** own: XForms evaluation, form rendering, React state, WebView behavior, local database design, offline queue persistence, conflict-resolution policy, a new sync protocol, media processing, or an independent asset backend. It depends on **no** XForms package; the mobile app is the composition root.

### Media boundary

Attachments are passed as **opaque references** — inline `data`, or a native file `uri` (`{ uri, name, type }`). The client never reads or transforms attachment bytes, and no media crosses the XForms WebView bridge. `downloadFormAttachment` returns the raw `Response` so the host app decides how to persist bytes.

### Runtime neutrality / testability

The only networking dependency is an injectable `fetch` (defaults to the global `fetch`, present in React Native and Node 18+). This keeps the client runtime-neutral and lets the whole surface be unit-tested with a mock transport — no live server required. `FormData` is likewise injectable.

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
