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
  assert.equal(latestVersion(MIGRATIONS), 11);
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

test('migration 7 provisions durable submission operations and dependencies', () => {
  const journal = MIGRATIONS.find((migration) => migration.version === 7);
  assert.ok(journal, 'version 7 migration exists');
  assert.equal(journal.name, 'sync_journal');
  const sql = journal.statements.join('\n');
  assert.match(sql, /CREATE TABLE sync_operations/);
  assert.match(sql, /local_instance_id\s+TEXT NOT NULL REFERENCES instances/);
  assert.match(sql, /'pending', 'attempting', 'retryable', 'blocked', 'complete'/);
  assert.match(sql, /UNIQUE \(project_key, kind, local_instance_id\)/);
  assert.match(sql, /CREATE TABLE sync_dependencies/);
  assert.match(sql, /sync_operations_require_matching_instance/);
  assert.match(sql, /sync_dependencies_require_same_project/);
});

test('migration 8 provisions an immutable Entity effect overlay keyed by local instance', () => {
  const overlay = MIGRATIONS.find((migration) => migration.version === 8);
  assert.ok(overlay, 'version 8 migration exists');
  assert.equal(overlay.name, 'entity_overlay');
  const sql = overlay.statements.join('\n');
  assert.match(sql, /ALTER TABLE form_resources ADD COLUMN entity_dataset_name/);
  assert.match(sql, /CREATE TABLE entity_branches/);
  assert.match(sql, /CREATE TABLE entity_effect_batches/);
  assert.match(sql, /CREATE TABLE entity_effects/);
  assert.match(sql, /local_instance_id\s+TEXT NOT NULL REFERENCES instances/);
  assert.match(sql, /UNIQUE \(local_instance_id, effect_index\)/);
  assert.match(sql, /entity_effects_require_matching_instance/);
});

test('migration 9 provisions project-scoped fieldwork session intent', () => {
  const fieldwork = MIGRATIONS.find((migration) => migration.version === 9);
  assert.ok(fieldwork);
  const sql = fieldwork.statements.join('\n');
  assert.match(sql, /CREATE TABLE fieldwork_sessions/);
  assert.match(sql, /target_entity_ids_json\s+TEXT NOT NULL/);
  assert.match(sql, /CREATE TABLE fieldwork_session_instances/);
  assert.match(sql, /fieldwork_sessions_require_matching_form_version/);
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

test('migration 10 re-keys instance media off the positional binding reference', () => {
  // Repeat references reindex on deletion, so they cannot be a durable media
  // identity. See docs/repeat-media-identity-characterization.md.
  const media = MIGRATIONS.find((migration) => migration.name === 'instance_media_identity');
  assert.equal(media.version, 10);
  const sql = media.statements.join('\n');

  assert.match(sql, /PRIMARY KEY \(local_instance_id, filename\)/);
  assert.doesNotMatch(sql, /PRIMARY KEY \(local_instance_id, binding_reference\)/);

  // The rebuild must be lossless: every column is carried across, because
  // `filename` already existed and was already unique per instance.
  assert.match(sql, /INSERT INTO instance_media_next/);
  assert.match(sql, /SELECT local_instance_id, binding_reference, filename, content_type, file_key/);
  assert.match(sql, /DROP TABLE instance_media;/);
  assert.match(sql, /ALTER TABLE instance_media_next RENAME TO instance_media;/);
  // The index is dropped with the old table, so it must be recreated.
  assert.match(sql, /CREATE INDEX instance_media_by_instance/);
  // binding_reference is retained as provenance, just no longer an identity.
  assert.match(sql, /binding_reference TEXT NOT NULL/);
});

test('migration 11 provisions instance-scoped provenance that cascades', () => {
  const receipts = MIGRATIONS.find((m) => m.version === 11);
  assert.ok(receipts, 'version 11 migration exists');
  assert.equal(receipts.name, 'instance_receipts');
  const sql = receipts.statements.join('\n');

  // One receipt per projected field, so a value's provenance is addressable.
  assert.match(sql, /PRIMARY KEY \(local_instance_id, binding_reference\)/);
  // Provenance must not outlive the instance it describes.
  assert.match(sql, /REFERENCES instances\(local_instance_id\) ON DELETE CASCADE/);
  // The receipt is kept verbatim for audit, with the queried fields extracted.
  assert.match(sql, /receipt_json\s+TEXT NOT NULL/);
  for (const column of ['capability', 'capability_revision', 'revision', 'recorded_at']) {
    assert.match(sql, new RegExp(`${column}\\s+TEXT NOT NULL`), `${column} is recorded`);
  }
  assert.match(sql, /CREATE INDEX instance_receipts_by_instance/);
});
