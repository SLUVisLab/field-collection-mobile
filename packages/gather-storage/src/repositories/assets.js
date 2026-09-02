/**
 * Ledger for project assets that are **not** form attachments.
 *
 * Form attachments are tracked by `instance_media` and are needed until
 * submission takes them. Everything else — a scientific capture kept for local
 * review, an intermediate a composition computed from — is referenced by
 * nothing in the database, so a sweep cannot tell it apart from an orphaned
 * byte. This table is what makes cleanup safe: retention is recorded
 * explicitly, per asset.
 *
 * See docs/b-custom-composition-conventions.md §4.
 */

import { assertProjectKey, assertRelativeKey } from '../paths.js';

export const ASSET_RETENTION = Object.freeze({
  KEEP: 'keep',
  DISCARD: 'discard',
});

const RETENTION_SET = new Set(Object.values(ASSET_RETENTION));

export class AssetsRepositoryError extends Error {
  constructor(message, { code = 'GATHER_ASSETS_ERROR', details = null } = {}) {
    super(message);
    this.name = 'AssetsRepositoryError';
    this.code = code;
    this.details = details;
  }
}

const fail = (message, code, details) => {
  throw new AssetsRepositoryError(message, { code, details });
};

const nonEmpty = (value, field) => {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${field} must be a non-empty string`, 'GATHER_ASSETS_INVALID', { field });
  }
  return value;
};

const assertRetention = (value) => {
  if (!RETENTION_SET.has(value)) {
    fail("retention must be 'keep' or 'discard'", 'GATHER_ASSETS_INVALID', { field: 'retention' });
  }
  return value;
};

const COLUMNS =
  'file_key, project_key, asset_id, content_type, retention, local_instance_id, created_at, released_at';

const rowToAsset = (row) => {
  if (!row) return null;
  return {
    fileKey: row.file_key,
    projectKey: row.project_key,
    assetId: row.asset_id,
    contentType: row.content_type,
    retention: row.retention,
    localInstanceId: row.local_instance_id ?? null,
    createdAt: row.created_at,
    releasedAt: row.released_at ?? null,
  };
};

const assertDb = (db) => {
  if (
    !db ||
    typeof db.getAllAsync !== 'function' ||
    typeof db.getFirstAsync !== 'function' ||
    typeof db.runAsync !== 'function'
  ) {
    fail('a SQLite-shaped database is required', 'GATHER_ASSETS_INVALID', { field: 'db' });
  }
};

export const createAssetsRepository = (db) => {
  assertDb(db);

  return {
    /**
     * Records an asset and its retention. Idempotent on `fileKey`, so
     * re-persisting the same asset updates rather than duplicating.
     *
     * `retention` is required and never inferred: B-custom §4 makes
     * persistence an explicit authoring policy, not a consequence of type.
     */
    async recordAsset(input = {}) {
      const value = {
        fileKey: assertRelativeKey(input.fileKey),
        projectKey: assertProjectKey(input.projectKey),
        assetId: nonEmpty(input.assetId, 'assetId'),
        contentType: nonEmpty(input.contentType, 'contentType'),
        retention: assertRetention(input.retention),
        localInstanceId:
          input.localInstanceId == null ? null : nonEmpty(input.localInstanceId, 'localInstanceId'),
      };
      await db.runAsync(
        `INSERT INTO project_assets (
           file_key, project_key, asset_id, content_type, retention, local_instance_id
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(file_key) DO UPDATE SET
           asset_id = excluded.asset_id,
           content_type = excluded.content_type,
           retention = excluded.retention,
           local_instance_id = excluded.local_instance_id;`,
        [
          value.fileKey,
          value.projectKey,
          value.assetId,
          value.contentType,
          value.retention,
          value.localInstanceId,
        ]
      );
      return value;
    },

    async listAssets(projectKey) {
      const key = assertProjectKey(projectKey);
      const rows = await db.getAllAsync(
        `SELECT ${COLUMNS}
           FROM project_assets
          WHERE project_key = ?
          ORDER BY file_key ASC;`,
        [key]
      );
      return (rows ?? []).map(rowToAsset);
    },

    async getAsset(fileKey) {
      const key = assertRelativeKey(fileKey);
      return rowToAsset(
        await db.getFirstAsync(`SELECT ${COLUMNS} FROM project_assets WHERE file_key = ?;`, [key])
      );
    },

    /**
     * Marks a `discard` asset as no longer needed.
     *
     * This is the seam that keeps "discard" from meaning "delete immediately
     * after compute": bytes survive until the producer releases them, and a
     * sweep only reclaims released ones.
     */
    async releaseAsset(fileKey) {
      const key = assertRelativeKey(fileKey);
      await db.runAsync(
        `UPDATE project_assets
            SET released_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE file_key = ?;`,
        [key]
      );
      return { fileKey: key };
    },

    /** Drops the ledger row. Callers delete the bytes; this forgets them. */
    async deleteAsset(fileKey) {
      const key = assertRelativeKey(fileKey);
      await db.runAsync(`DELETE FROM project_assets WHERE file_key = ?;`, [key]);
      return { fileKey: key };
    },
  };
};

export { rowToAsset };
