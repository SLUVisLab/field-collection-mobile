/**
 * Native SQLite binding for Gather storage (imports `expo-sqlite`).
 *
 * Owns the canonical database name, connection configuration (foreign keys,
 * WAL), and adapts the real connection to the pure migration runner. It exposes
 * the real `SQLiteDatabase` handle rather than wrapping every SQL call — the app
 * uses expo-sqlite directly once Gather's DB is opened and migrated.
 *
 * Not unit-tested in Node (native module); the runner it delegates to is.
 */

import * as SQLite from 'expo-sqlite';

import { MIGRATIONS } from './migrations/index.js';
import { applyMigrations, latestVersion } from './migrations/runner.js';

export const GATHER_DATABASE_NAME = 'gather.db';

/** Adapt an `expo-sqlite` database to the pure migration runner's contract. */
const migrationAdapter = (db) => ({
  async getUserVersion() {
    const row = await db.getFirstAsync('PRAGMA user_version;');
    return row ? Number(row.user_version) : 0;
  },
  async setUserVersion(version) {
    // PRAGMA does not accept bound parameters; `version` is an integer we own.
    await db.execAsync(`PRAGMA user_version = ${Number(version)};`);
  },
  async exec(sql) {
    await db.execAsync(sql);
  },
  async transaction(fn) {
    await db.withTransactionAsync(fn);
  },
});

/**
 * Open and configure the canonical Gather database connection.
 *
 * Foreign-key enforcement is per-connection in SQLite and OFF by default, so it
 * must be enabled explicitly on every connection. WAL improves concurrent read
 * performance. Both PRAGMAs run outside any transaction, as SQLite requires.
 */
export const openGatherDatabase = async () => {
  const db = await SQLite.openDatabaseAsync(GATHER_DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
};

/** Run any pending migrations transactionally. Returns `{ from, to, applied }`. */
export const migrateGatherDatabase = async (db) =>
  applyMigrations(migrationAdapter(db), MIGRATIONS);

/** The schema version this build expects after migrations complete. */
export const gatherSchemaVersion = () => latestVersion(MIGRATIONS);
