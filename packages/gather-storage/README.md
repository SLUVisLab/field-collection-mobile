# gather-storage

Minimal **durable local-storage primitives** for Gather. This is the storage
foundation for M5 and the later offline runtime (M6): it establishes *where* and
*how* Gather persists data, so subsequent milestones extend it rather than
replacing temporary persistence.

It is a **policy and invariants layer**, deliberately *not* a generic wrapper
over the Expo APIs. It owns Gather's storage topology while leaving SQLite,
FileSystem and SecureStore as themselves.

## Storage roles (invariants)

```
secrets                         → SecureStore only
large / file-shaped data        → FileSystem  (durable vs cache)
structured / queryable metadata → SQLite
SQLite stores relative file KEYS, never duplicate binary payloads
```

SQLite application data is **not** encrypted. Using SecureStore for credentials
does not encrypt the database; no SQLCipher is used in this foundation.

## Architecture

The package is split so that all **pure policy** is unit-testable in Node, and
every **native** binding is isolated (no `expo-*` module can be imported in Node
— `expo-file-system` even resolves to a `.ts` source). Pure modules never import
a native module; the native layer wires/injects them.

| Module | Kind | Responsibility |
| --- | --- | --- |
| `src/paths.js` | pure | Gather-relative key policy: project-scoped layout, key building, normalization, path-traversal/`projectKey` validation. |
| `src/credentials.js` | pure | SecureStore key namespace + project credential lifecycle over an **injected** store adapter. |
| `src/migrations/index.js` | pure | Ordered migration definitions (data). |
| `src/migrations/runner.js` | pure | Version detection, pending computation, transactional/idempotent apply over an **injected** db contract. |
| `src/repositories/projects.js` | pure | Minimal project-registry queries (list / active / switch / upsert / delete) over an **injected** db adapter — the bootstrap and provisioning metadata surface. |
| `src/filesystem.js` | native | Resolves keys to `File`/`Directory`, ensures the directory tree, durable **atomic** writes. |
| `src/database.js` | native | Canonical DB name, connection config (foreign keys, WAL), adapts `expo-sqlite` to the runner. |
| `src/index.js` | native | `initializeGatherStorage()`, wires the real SecureStore adapter, re-exports the public API. |

### APIs intentionally **not** wrapped

Because Expo already provides the right abstraction, these pass through:

- **SQL execution** — `initializeGatherStorage()` returns the real
  `SQLiteDatabase`; callers use `runAsync`/`getAllAsync`/`withTransactionAsync`
  directly. We do not re-expose `executeSql()`-style wrappers.
- **File read/primitive write** — `fileForKey(key)` returns a real Expo `File`;
  callers use `.text()`, `.bytes()`, `.exists`, etc. We only add value where
  Gather has an invariant: *location* (relative-key resolution) and *durability*
  (atomic write).
- **Raw SecureStore get/set** — we expose semantic project-credential operations,
  not a generic encrypted key/value store.

There is intentionally **no** `Artifact`/`Repository`/`Manager` framework and no
ORM: centralized path/key/credential conventions are enough for now.

## Filesystem layout

```
Documents/gather/                 (durable — safe from OS eviction)
  projects/<projectKey>/
    forms/  resources/  instances/  media/  instruments/  models/

Cache/gather/                     (disposable — may be evicted)
  temp/  thumbnails/
```

- Durable data → `Paths.document`; reconstructable data → `Paths.cache`.
- Projects are isolated under `projects/<projectKey>/`.
- Metadata stores **relative keys** like `projects/abc/forms/silphium/form.xml`,
  never absolute container URIs; `fileForKey()` resolves them to the current Expo
  FileSystem location.

### Durable write policy

`writeTextAtomic` / `writeBytesAtomic` write a hidden temp sibling, then
`File.move` it onto the canonical path (a same-volume rename). An interrupted
write therefore never leaves a corrupt canonical artifact. On failure the temp
file is removed.

## Database initialization

- One canonical database: `gather.db` (`GATHER_DATABASE_NAME`).
- Every connection enables `PRAGMA foreign_keys = ON` (per-connection in SQLite,
  off by default) and `PRAGMA journal_mode = WAL`, outside any transaction.
- Schema version uses `PRAGMA user_version`. Migrations are contiguous integers
  from 1; the runner applies each pending migration inside its own transaction
  that also stamps `user_version`, so a failure rolls back atomically and retries
  next run. Re-running when already current is a no-op (idempotent).
- This foundation ships migration **1** (`gather_meta`) proving the mechanism and
  migration **2** (`projects`) — the minimal persistent project registry the M5.1
  shell needs to bootstrap (a `project_key` PK plus a partial unique index that
  enforces at most one active project). Further domain tables are added by
  appending new migrations — never editing an already-shipped version.

- migration **3** (`form_catalog`) adds mutable catalog rows plus immutable form
  versions and resource metadata. XML, sanitized manifest metadata, and resources
  are referenced only by durable relative keys; version/resource records are
  insert-only, so a draft's referenced version cannot be overwritten by refresh.

- migration **4** (`instances`) adds local instance lifecycle metadata only:
  local/ODK instance IDs, project/form IDs, exact immutable version/hash,
  `draft`/`ready`/`sent` state, timestamps, sanitized send result, and the
  durable relative XML key. It has no answer columns. SQLite verifies the copied
  form identity against the immutable cached version and prevents later rewrites.
- migration **5** (`instance_media`) adds the narrow per-instance media mapping:
  XForms binding reference, safe attachment filename, MIME type, and durable
  relative media key. It stores no image bytes or answers; deleting an instance
  cascades its mapping while the lifecycle deletes copied media files.
- migration **6** (`project_instance_cleanup`) removes a project's instances
  before its immutable form-version records cascade, so project removal also
  cascades media metadata and can delete the project media tree.

## Credential lifecycle

- Key format (centralized): `gather.project.<projectKey>.appUserToken`.
- `projectKey` is validated to `[A-Za-z0-9._-]` (also the SecureStore-legal
  charset), so keys need no further escaping.
- `CredentialStore.setProjectToken / getProjectToken / deleteProjectCredentials`.
- **Cleanup:** iOS Keychain values can survive an app uninstall/reinstall, so
  project removal must call `deleteProjectCredentials()` explicitly.
  `projectCredentialKeys()` enumerates every owned key so deletion stays complete
  as new secret kinds are added.
- Project metadata deletion intentionally only removes the SQLite project row.
  The app-level provisioning lifecycle coordinates that operation with credential
  and project-directory cleanup, and reports failure rather than claiming a
  partially cleaned project was removed.

## Tests

- **Unit (Node, `npm test` in this package):** tests across paths, credentials,
  migrations, form versions, instance transitions, and per-instance media
  metadata. They cover deterministic relative keys, draft → ready → sent
  transitions, and prohibit reverse mutation; authoritative XML remains in the
  filesystem.
  and migrations — deterministic path generation, project-key isolation,
  path-traversal rejection, SecureStore key generation, credential set/get/delete
  via an injected seam, migration ordering/contiguity, repeated initialization
  and migration idempotence. They assert Gather invariants, not "a mock was
  called".
- **iOS runtime gate:** `10/10` PASS (iPhone simulator, Hermes).
- **Android runtime gate:** `10/10` PASS (Pixel emulator, Hermes).

Runtime gate sequence (see `gates/StorageGateApp.js`): initialize → DB opens →
migration version correct → foreign keys on → write/read structured record →
write/read durable text → write/read durable binary → set/get SecureStore token →
close + reinitialize (idempotent) → data persists across re-open → delete
credential → credential gone. No secret values are logged.

## Future extension points

- **M5 shell** appends migrations + path usage for: `projects`, `forms`/versions
  and `resources`, `instances`, and `draft/finalized/sent` submission state.
- **M6 offline runtime** later adds: Entity overlays, submission/media queues,
  sync state, media lifecycle, and dependency ordering — extending these same
  primitives (new migrations, new project subpaths), not replacing them.

## Verdict

**GREEN** — the package establishes durable SQLite / FileSystem / SecureStore
primitives on both iOS and Android without unnecessary abstraction.
