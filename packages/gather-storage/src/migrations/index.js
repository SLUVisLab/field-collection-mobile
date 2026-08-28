/**
 * Ordered Gather database migrations — PURE data (no `expo-*` imports).
 *
 * Each migration has a monotonically increasing integer `version` (which becomes
 * the SQLite `PRAGMA user_version` once applied) and a list of `statements`
 * executed together inside a single transaction by the runner.
 *
 * This foundation ships ONE real migration that proves the mechanism end to end.
 * The domain tables (projects, forms, form versions, resources, instances,
 * draft/finalized/sent state, submission queue, …) are intentionally NOT defined
 * here — they are added by later M5 shell work once their application contracts
 * exist, by appending new migrations (never by editing version 1).
 */

export const MIGRATIONS = Object.freeze([
  {
    version: 1,
    name: 'storage_foundation',
    statements: [
      // A tiny key/value meta table: proves DDL runs transactionally and gives
      // the storage layer a place to stamp provenance. It is NOT a generic
      // "objects" bag for domain data — real tables get their own migrations.
      `CREATE TABLE gather_meta (
         key   TEXT PRIMARY KEY NOT NULL,
         value TEXT
       );`,
      `INSERT INTO gather_meta (key, value)
         VALUES ('schema_origin', 'm5_storage_foundation');`,
    ],
  },
]);
