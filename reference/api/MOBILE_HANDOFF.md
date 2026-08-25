# Mobile App Handoff — Survey Results + Designs API

Status: **LIVE** on `https://openfieldworks.org`. These endpoints replace the deprecated
MongoDB Atlas Device Sync path. Verified end-to-end (12/12 smoke checks, date types
confirmed as BSON `Date`).

Use this document to confirm the mobile client (`utils/api.js`) is wired to the contracts
below.

## Base URL & auth

- **Base URL:** `https://openfieldworks.org/api`
  (`EXPO_PUBLIC_API_BASE_URL` must end in `/api`; the app appends `/surveys/...`.)
- **Auth header:** `x-api-key: <EXPO_PUBLIC_GATHER_HUB_API_KEY>` on every request.
  - This is the Gather Hub API key (an entry in the server's `API_KEYS`), **not** the
    MongoDB key.
  - Missing/invalid key → `401 { "error": "Unauthorized" }`.
- **Content type:** send `Content-Type: application/json` on all writes.

## ID & timestamp conventions

- **IDs are client-generated** on device as 24-char hex BSON `ObjectId` strings. Send them
  as plain strings; the server converts `_id` (and any `*Id` field) to a real `ObjectId`.
- **Timestamps:** send ISO 8601 strings. The server coerces `dateStarted`, `dateCompleted`,
  and each `observations[].timestamp` to BSON `Date` on write, matching the shape the web
  portal reads. Unparseable values are stored unchanged (never dropped).

## Endpoints

### `POST /api/surveys/results` — insert a completed survey result

- **Client call:** `postResult(doc)`
- **Body:** the processed survey document (media already uploaded to Firebase Storage;
  observation media fields hold download URLs).

```json
{
  "_id": "665f1c2e9a1b2c3d4e5f6a7b",
  "name": "Sunflower Field 12",
  "dateStarted": "2026-08-24T14:03:11.000Z",
  "dateCompleted": "2026-08-24T14:41:52.000Z",
  "user": "collector@example.org",
  "tasks": [],
  "collections": [],
  "observations": [{ "timestamp": "2026-08-24T14:10:00.000Z" }]
}
```

- **Response:**
  - `201 { "insertedId": "<hex>" }` on first insert.
  - `200 { "insertedId": "<hex>" }` on a retry of an already-uploaded `_id` (idempotent).
- **Client contract:** treat **any 2xx (`res.ok`) as success**. A network retry after a
  flaky upload is safe — the server will not double-insert and will not error on the
  duplicate.

### `GET /api/surveys/designs` — list all survey designs

- **Client call:** `getDesigns()`
- **Response:** `200 { "documents": [ { "_id": "<hex>", "name": "...", "tasks": [], "collections": [] } ] }`
- `_id` comes back as a hex string; convert to a BSON `ObjectId` locally as needed.

### `GET /api/surveys/designs/:id` — fetch one design

- **Response:** `200 { "document": { ... } }` or `404 { "error": "Design not found" }`.
- Optional / not required by the app; available for debugging.

### `PUT /api/surveys/designs/:id` — upsert a design (create or edit)

- **Client call:** `upsertDesign(doc)` → `PUT /surveys/designs/{doc._id}`
- The **URL id is authoritative**; any `_id` in the body is ignored/overridden.
- **Body:**

```json
{
  "_id": "665f0a1122334455667788aa",
  "name": "Sunflower Template",
  "tasks": [],
  "collections": []
}
```

- **Response:** `200 { "matchedCount": <n>, "modifiedCount": <n>, "upsertedId": <hex|null> }`
  - New design → `matchedCount: 0`, `upsertedId` set.
  - Existing design → `matchedCount: 1`, `modifiedCount: 1`, `upsertedId: null`.

### `POST /api/surveys/designs` — create a design (optional)

- **Response:** `201 { "insertedId": "<hex>" }`
- The app uses `PUT` (upsert-by-id) for both create and edit; this route is optional.

## Client contract summary (must match `utils/api.js`)

| Client method       | Method + path (relative to base `/api`) | Body            | Success |
|---------------------|-----------------------------------------|-----------------|---------|
| `getDesigns()`      | `GET  /surveys/designs`                 | —               | `{ documents }` |
| `upsertDesign(doc)` | `PUT  /surveys/designs/{doc._id}`       | design doc      | `{ matchedCount, modifiedCount, upsertedId }` |
| `postResult(doc)`   | `POST /surveys/results`                 | result doc      | `{ insertedId }` (201 new / 200 retry) |

## Checklist for the mobile team

- [ ] `EXPO_PUBLIC_API_BASE_URL` = `https://openfieldworks.org/api` (ends in `/api`, no
      trailing slash).
- [ ] `EXPO_PUBLIC_GATHER_HUB_API_KEY` set and sent as `x-api-key` on every request.
- [ ] Success is checked via `res.ok` (2xx), not a hard-coded `201`.
- [ ] Result/design `_id`s are generated as 24-char hex ObjectId strings.
- [ ] Timestamps sent as ISO 8601 strings.
- [ ] Media uploaded to Firebase Storage before `postResult`; observation media fields hold
      the resulting download URLs.

## Notes

- The legacy `POST /api/mongodb/:action` proxy remains **read-only** (`find | findOne |
  aggregate`) and is unchanged. There is no client-facing delete endpoint.
- No Firebase token verification is required for these routes (parity with the existing
  proxy) — the static `x-api-key` is the only auth.
