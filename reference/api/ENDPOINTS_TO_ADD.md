# Endpoints to add — Survey Results (write) + Survey Designs (read/write)

Status: **NOT YET IMPLEMENTED.** The mobile app (`refactor/api`) was migrated off
MongoDB Atlas Device Sync and now talks to this API over HTTP. It already calls the
routes below via `utils/api.js`. They must be added here to complete the migration.

## Context / current state

The API today only exposes a **read-only** proxy:

- `POST /api/mongodb/:action` — allowlist `find | findOne | aggregate`
  (`src/controllers/mongodb.js`), always hitting the single collection returned by
  `getCollection()` (i.e. `process.env.COLLECTION_NAME` = `SurveyResults`).

There is **no write path** and **no way to read the `SurveyDesign` collection**. Both are
required by the mobile app. Keep the existing proxy read-only — add dedicated resource
routes for writes and for designs instead of loosening the allowlist.

### Building blocks that already exist (reuse them)

- `src/config/database.js` → `getCollection(collectionName = process.env.COLLECTION_NAME)`
  **already accepts a collection name**, so `getCollection('SurveyDesign')` and
  `getCollection('SurveyResults')` work with no DB changes.
- `src/middleware/security.js` → `createApiKeyGuard()` protects everything except
  `/health`. The new routes are mounted after it in `src/index.js`, so they inherit the
  `x-api-key` guard and the rate limiter automatically. No extra auth wiring needed.
- `src/services/mongodb.js` → `convertStringIdsToObjectIds()` converts `_id` and any
  `*Id` string field into an `ObjectId`. Reuse it so client-generated hex `_id`s are
  stored as real ObjectIds (matching the shape the web portal already reads).

## Auth

Same as every other route: static API key in the `x-api-key` header (env `API_KEYS`,
header overridable via `API_KEY_HEADER`). The mobile client sends
`x-api-key: <EXPO_PUBLIC_GATHER_HUB_API_KEY>`. No Firebase token verification is required
for these routes (parity with the existing proxy).

## Collections

Single database (`DATABASE_NAME`). Two collections:

- `SurveyResults` — completed survey submissions (write-only from the app).
- `SurveyDesign` — survey templates (read + write from the app).

Both must keep the **same document shape** the web portal already reads. IDs are
**client-generated** on device (BSON ObjectId, sent as a 24-char hex string).

---

## 1. Survey Results

### `POST /api/surveys/results`

Insert one completed survey result. Body is the processed survey document produced by the
app (media already uploaded to Firebase Storage; observation media fields hold download
URLs).

**Request body**

```json
{
  "_id": "665f1c2e9a1b2c3d4e5f6a7b",
  "name": "Sunflower Field 12",
  "dateStarted": "2026-08-24T14:03:11.000Z",
  "dateCompleted": "2026-08-24T14:41:52.000Z",
  "user": "collector@example.org",
  "tasks": [ /* mixed[] */ ],
  "collections": [ /* mixed[] */ ],
  "observations": [ /* mixed[] */ ]
}
```

**Response** `201 Created`

```json
{ "insertedId": "665f1c2e9a1b2c3d4e5f6a7b" }
```

**Implementation notes**

- Insert into `getCollection('SurveyResults')`.
- Run the body through `convertStringIdsToObjectIds()` so `_id` becomes an `ObjectId`.
- Coerce `dateStarted` / `dateCompleted` from ISO strings to `Date` before insert so the
  stored shape matches the old Atlas documents (the web portal expects `Date`, not string).
- Return the inserted id as a hex string.
- Duplicate `_id` (retry of an already-uploaded survey) → treat as success/idempotent
  (return `201`/`200` with the existing id) rather than `500`, so a client retry after a
  flaky network doesn't hard-fail.

---

## 2. Survey Designs

### `GET /api/surveys/designs`

List all survey designs.

**Response** `200 OK`

```json
{
  "documents": [
    {
      "_id": "665f0a1122334455667788aa",
      "name": "Sunflower Template",
      "tasks": [ /* mixed[] */ ],
      "collections": [ /* mixed[] */ ]
    }
  ]
}
```

**Implementation notes**

- `getCollection('SurveyDesign').find({}).toArray()` → `{ documents }`.
- Native driver serializes `ObjectId` `_id` to a hex string in JSON — the app converts it
  back to a BSON ObjectId locally, so no special handling needed.

### `GET /api/surveys/designs/:id` (optional)

Fetch a single design. `{ document }` or `404`. Convert `:id` with
`convertStringIdsToObjectIds({ _id: id })`. Not currently called by the app; include for
parity/debugging.

### `PUT /api/surveys/designs/:id`

**Upsert** a design by client-generated `_id`. This is what the app calls for both create
and edit (the client always knows the id).

**Request body**

```json
{
  "_id": "665f0a1122334455667788aa",
  "name": "Sunflower Template",
  "tasks": [ /* mixed[] */ ],
  "collections": [ /* mixed[] */ ]
}
```

**Response** `200 OK`

```json
{ "matchedCount": 1, "modifiedCount": 1, "upsertedId": null }
```

**Implementation notes**

- `const _id = convertStringIdsToObjectIds({ _id: req.params.id })._id;`
- `getCollection('SurveyDesign').replaceOne({ _id }, { ...body, _id }, { upsert: true })`.
- Strip/override any body `_id` so the URL id is authoritative.

### `POST /api/surveys/designs` (optional)

Create a design, server-agnostic to client ids. Returns `{ insertedId }`. The app uses
`PUT` (upsert-by-id) instead, so this is optional.

---

## Suggested wiring

Add a controller + service and mount the routes after the guard in `src/index.js`:

```js
// src/controllers/surveys.js  (new)
//   postResult, listDesigns, getDesign, upsertDesign
// src/services/surveys.js      (new, or extend services/mongodb.js)
//   using getCollection('SurveyResults' | 'SurveyDesign') + convertStringIdsToObjectIds

// src/index.js  (after app.use(createApiKeyGuard()))
app.post('/api/surveys/results',       surveys.postResult);
app.get('/api/surveys/designs',        surveys.listDesigns);
app.get('/api/surveys/designs/:id',    surveys.getDesign);      // optional
app.put('/api/surveys/designs/:id',    surveys.upsertDesign);
```

Keep `POST /api/mongodb/:action` read-only. Do **not** add write actions to its allowlist.

## Client contract (already implemented in the mobile app)

`utils/api.js` (base `EXPO_PUBLIC_API_BASE_URL` ending in `/api`, header `x-api-key`):

- `getDesigns()`      → `GET  /surveys/designs`            → returns `documents[]`
- `upsertDesign(doc)` → `PUT  /surveys/designs/{doc._id}`  → body = design doc
- `postResult(doc)`   → `POST /surveys/results`            → body = result doc
