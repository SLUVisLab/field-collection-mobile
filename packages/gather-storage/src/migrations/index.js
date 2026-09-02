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
 * form-version records. Version 7 adds the M6 submission sync journal. Version
 * 8 adds the M6 Entity overlay. Later work extends this by appending migrations
 * (never by editing an already-shipped version).
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
  {
    version: 7,
    name: 'sync_journal',
    statements: [
         // A ready ODK Submission has one durable operation. `kind` intentionally
         // remains extensible, while M6.1 only creates "submission" operations.
         `CREATE TABLE sync_operations (
            operation_id       TEXT PRIMARY KEY NOT NULL,
            project_key        TEXT NOT NULL REFERENCES projects(project_key) ON DELETE CASCADE,
            kind               TEXT NOT NULL,
            local_instance_id  TEXT NOT NULL REFERENCES instances(local_instance_id) ON DELETE CASCADE,
            state              TEXT NOT NULL DEFAULT 'pending'
                               CHECK (state IN ('pending', 'attempting', 'retryable', 'blocked', 'complete')),
            attempt_count      INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
            last_attempt_at    TEXT,
            last_error_code    TEXT,
            last_error_summary TEXT,
            created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            UNIQUE (project_key, kind, local_instance_id)
          );`,
         `CREATE INDEX sync_operations_by_project_state_created
            ON sync_operations (project_key, state, created_at, operation_id);`,
         `CREATE TABLE sync_dependencies (
            operation_id            TEXT NOT NULL REFERENCES sync_operations(operation_id) ON DELETE CASCADE,
            depends_on_operation_id TEXT NOT NULL REFERENCES sync_operations(operation_id) ON DELETE CASCADE,
            PRIMARY KEY (operation_id, depends_on_operation_id),
            CHECK (operation_id <> depends_on_operation_id)
          );`,
         `CREATE INDEX sync_dependencies_by_dependency
            ON sync_dependencies (depends_on_operation_id);`,
         // The local instance ID is globally unique, but this guard makes the
         // journal's project scope explicit and only permits ready/sent instances.
         `CREATE TRIGGER sync_operations_require_matching_instance
            BEFORE INSERT ON sync_operations
            FOR EACH ROW
            BEGIN
              SELECT CASE WHEN NOT EXISTS (
                SELECT 1 FROM instances
                 WHERE local_instance_id = NEW.local_instance_id
                   AND project_key = NEW.project_key
                   AND state IN ('ready', 'sent')
              ) THEN RAISE(ABORT, 'sync operation requires a ready or sent project instance') END;
            END;`,
         `CREATE TRIGGER sync_dependencies_require_same_project
            BEFORE INSERT ON sync_dependencies
            FOR EACH ROW
            BEGIN
              SELECT CASE WHEN (
                SELECT project_key FROM sync_operations WHERE operation_id = NEW.operation_id
              ) <> (
                SELECT project_key FROM sync_operations WHERE operation_id = NEW.depends_on_operation_id
              ) THEN RAISE(ABORT, 'sync dependencies must remain within a project') END;
            END;`,
    ],
  },
  {
    version: 8,
    name: 'entity_overlay',
    statements: [
    // The App User's Entity List remains the immutable cached form resource.
    // These rows retain only local branch identity and finalized, engine-derived
    // changes that are overlaid when that CSV is loaded again.
    `ALTER TABLE form_resources ADD COLUMN entity_dataset_name TEXT;`,
    `CREATE TABLE entity_branches (
       project_key  TEXT NOT NULL REFERENCES projects(project_key) ON DELETE CASCADE,
       dataset_name TEXT NOT NULL,
       entity_id    TEXT NOT NULL,
       branch_id    TEXT NOT NULL,
       created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       PRIMARY KEY (project_key, dataset_name, entity_id)
     );`,
    `CREATE TABLE entity_effect_batches (
       local_instance_id TEXT PRIMARY KEY NOT NULL
                         REFERENCES instances(local_instance_id) ON DELETE CASCADE,
       project_key       TEXT NOT NULL REFERENCES projects(project_key) ON DELETE CASCADE,
       effects_json      TEXT NOT NULL,
       created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     );`,
    // `local_instance_id` is deliberately the association rather than a
    // sync-operation FK: finalization precedes M6.1's operation creation.
    // M6.4 can join this to its one submission operation by local instance ID
    // when it creates dependency edges.
    `CREATE TABLE entity_effects (
       effect_id         INTEGER PRIMARY KEY AUTOINCREMENT,
       local_instance_id TEXT NOT NULL REFERENCES instances(local_instance_id) ON DELETE CASCADE,
       project_key       TEXT NOT NULL REFERENCES projects(project_key) ON DELETE CASCADE,
       effect_index      INTEGER NOT NULL CHECK (effect_index >= 0),
       reference         TEXT,
       dataset_name      TEXT NOT NULL,
       action            TEXT NOT NULL CHECK (action IN ('create', 'update')),
       entity_id         TEXT NOT NULL,
       label             TEXT,
       properties_json   TEXT NOT NULL,
       base_version      TEXT,
       trunk_version     TEXT,
       branch_id         TEXT NOT NULL,
       created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
       UNIQUE (local_instance_id, effect_index)
     );`,
    `CREATE INDEX entity_effects_by_project_dataset_order
       ON entity_effects (project_key, dataset_name, effect_id);`,
    `CREATE TRIGGER entity_effect_batches_require_matching_instance
       BEFORE INSERT ON entity_effect_batches
       FOR EACH ROW
       BEGIN
         SELECT CASE WHEN NOT EXISTS (
           SELECT 1 FROM instances
            WHERE local_instance_id = NEW.local_instance_id
              AND project_key = NEW.project_key
         ) THEN RAISE(ABORT, 'entity effect batch requires a matching project instance') END;
       END;`,
    `CREATE TRIGGER entity_effects_require_matching_instance
       BEFORE INSERT ON entity_effects
       FOR EACH ROW
       BEGIN
         SELECT CASE WHEN NOT EXISTS (
           SELECT 1 FROM instances
            WHERE local_instance_id = NEW.local_instance_id
              AND project_key = NEW.project_key
         ) THEN RAISE(ABORT, 'entity effect requires a matching project instance') END;
       END;`,
    ],
  },
  {
    version: 9,
    name: 'fieldwork_sessions',
    statements: [
      `CREATE TABLE fieldwork_sessions (
         session_id              TEXT PRIMARY KEY NOT NULL,
         project_key             TEXT NOT NULL REFERENCES projects(project_key) ON DELETE CASCADE,
         form_id                 TEXT NOT NULL,
         form_version_id         TEXT NOT NULL REFERENCES form_versions(form_version_id) ON DELETE RESTRICT,
         entity_dataset          TEXT NOT NULL,
         target_entity_ids_json  TEXT NOT NULL,
         current_entity_id       TEXT,
         filters_json            TEXT NOT NULL DEFAULT '{}',
         grouping_json           TEXT NOT NULL DEFAULT '{}',
         sorting_json            TEXT NOT NULL DEFAULT '[]',
         view_mode               TEXT NOT NULL DEFAULT 'list' CHECK (view_mode IN ('list', 'groups', 'map')),
         started_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
         completed_at            TEXT
       );`,
      `CREATE TABLE fieldwork_session_instances (
         session_id        TEXT NOT NULL REFERENCES fieldwork_sessions(session_id) ON DELETE CASCADE,
         entity_id         TEXT NOT NULL,
         local_instance_id TEXT NOT NULL REFERENCES instances(local_instance_id) ON DELETE CASCADE,
         PRIMARY KEY (session_id, entity_id),
         UNIQUE (session_id, local_instance_id)
       );`,
      `CREATE INDEX fieldwork_sessions_by_project_started
         ON fieldwork_sessions (project_key, started_at DESC);`,
      `CREATE INDEX fieldwork_session_instances_by_instance
         ON fieldwork_session_instances (local_instance_id);`,
      `CREATE TRIGGER fieldwork_sessions_require_matching_form_version
         BEFORE INSERT ON fieldwork_sessions
         FOR EACH ROW
         BEGIN
           SELECT CASE WHEN NOT EXISTS (
             SELECT 1 FROM form_versions fv JOIN forms f ON f.form_key = fv.form_key
              WHERE fv.form_version_id = NEW.form_version_id
                AND f.project_key = NEW.project_key
                AND f.form_id = NEW.form_id
           ) THEN RAISE(ABORT, 'fieldwork session requires a matching project form version') END;
         END;`,
    ],
  },
  {
    version: 10,
    name: 'instance_media_identity',
    statements: [
      // Media identity must not derive from the XForms binding reference.
      // Repeat instance references are positional and reindex on deletion, so a
      // survivor inherits the deleted item's key — a silent wrong attachment.
      // See docs/repeat-media-identity-characterization.md.
      //
      // SQLite cannot alter a primary key, so rebuild the table. The copy is
      // lossless: `filename` already exists and was already unique per
      // instance, so it simply becomes the key it should always have been.
      `CREATE TABLE instance_media_next (
         local_instance_id TEXT NOT NULL REFERENCES instances(local_instance_id) ON DELETE CASCADE,
         binding_reference TEXT NOT NULL,
         filename          TEXT NOT NULL,
         content_type      TEXT NOT NULL,
         file_key          TEXT NOT NULL,
         PRIMARY KEY (local_instance_id, filename)
       );`,
      `INSERT INTO instance_media_next
         (local_instance_id, binding_reference, filename, content_type, file_key)
         SELECT local_instance_id, binding_reference, filename, content_type, file_key
           FROM instance_media;`,
      `DROP TABLE instance_media;`,
      `ALTER TABLE instance_media_next RENAME TO instance_media;`,
      `CREATE INDEX instance_media_by_instance
         ON instance_media (local_instance_id);`,
    ],
  },
  {
    version: 11,
    name: 'instance_receipts',
    statements: [
      // Provenance for computed field values. `createExecutionReceipt` has
      // always produced receipts, but nothing persisted them — so provenance
      // did not survive acceptance, and there was nowhere to look to tell a
      // Gather-computed value apart from one typed in by hand in another ODK
      // client. That distinction is what B-custom principle 5 rests on, since
      // the backing fields stay ordinary writable XForms values rather than
      // being marked readonly.
      // See docs/b-custom-composition-conventions.md.
      //
      // One row per (instance, binding reference): a receipt describes how one
      // projected field's value was produced. Cascades with the instance, so a
      // discarded draft takes its provenance with it.
      //
      // `receipt_json` keeps the receipt verbatim for audit; the extracted
      // columns exist so "is this value computed, and by what" is answerable
      // without parsing every row.
      `CREATE TABLE instance_receipts (
         local_instance_id   TEXT NOT NULL REFERENCES instances(local_instance_id) ON DELETE CASCADE,
         binding_reference   TEXT NOT NULL,
         capability          TEXT NOT NULL,
         capability_revision TEXT NOT NULL,
         revision            TEXT NOT NULL,
         recorded_at         TEXT NOT NULL,
         receipt_json        TEXT NOT NULL,
         PRIMARY KEY (local_instance_id, binding_reference)
       );`,
      `CREATE INDEX instance_receipts_by_instance
         ON instance_receipts (local_instance_id);`,
    ],
  },
  {
    version: 12,
    name: 'project_assets',
    statements: [
      // The ledger for assets that are NOT form attachments.
      //
      // `persistScientificCapture` writes into the project media directory
      // without an `instance_media` row, so those bytes are referenced by
      // nothing in the database. That made cleanup impossible to do safely:
      // "delete every file no `instance_media` row references" would delete
      // every scientific capture — precisely the `projection: none,
      // retention: keep` assets that B-custom §4 says to keep.
      //
      // So retention becomes explicit, per asset, and recorded. A sweep can
      // then tell a deliberately-kept local asset from an orphaned byte.
      // See docs/b-custom-composition-conventions.md §4.
      //
      // `released_at` is what makes "discard" safe: bytes stay until the
      // producer says they are no longer needed. `discard` must never mean
      // "delete immediately after compute" — a submitted attachment has to
      // survive the submission handoff.
      `CREATE TABLE project_assets (
         file_key          TEXT PRIMARY KEY NOT NULL,
         project_key       TEXT NOT NULL REFERENCES projects(project_key) ON DELETE CASCADE,
         asset_id          TEXT NOT NULL,
         content_type      TEXT NOT NULL,
         retention         TEXT NOT NULL,
         local_instance_id TEXT,
         created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
         released_at       TEXT,
         CHECK (retention IN ('keep', 'discard'))
       );`,
      `CREATE INDEX project_assets_by_project
         ON project_assets (project_key);`,
    ],
  },
]);
