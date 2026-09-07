/**
 * Projects repository — PURE query logic over an injected async db adapter
 * (no `expo-*` imports here, so it is fully unit-testable in Node).
 *
 * The adapter matches the subset of the `expo-sqlite` async API the repository
 * needs; `database.js`/the app pass the real `SQLiteDatabase` handle, which
 * already satisfies this shape:
 *   getAllAsync(sql, params?):   Promise<object[]>
 *   getFirstAsync(sql, params?): Promise<object | null>
 *   runAsync(sql, params?):      Promise<{ changes: number, ... }>
 *   withTransactionAsync(fn):    Promise<void>   // runs fn in a txn
 *
 * This is the MINIMAL surface the M5.1 shell needs to bootstrap: list projects,
 * read the active project, and switch/seed the active project. Provisioning
 * (M5.2) extends this repository with verified create/verify/remove flows; it
 * builds on these primitives rather than redefining them.
 */

import { assertProjectKey } from '../paths.js';

export class ProjectsRepositoryError extends Error {
  constructor(message, { code = 'GATHER_PROJECTS_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ProjectsRepositoryError';
    this.code = code;
    this.details = details;
  }
}

/** Columns selected for a project row, in a stable order. */
const PROJECT_COLUMNS =
  'project_key, display_name, base_url, central_project_id, is_active, created_at, updated_at';

/** Map a raw SQLite row into a plain project object with typed fields. */
export const rowToProject = (row) => {
  if (!row) return null;
  return {
    projectKey: row.project_key,
    displayName: row.display_name,
    baseUrl: row.base_url,
    centralProjectId: row.central_project_id ?? null,
    isActive: Number(row.is_active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const assertNonEmptyString = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ProjectsRepositoryError(`${field} must be a non-empty string`, {
      code: 'GATHER_PROJECTS_INVALID',
      details: { field, value },
    });
  }
  return value;
};

/**
 * Create a projects repository over a db-like adapter.
 *
 * @param {{
 *   getAllAsync: Function,
 *   getFirstAsync: Function,
 *   runAsync: Function,
 *   withTransactionAsync: Function,
 * }} db
 */
export const createProjectsRepository = (db) => {
  if (
    !db ||
    typeof db.getAllAsync !== 'function' ||
    typeof db.getFirstAsync !== 'function' ||
    typeof db.runAsync !== 'function' ||
    typeof db.withTransactionAsync !== 'function'
  ) {
    throw new ProjectsRepositoryError('createProjectsRepository requires a db adapter', {
      code: 'GATHER_PROJECTS_NO_DB',
    });
  }

  const repo = {
    /** All projects, ordered by display name (case-insensitive). */
    async listProjects() {
      const rows = await db.getAllAsync(
        `SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY display_name COLLATE NOCASE ASC;`
      );
      return (rows ?? []).map(rowToProject);
    },

    /** The single active project, or `null` when none is active. */
    async getActiveProject() {
      const row = await db.getFirstAsync(
        `SELECT ${PROJECT_COLUMNS} FROM projects WHERE is_active = 1 LIMIT 1;`
      );
      return rowToProject(row);
    },

    /** A single project by key, or `null`. */
    async getProject(projectKey) {
      const key = assertProjectKey(projectKey);
      const row = await db.getFirstAsync(
        `SELECT ${PROJECT_COLUMNS} FROM projects WHERE project_key = ? LIMIT 1;`,
        [key]
      );
      return rowToProject(row);
    },

    /** Number of registered projects. */
    async countProjects() {
      const row = await db.getFirstAsync('SELECT COUNT(*) AS n FROM projects;');
      return row ? Number(row.n) : 0;
    },

    /**
     * Insert or update a project's metadata (credentials are NOT handled here —
     * they live in SecureStore). Never changes `is_active`; use
     * `setActiveProject` for that. Returns the stored project.
     */
    async upsertProject({ projectKey, displayName, baseUrl, centralProjectId = null }) {
      const key = assertProjectKey(projectKey);
      assertNonEmptyString(displayName, 'displayName');
      assertNonEmptyString(baseUrl, 'baseUrl');
      await db.runAsync(
        `INSERT INTO projects (project_key, display_name, base_url, central_project_id)
           VALUES (?, ?, ?, ?)
         ON CONFLICT (project_key) DO UPDATE SET
           display_name       = excluded.display_name,
           base_url           = excluded.base_url,
           central_project_id = excluded.central_project_id,
           updated_at         = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');`,
        [key, displayName, baseUrl, centralProjectId]
      );
      return repo.getProject(key);
    },

    /**
     * Make `projectKey` the single active project (clearing any prior active
     * one) inside one transaction, honoring the single-active index. Throws if
     * the project does not exist. Returns the newly active project.
     */
    async setActiveProject(projectKey) {
      const key = assertProjectKey(projectKey);
      let existed = false;
      await db.withTransactionAsync(async () => {
        const found = await db.getFirstAsync(
          'SELECT project_key FROM projects WHERE project_key = ? LIMIT 1;',
          [key]
        );
        if (!found) return;
        existed = true;
        // Clear the previous active row first so the partial unique index never
        // sees two active rows mid-transaction.
        await db.runAsync(
          `UPDATE projects
             SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE is_active = 1;`
        );
        await db.runAsync(
          `UPDATE projects
             SET is_active = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE project_key = ?;`,
          [key]
        );
      });
      if (!existed) {
        throw new ProjectsRepositoryError(`no such project: ${key}`, {
          code: 'GATHER_PROJECTS_NOT_FOUND',
          details: { projectKey: key },
        });
      }
      return repo.getProject(key);
    },

    /** Clear the active project (return to the setup shell) without deleting it. */
    async clearActiveProject() {
      await db.runAsync(
        `UPDATE projects
           SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE is_active = 1;`
      );
    },

    /**
     * Remove one project's SQLite metadata row. Credentials and its filesystem
     * tree are deliberately owned by the provisioning lifecycle service, which
     * coordinates their cleanup and only reports success after every store has
     * completed.
     */
    async deleteProject(projectKey) {
      const key = assertProjectKey(projectKey);
      let removed = null;
      await db.withTransactionAsync(async () => {
        const found = await db.getFirstAsync(
          `SELECT ${PROJECT_COLUMNS} FROM projects WHERE project_key = ? LIMIT 1;`,
          [key]
        );
        if (!found) return;
        removed = rowToProject(found);
        await db.runAsync('DELETE FROM projects WHERE project_key = ?;', [key]);
      });
      if (!removed) {
        throw new ProjectsRepositoryError(`no such project: ${key}`, {
          code: 'GATHER_PROJECTS_NOT_FOUND',
          details: { projectKey: key },
        });
      }
      return removed;
    },
  };

  return repo;
};
