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
  assert.equal(latestVersion(MIGRATIONS), 6);
});

test('migration 3 provisions append-only form versions and draft references', () => {
  const catalog = MIGRATIONS.find((m) => m.version === 3);
  assert.ok(catalog, 'version 3 migration exists');
  assert.equal(catalog.name, 'form_catalog');
  const sql = catalog.statements.join('\n');
  assert.match(sql, /CREATE TABLE forms/);
  assert.match(sql, /CREATE TABLE form_versions/);
  assert.match(sql, /CREATE TABLE form_resources/);
  assert.match(sql, /CREATE TABLE drafts/);
  assert.match(sql, /CREATE TRIGGER form_versions_immutable[\s\S]*BEFORE UPDATE/);
  assert.match(sql, /CREATE TRIGGER form_resources_immutable[\s\S]*BEFORE UPDATE/);
});

test('migration 4 provisions XML-backed instances with immutable form identity', () => {
  const instances = MIGRATIONS.find((m) => m.version === 4);
  assert.ok(instances, 'version 4 migration exists');
  assert.equal(instances.name, 'instances');
  const sql = instances.statements.join('\n');
  assert.match(sql, /CREATE TABLE instances/);
  assert.match(sql, /local_instance_id\s+TEXT PRIMARY KEY/);
  assert.match(sql, /odk_instance_id\s+TEXT NOT NULL/);
  assert.match(sql, /state\s+TEXT NOT NULL DEFAULT 'draft'[\s\S]*'draft', 'ready', 'sent'/);
  assert.match(sql, /xml_file_key\s+TEXT NOT NULL/);
  assert.match(sql, /instances_require_exact_form_version/);
  assert.match(sql, /instances_form_identity_immutable/);
});

test('migration 5 provisions relative-keyed per-instance media metadata', () => {
  const media = MIGRATIONS.find((m) => m.version === 5);
  assert.ok(media, 'version 5 migration exists');
  assert.equal(media.name, 'instance_media');
  const sql = media.statements.join('\n');
  assert.match(sql, /CREATE TABLE instance_media/);
  assert.match(sql, /binding_reference\s+TEXT NOT NULL/);
  assert.match(sql, /filename\s+TEXT NOT NULL/);
  assert.match(sql, /file_key\s+TEXT NOT NULL/);
  assert.match(sql, /REFERENCES instances\(local_instance_id\) ON DELETE CASCADE/);
});

test('migration 6 removes instances before project cascade preserves immutable version safety', () => {
  const cleanup = MIGRATIONS.find((m) => m.version === 6);
  assert.ok(cleanup, 'version 6 migration exists');
  assert.equal(cleanup.name, 'project_instance_cleanup');
  const sql = cleanup.statements.join('\n');
  assert.match(sql, /CREATE TRIGGER projects_delete_instances/);
  assert.match(sql, /BEFORE DELETE ON projects/);
  assert.match(sql, /DELETE FROM instances WHERE project_key = OLD\.project_key/);
});

test('migration 2 provisions the projects table with a single-active guard', () => {
  const projects = MIGRATIONS.find((m) => m.version === 2);
  assert.ok(projects, 'version 2 migration exists');
  assert.equal(projects.name, 'projects');
  const sql = projects.statements.join('\n');
  assert.match(sql, /CREATE TABLE projects/);
  assert.match(sql, /project_key\s+TEXT PRIMARY KEY/);
  // The partial unique index is what enforces "at most one active project".
  assert.match(sql, /CREATE UNIQUE INDEX projects_single_active[\s\S]*WHERE is_active = 1/);
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
