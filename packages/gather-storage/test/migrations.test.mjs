import test from 'node:test';
import assert from 'node:assert/strict';

import { MIGRATIONS } from '../src/migrations/index.js';
import {
  MigrationError,
  applyMigrations,
  assertMigrationOrder,
  latestVersion,
  pendingMigrations,
} from '../src/migrations/runner.js';

/** Fake db implementing the runner's contract, recording all activity. */
const makeFakeDb = (startVersion = 0) => {
  let version = startVersion;
  return {
    executed: [],
    log: [],
    async getUserVersion() {
      return version;
    },
    async setUserVersion(v) {
      version = v;
      this.log.push(`version=${v}`);
    },
    async exec(sql) {
      this.executed.push(sql);
      this.log.push('exec');
    },
    async transaction(fn) {
      this.log.push('begin');
      await fn();
      this.log.push('commit');
    },
    currentVersion() {
      return version;
    },
  };
};

test('the shipped MIGRATIONS are well-ordered', () => {
  assert.doesNotThrow(() => assertMigrationOrder(MIGRATIONS));
  assert.equal(latestVersion(MIGRATIONS), MIGRATIONS.length);
  assert.equal(latestVersion(MIGRATIONS), 1);
});

test('assertMigrationOrder rejects non-contiguous or non-integer versions', () => {
  assert.throws(() => assertMigrationOrder([{ version: 2, statements: [] }]), MigrationError);
  assert.throws(
    () => assertMigrationOrder([{ version: 1, statements: [] }, { version: 3, statements: [] }]),
    MigrationError
  );
  assert.throws(() => assertMigrationOrder([{ version: 1.5, statements: [] }]), MigrationError);
  assert.throws(() => assertMigrationOrder('nope'), MigrationError);
});

test('pendingMigrations returns only versions above the current one', () => {
  const migrations = [
    { version: 1, statements: ['a'] },
    { version: 2, statements: ['b'] },
    { version: 3, statements: ['c'] },
  ];
  assert.deepEqual(pendingMigrations(0, migrations).map((m) => m.version), [1, 2, 3]);
  assert.deepEqual(pendingMigrations(2, migrations).map((m) => m.version), [3]);
  assert.deepEqual(pendingMigrations(3, migrations).map((m) => m.version), []);
});

test('applyMigrations runs pending migrations in order, transactionally', async () => {
  const migrations = [
    { version: 1, name: 'a', statements: ['CREATE TABLE a (id INTEGER);'] },
    { version: 2, name: 'b', statements: ['CREATE TABLE b (id INTEGER);', 'CREATE INDEX bx ON b(id);'] },
  ];
  const db = makeFakeDb(0);
  const result = await applyMigrations(db, migrations);

  assert.deepEqual(result, { from: 0, to: 2, applied: [1, 2] });
  assert.equal(db.currentVersion(), 2);
  assert.deepEqual(db.executed, [
    'CREATE TABLE a (id INTEGER);',
    'CREATE TABLE b (id INTEGER);',
    'CREATE INDEX bx ON b(id);',
  ]);
  // Each migration is wrapped in its own begin/…/version/commit.
  assert.deepEqual(db.log, [
    'begin', 'exec', 'version=1', 'commit',
    'begin', 'exec', 'exec', 'version=2', 'commit',
  ]);
});

test('applyMigrations is idempotent: a second run does nothing', async () => {
  const migrations = [{ version: 1, name: 'a', statements: ['CREATE TABLE a (id INTEGER);'] }];
  const db = makeFakeDb(0);

  const first = await applyMigrations(db, migrations);
  assert.deepEqual(first.applied, [1]);
  const executedAfterFirst = db.executed.length;

  const second = await applyMigrations(db, migrations);
  assert.deepEqual(second, { from: 1, to: 1, applied: [] });
  assert.equal(db.executed.length, executedAfterFirst, 'no new statements executed on re-run');
});

test('applyMigrations resumes from a partially-migrated database', async () => {
  const migrations = [
    { version: 1, name: 'a', statements: ['CREATE TABLE a (id INTEGER);'] },
    { version: 2, name: 'b', statements: ['CREATE TABLE b (id INTEGER);'] },
  ];
  const db = makeFakeDb(1); // already at version 1
  const result = await applyMigrations(db, migrations);
  assert.deepEqual(result, { from: 1, to: 2, applied: [2] });
  assert.deepEqual(db.executed, ['CREATE TABLE b (id INTEGER);']);
});
