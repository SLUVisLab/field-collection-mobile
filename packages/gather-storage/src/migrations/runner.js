/**
 * Migration runner — PURE logic (no `expo-*` imports).
 *
 * Operates on any `db` object that exposes the async methods below, so it is
 * fully unit-testable with a fake in-memory db. `database.js` adapts the real
 * `expo-sqlite` connection to this contract.
 *
 * db contract:
 *   getUserVersion(): Promise<number>
 *   setUserVersion(version: number): Promise<void>
 *   exec(sql: string): Promise<void>
 *   transaction(fn: () => Promise<void>): Promise<void>   // runs fn in a txn
 */

export class MigrationError extends Error {
  constructor(message, { code = 'GATHER_MIGRATION_ERROR', details = null } = {}) {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Migrations must be contiguous integers starting at 1 (version N is the Nth
 * entry). This catches duplicate/missing/mis-ordered versions at their source.
 */
export const assertMigrationOrder = (migrations) => {
  if (!Array.isArray(migrations)) {
    throw new MigrationError('migrations must be an array', { details: { migrations } });
  }
  migrations.forEach((migration, index) => {
    if (!Number.isInteger(migration.version)) {
      throw new MigrationError(`migration at index ${index} has a non-integer version`, {
        details: migration,
      });
    }
    const expected = index + 1;
    if (migration.version !== expected) {
      throw new MigrationError(
        `migrations must be contiguous from 1: expected version ${expected}, got ${migration.version}`,
        { details: migration }
      );
    }
  });
  return migrations;
};

export const latestVersion = (migrations) =>
  migrations.length === 0 ? 0 : migrations[migrations.length - 1].version;

/** Migrations whose version is greater than the current schema version. */
export const pendingMigrations = (currentVersion, migrations) => {
  assertMigrationOrder(migrations);
  return migrations.filter((migration) => migration.version > currentVersion);
};

/**
 * Apply all pending migrations. Each migration runs in its own transaction that
 * also stamps `user_version`, so an interrupted/failed migration rolls back
 * atomically and is retried on the next run. Calling this when already at the
 * latest version is a no-op (idempotent).
 *
 * @returns {Promise<{ from: number, to: number, applied: number[] }>}
 */
export const applyMigrations = async (db, migrations) => {
  assertMigrationOrder(migrations);
  const from = await db.getUserVersion();
  const pending = migrations.filter((migration) => migration.version > from);

  for (const migration of pending) {
    await db.transaction(async () => {
      for (const statement of migration.statements) {
        await db.exec(statement);
      }
      await db.setUserVersion(migration.version);
    });
  }

  return { from, to: latestVersion(migrations), applied: pending.map((m) => m.version) };
};
