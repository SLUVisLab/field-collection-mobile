/**
 * Ordered Gather database migrations — PURE data (no `expo-*` imports).
 *
 * Each migration has a monotonically increasing integer `version` (which becomes
 * the SQLite `PRAGMA user_version` once applied) and a list of `statements`
 * executed together inside a single transaction by the runner.
 *
 * Version 1 ships the storage foundation (meta table) that proves the mechanism
 * end to end. Version 2 adds the minimal `projects` table the M5.1 shell needs to
 * bootstrap (decide the setup-vs-active shell and switch the active project).
 *
 * Version 3 adds the immutable form-catalog cache used by M5.3. Version 4 adds
 * the durable instance lifecycle. Version 5 adds per-instance binary media
 * metadata. Version 6 makes project removal delete instances before immutable
 * form-version records. Later work extends this by appending migrations (never
 * by editing an already-shipped version).
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
  {
    version: 2,
    name: 'projects',
    statements: [
      // The minimal persistent project registry needed to bootstrap the app
      // shell. `project_key` is the stable local identifier (also the filesystem
      // path segment and SecureStore namespace — see paths.js). Central
      // credentials live ONLY in SecureStore, never here. Provisioning (M5.2)
      // extends this table's usage; it must not redefine version 2.
      `CREATE TABLE projects (
         project_key        TEXT PRIMARY KEY NOT NULL,
         display_name       TEXT NOT NULL,
         base_url           TEXT NOT NULL,
         central_project_id INTEGER,
         is_active          INTEGER NOT NULL DEFAULT 0,
         created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
         updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
         CHECK (is_active IN (0, 1))
       );`,
      // At most one active project at a time. A partial unique index lets many
      // rows have is_active = 0 while allowing only a single is_active = 1.
      `CREATE UNIQUE INDEX projects_single_active
         ON projects (is_active) WHERE is_active = 1;`,
    ],
  },
  {
    version: 3,
    name: 'form_catalog',
    statements: [
      // `forms` is mutable catalog metadata; `form_versions` is deliberately
      // append-only. The latter's files are addressed by relative durable keys.
      `CREATE TABLE forms (
         form_key           TEXT PRIMARY KEY NOT NULL,
         project_key        TEXT NOT NULL REFERENCES projects(project_key) ON DELETE CASCADE,
         form_id            TEXT NOT NULL,
         display_name       TEXT NOT NULL,
         remote_version     TEXT NOT NULL DEFAULT '',
         remote_hash        TEXT NOT NULL DEFAULT '',
         current_version_id TEXT,
         refreshed_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
         UNIQUE (project_key, form_id)
       );`,
      `CREATE TABLE form_versions (
         form_version_id     TEXT PRIMARY KEY NOT NULL,
         form_key            TEXT NOT NULL REFERENCES forms(form_key) ON DELETE CASCADE,
         source_version      TEXT NOT NULL DEFAULT '',
         source_hash         TEXT NOT NULL DEFAULT '',
         manifest_fingerprint TEXT NOT NULL,
         xml_file_key        TEXT NOT NULL,
         manifest_file_key   TEXT NOT NULL,
         cached_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
         UNIQUE (form_key, source_version, source_hash, manifest_fingerprint)
       );`,
      `CREATE TABLE form_resources (
         form_version_id TEXT NOT NULL REFERENCES form_versions(form_version_id) ON DELETE CASCADE,
         filename        TEXT NOT NULL,
         resource_hash   TEXT NOT NULL DEFAULT '',
         resource_type   TEXT,
         is_entity_list  INTEGER NOT NULL DEFAULT 0 CHECK (is_entity_list IN (0, 1)),
         content_type    TEXT NOT NULL,
         file_key        TEXT NOT NULL,
         PRIMARY KEY (form_version_id, filename)
       );`,
      // M5.3 does not create submissions yet, but this explicit reference is the
      // durable guard for versions later opened as drafts. It lets cache code
      // prove that it has not replaced a version a draft can still restore.
      `CREATE TABLE drafts (
         draft_id        TEXT PRIMARY KEY NOT NULL,
         project_key     TEXT NOT NULL REFERENCES projects(project_key) ON DELETE CASCADE,
         form_version_id TEXT NOT NULL REFERENCES form_versions(form_version_id) ON DELETE CASCADE,
         instance_key    TEXT NOT NULL,
         state           TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'ready')),
         created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
         updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       );`,
      `CREATE INDEX forms_by_project_name ON forms (project_key, display_name COLLATE NOCASE);`,
      `CREATE INDEX form_versions_by_form_cached ON form_versions (form_key, cached_at DESC);`,
      `CREATE INDEX drafts_by_version ON drafts (form_version_id);`,
      // SQLite-level protection backs the repository's insert-only policy.
      `CREATE TRIGGER form_versions_immutable
         BEFORE UPDATE ON form_versions
         BEGIN
           SELECT RAISE(ABORT, 'form_versions are immutable');
         END;`,
      `CREATE TRIGGER form_resources_immutable
         BEFORE UPDATE ON form_resources
         BEGIN
           SELECT RAISE(ABORT, 'form_resources are immutable');
         END;`,
    ],
  },
  {
    version: 4,
    name: 'instances',
    statements: [
      // Submission XML is authoritative and is stored in the durable filesystem;
      // this table is deliberately only its searchable lifecycle metadata. The
      // duplicated source version/hash is checked against the immutable catalog
      // row on insert, which makes the exact revision visible without joining.
      `CREATE TABLE instances (
         local_instance_id TEXT PRIMARY KEY NOT NULL,
         odk_instance_id   TEXT NOT NULL,
         project_key       TEXT NOT NULL REFERENCES projects(project_key) ON DELETE CASCADE,
         form_id           TEXT NOT NULL,
         form_version_id   TEXT NOT NULL REFERENCES form_versions(form_version_id) ON DELETE RESTRICT,
         form_version      TEXT NOT NULL DEFAULT '',
         form_hash         TEXT NOT NULL DEFAULT '',
         state             TEXT NOT NULL DEFAULT 'draft'
                          CHECK (state IN ('draft', 'ready', 'sent')),
         xml_file_key      TEXT NOT NULL,
         created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
         updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
         finalized_at      TEXT,
         sent_at           TEXT,
         send_receipt      TEXT,
         send_error        TEXT,
         UNIQUE (project_key, odk_instance_id)
       );`,
      `CREATE INDEX instances_by_project_state_updated
         ON instances (project_key, state, updated_at DESC);`,
      `CREATE INDEX instances_by_form_version ON instances (form_version_id);`,
      // A version's identity cannot be substituted from another form/project, or
      // have its exact source revision rewritten after XML is saved.
      `CREATE TRIGGER instances_require_exact_form_version
         BEFORE INSERT ON instances
         BEGIN
          SELECT CASE WHEN NOT EXISTS (
            SELECT 1
              FROM form_versions fv
              JOIN forms f ON f.form_key = fv.form_key
             WHERE fv.form_version_id = NEW.form_version_id
               AND f.project_key = NEW.project_key
               AND f.form_id = NEW.form_id
               AND fv.source_version = NEW.form_version
               AND fv.source_hash = NEW.form_hash
          ) THEN RAISE(ABORT, 'instance form version does not match immutable catalog version') END;
         END;`,
      `CREATE TRIGGER instances_form_identity_immutable
         BEFORE UPDATE OF project_key, form_id, form_version_id, form_version, form_hash ON instances
         BEGIN
          SELECT RAISE(ABORT, 'instance form identity is immutable');
         END;`,
    ],
  },
  {
    version: 5,
    name: 'instance_media',
    statements: [
      // Media bytes stay in Filesystem. This records just enough to restore the
      // XForms filename binding and resolve an Expo File for foreground submit.
      `CREATE TABLE instance_media (
         local_instance_id TEXT NOT NULL REFERENCES instances(local_instance_id) ON DELETE CASCADE,
         binding_reference TEXT NOT NULL,
         filename          TEXT NOT NULL,
         content_type      TEXT NOT NULL,
         file_key          TEXT NOT NULL,
         PRIMARY KEY (local_instance_id, binding_reference),
         UNIQUE (local_instance_id, filename)
       );`,
      `CREATE INDEX instance_media_by_instance
         ON instance_media (local_instance_id);`,
    ],
  },
  {
    version: 6,
    name: 'project_instance_cleanup',
    statements: [
      // `instances.form_version_id` intentionally restricts arbitrary version
      // removal. Project removal, however, owns all its instances and media, so
      // clear those records before project/form cascading begins.
      `CREATE TRIGGER projects_delete_instances
         BEFORE DELETE ON projects
         FOR EACH ROW
         BEGIN
           DELETE FROM instances WHERE project_key = OLD.project_key;
         END;`,
    ],
  },
]);
