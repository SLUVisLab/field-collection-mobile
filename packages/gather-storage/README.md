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
- This foundation ships **one** migration (`gather_meta`) proving the mechanism.
  Domain tables are added by appending new migrations — never editing version 1.

## Credential lifecycle

- Key format (centralized): `gather.project.<projectKey>.appUserToken`.
- `projectKey` is validated to `[A-Za-z0-9._-]` (also the SecureStore-legal
  charset), so keys need no further escaping.
- `CredentialStore.setProjectToken / getProjectToken / deleteProjectCredentials`.
- **Cleanup:** iOS Keychain values can survive an app uninstall/reinstall, so
  project removal must call `deleteProjectCredentials()` explicitly.
  `projectCredentialKeys()` enumerates every owned key so deletion stays complete
  as new secret kinds are added.

## Tests

- **Unit (Node, `npm test` in this package):** 22 tests across paths, credentials
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
