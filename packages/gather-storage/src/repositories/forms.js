/**
 * Immutable form-catalog repository. It is deliberately pure: the caller owns
 * Central transport and durable FileSystem writes, while this module owns only
 * SQLite metadata and the rule that cached version/resource records are
 * insert-only.
 */

import { assertProjectKey } from '../paths.js';

export class FormsRepositoryError extends Error {
  constructor(message, { code = 'GATHER_FORMS_ERROR', details = null } = {}) {
    super(message);
    this.name = 'FormsRepositoryError';
    this.code = code;
    this.details = details;
  }
}

const nonEmpty = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new FormsRepositoryError(`${field} must be a non-empty string`, {
      code: 'GATHER_FORMS_INVALID',
      details: { field },
    });
  }
  return value;
};

const stringOrEmpty = (value) => (typeof value === 'string' ? value : '');

/**
 * Stable local identifiers are JSON tuples rather than hand-built SQL/path
 * strings. They preserve arbitrary Central form IDs without giving them any
 * filesystem meaning.
 */
export const formKeyFor = ({ projectKey, formId } = {}) =>
  JSON.stringify([assertProjectKey(projectKey), nonEmpty(formId, 'formId')]);

export const manifestFingerprintFor = (resources = []) => {
  const normalized = (Array.isArray(resources) ? resources : [])
    .map((resource) => ({
      filename: nonEmpty(resource?.filename, 'resource filename'),
      hash: stringOrEmpty(resource?.hash),
      type: resource?.type ?? null,
      isEntityList: Boolean(resource?.isEntityList),
      entityDataset: resource?.entityDataset ?? null,
    }))
    .sort((left, right) => left.filename.localeCompare(right.filename));
  return JSON.stringify(normalized);
};

export const formVersionKeyFor = ({
  formKey,
  sourceVersion = '',
  sourceHash = '',
  manifestFingerprint,
} = {}) =>
  JSON.stringify([
    nonEmpty(formKey, 'formKey'),
    stringOrEmpty(sourceVersion),
    stringOrEmpty(sourceHash),
    nonEmpty(manifestFingerprint, 'manifestFingerprint'),
  ]);

const rowToResource = (row) => ({
  filename: row.filename,
  // The SERVER's validator — whether we must fetch again.
  hash: row.resource_hash || null,
  type: row.resource_type ?? null,
  isEntityList: Number(row.is_entity_list) === 1,
  entityDataset: row.entity_dataset_name ?? null,
  contentType: row.content_type,
  fileKey: row.file_key,
  // OUR digest of the bytes — whether we already hold them. Empty for rows
  // written before migration 13, which still resolve through `fileKey`.
  blobDigest: row.blob_digest || null,
});

const rowToVersion = (row) => {
  if (!row) return null;
  return {
    formVersionId: row.form_version_id,
    formKey: row.form_key,
    formId: row.form_id,
    projectKey: row.project_key,
    displayName: row.display_name,
    sourceVersion: row.source_version || null,
    sourceHash: row.source_hash || null,
    manifestFingerprint: row.manifest_fingerprint,
    xmlFileKey: row.xml_file_key,
    manifestFileKey: row.manifest_file_key,
    cachedAt: row.cached_at,
  };
};

const rowToForm = (row) => ({
  formKey: row.form_key,
  projectKey: row.project_key,
  formId: row.form_id,
  displayName: row.display_name,
  remoteVersion: row.remote_version || null,
  remoteHash: row.remote_hash || null,
  currentVersionId: row.current_version_id ?? null,
  refreshedAt: row.refreshed_at,
  cachedAt: row.cached_at ?? null,
  resourceCount: Number(row.resource_count ?? 0),
});

const assertDb = (db) => {
  if (
    !db ||
    typeof db.getAllAsync !== 'function' ||
    typeof db.getFirstAsync !== 'function' ||
    typeof db.runAsync !== 'function' ||
    typeof db.withTransactionAsync !== 'function'
  ) {
    throw new FormsRepositoryError('createFormsRepository requires a db adapter', {
      code: 'GATHER_FORMS_NO_DB',
    });
  }
};

const FORM_VERSION_COLUMNS = `
  fv.form_version_id, fv.form_key, f.form_id, f.project_key, f.display_name,
  fv.source_version, fv.source_hash, fv.manifest_fingerprint,
  fv.xml_file_key, fv.manifest_file_key, fv.cached_at`;

/**
 * @param {{ getAllAsync: Function, getFirstAsync: Function, runAsync: Function,
 *   withTransactionAsync: Function }} db Expo SQLite's async shape or a test seam.
 */
export const createFormsRepository = (db) => {
  assertDb(db);

  const getVersion = async (formVersionId) => {
    const row = await db.getFirstAsync(
      `SELECT ${FORM_VERSION_COLUMNS}
         FROM form_versions fv JOIN forms f ON f.form_key = fv.form_key
        WHERE fv.form_version_id = ? LIMIT 1;`,
      [nonEmpty(formVersionId, 'formVersionId')]
    );
    if (!row) return null;
    const version = rowToVersion(row);
    const resources = await db.getAllAsync(
      `SELECT filename, resource_hash, resource_type, is_entity_list, entity_dataset_name,
              content_type, file_key, blob_digest
         FROM form_resources WHERE form_version_id = ? ORDER BY filename COLLATE NOCASE ASC;`,
      [version.formVersionId]
    );
    return { ...version, resources: (resources ?? []).map(rowToResource) };
  };

  return {
    async listForms(projectKey) {
      const key = assertProjectKey(projectKey);
      const rows = await db.getAllAsync(
        `SELECT f.form_key, f.project_key, f.form_id, f.display_name, f.remote_version,
                f.remote_hash, f.current_version_id, f.refreshed_at, fv.cached_at,
                COUNT(fr.filename) AS resource_count
           FROM forms f
           LEFT JOIN form_versions fv ON fv.form_version_id = f.current_version_id
           LEFT JOIN form_resources fr ON fr.form_version_id = fv.form_version_id
          WHERE f.project_key = ?
          GROUP BY f.form_key
          ORDER BY f.display_name COLLATE NOCASE ASC, f.form_id ASC;`,
        [key]
      );
      return (rows ?? []).map(rowToForm);
    },

    getVersion,

    async getCurrentVersion(projectKey, formId) {
      const formKey = formKeyFor({ projectKey, formId });
      const row = await db.getFirstAsync(
        `SELECT current_version_id FROM forms WHERE form_key = ? LIMIT 1;`,
        [formKey]
      );
      return row?.current_version_id ? getVersion(row.current_version_id) : null;
    },

    async findVersion({ formKey, sourceVersion = '', sourceHash = '', manifestFingerprint }) {
      const id = formVersionKeyFor({ formKey, sourceVersion, sourceHash, manifestFingerprint });
      return getVersion(id);
    },

    async versionHasDrafts(formVersionId) {
      const row = await db.getFirstAsync(
        'SELECT 1 AS referenced FROM drafts WHERE form_version_id = ? LIMIT 1;',
        [nonEmpty(formVersionId, 'formVersionId')]
      );
      return Boolean(row?.referenced);
    },

    /**
     * Persist a fully-written cache version. No existing version or resource is
     * ever updated: SQLite INSERT OR IGNORE plus immutable triggers make this
     * safe even if a future caller mistakenly retries a version referenced by a
     * draft. Only the parent catalog's *current pointer* is mutable.
     */
    async recordCachedVersion({
      projectKey,
      formId,
      displayName,
      sourceVersion = '',
      sourceHash = '',
      manifestFingerprint,
      xmlFileKey,
      manifestFileKey,
      resources = [],
    }) {
      const formKey = formKeyFor({ projectKey, formId });
      const versionId = formVersionKeyFor({
        formKey,
        sourceVersion,
        sourceHash,
        manifestFingerprint,
      });
      const name = nonEmpty(displayName, 'displayName');
      const normalizedResources = (Array.isArray(resources) ? resources : []).map((resource) => ({
        filename: nonEmpty(resource?.filename, 'resource filename'),
        hash: stringOrEmpty(resource?.hash),
        type: resource?.type ?? null,
        isEntityList: Boolean(resource?.isEntityList) ? 1 : 0,
        entityDataset: resource?.entityDataset == null ? null : nonEmpty(resource.entityDataset, 'entity dataset'),
        contentType: nonEmpty(resource?.contentType, 'resource contentType'),
        fileKey: nonEmpty(resource?.fileKey, 'resource fileKey'),
        blobDigest: stringOrEmpty(resource?.blobDigest),
      }));

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO forms (
             form_key, project_key, form_id, display_name, remote_version, remote_hash, refreshed_at
           ) VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT (form_key) DO UPDATE SET
             display_name = excluded.display_name,
             remote_version = excluded.remote_version,
             remote_hash = excluded.remote_hash,
             refreshed_at = excluded.refreshed_at;`,
          [formKey, assertProjectKey(projectKey), formId, name, stringOrEmpty(sourceVersion), stringOrEmpty(sourceHash)]
        );
        await db.runAsync(
          `INSERT OR IGNORE INTO form_versions (
             form_version_id, form_key, source_version, source_hash, manifest_fingerprint,
             xml_file_key, manifest_file_key
           ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            versionId,
            formKey,
            stringOrEmpty(sourceVersion),
            stringOrEmpty(sourceHash),
            nonEmpty(manifestFingerprint, 'manifestFingerprint'),
            nonEmpty(xmlFileKey, 'xmlFileKey'),
            nonEmpty(manifestFileKey, 'manifestFileKey'),
          ]
        );
        for (const resource of normalizedResources) {
          await db.runAsync(
            `INSERT OR IGNORE INTO form_resources (
               form_version_id, filename, resource_hash, resource_type,
               is_entity_list, entity_dataset_name, content_type, file_key, blob_digest
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              versionId,
              resource.filename,
              resource.hash,
              resource.type,
              resource.isEntityList,
              resource.entityDataset,
              resource.contentType,
              resource.fileKey,
              resource.blobDigest,
            ]
          );
        }
        await db.runAsync(
          `UPDATE forms
              SET current_version_id = ?, refreshed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE form_key = ?;`,
          [versionId, formKey]
        );
      });
      return getVersion(versionId);
    },

    /**
     * Has this form already downloaded this filename under this server
     * validator? If so the bytes need not be fetched again — which is the whole
     * OpenRosa caching rule, applied per media file rather than per form
     * version.
     *
     * Scoped to the form deliberately. A validator is only meaningful where the
     * server issued it: a Dataset attachment's hash is a timestamp, not a
     * content digest, so it says nothing across forms.
     */
    async findResourceByValidator({ projectKey, formId, filename, resourceHash }) {
      if (typeof resourceHash !== 'string' || resourceHash.length === 0) return null;
      const formKey = formKeyFor({ projectKey, formId });
      const row = await db.getFirstAsync(
        `SELECT fr.filename, fr.resource_hash, fr.resource_type, fr.is_entity_list,
                fr.entity_dataset_name, fr.content_type, fr.file_key, fr.blob_digest
           FROM form_resources fr
           JOIN form_versions fv ON fv.form_version_id = fr.form_version_id
          WHERE fv.form_key = ? AND fr.filename = ? AND fr.resource_hash = ?
                AND fr.blob_digest <> ''
          LIMIT 1;`,
        [formKey, nonEmpty(filename, 'filename'), resourceHash]
      );
      return row ? rowToResource(row) : null;
    },

    /** The bytes, if we already hold them under this digest. */
    async getResourceBlob(digest) {
      if (typeof digest !== 'string' || digest.length === 0) return null;
      const row = await db.getFirstAsync(
        `SELECT digest, byte_length, file_key, created_at FROM resource_blobs WHERE digest = ? LIMIT 1;`,
        [digest]
      );
      return row
        ? { digest: row.digest, byteLength: Number(row.byte_length), fileKey: row.file_key, createdAt: row.created_at }
        : null;
    },

    async recordResourceBlob({ digest, byteLength, fileKey }) {
      const value = {
        digest: nonEmpty(digest, 'blob digest'),
        byteLength: Number(byteLength) || 0,
        fileKey: nonEmpty(fileKey, 'blob fileKey'),
      };
      await db.runAsync(
        `INSERT INTO resource_blobs (digest, byte_length, file_key) VALUES (?, ?, ?)
         ON CONFLICT (digest) DO UPDATE SET byte_length = excluded.byte_length, file_key = excluded.file_key;`,
        [value.digest, value.byteLength, value.fileKey]
      );
      return value;
    },

    /**
     * Reachability inputs for the blob sweep: every blob any form revision
     * still references, and every blob we have recorded.
     *
     * Mark-and-sweep rather than reference counts. A counter has to stay
     * correct across a refresh that fails half way through; reachability is
     * simply recomputed, and the number of form resources on a device is small.
     */
    async listReferencedBlobDigests() {
      const rows = await db.getAllAsync(
        `SELECT DISTINCT blob_digest FROM form_resources WHERE blob_digest <> '';`
      );
      return (rows ?? []).map((row) => row.blob_digest);
    },

    async listResourceBlobs() {
      const rows = await db.getAllAsync(
        `SELECT digest, byte_length, file_key FROM resource_blobs ORDER BY digest ASC;`
      );
      return (rows ?? []).map((row) => ({
        digest: row.digest,
        byteLength: Number(row.byte_length),
        fileKey: row.file_key,
      }));
    },

    async deleteResourceBlob(digest) {
      await db.runAsync(`DELETE FROM resource_blobs WHERE digest = ?;`, [nonEmpty(digest, 'digest')]);
      return { digest };
    },

    /** Promote an already immutable version after a repeated explicit refresh. */
    async promoteVersion({ projectKey, formId, displayName, sourceVersion = '', sourceHash = '', formVersionId }) {
      const formKey = formKeyFor({ projectKey, formId });
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `UPDATE forms
              SET display_name = ?, remote_version = ?, remote_hash = ?,
                  current_version_id = ?, refreshed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE form_key = ?;`,
          [
            nonEmpty(displayName, 'displayName'),
            stringOrEmpty(sourceVersion),
            stringOrEmpty(sourceHash),
            nonEmpty(formVersionId, 'formVersionId'),
            formKey,
          ]
        );
      });
      return getVersion(formVersionId);
    },
  };
};
