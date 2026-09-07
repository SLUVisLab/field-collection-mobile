/**
 * Durable submission synchronization journal. This is deliberately limited to
 * concrete sync operations and their explicit dependencies, not a job system.
 */

import { assertProjectKey } from '../paths.js';
import { assertLocalInstanceId } from './instances.js';
import { sanitizeErrorText } from '../sanitize.js';

export const SYNC_OPERATION_KINDS = Object.freeze({
  SUBMISSION: 'submission',
});

export const SYNC_OPERATION_STATES = Object.freeze({
  PENDING: 'pending',
  ATTEMPTING: 'attempting',
  RETRYABLE: 'retryable',
  BLOCKED: 'blocked',
  COMPLETE: 'complete',
});

const OPERATION_ID_RE = /^[A-Za-z0-9_-]{1,160}$/;
const ERROR_CODE_RE = /^[A-Z][A-Z0-9_]{0,127}$/;

export class SyncRepositoryError extends Error {
  constructor(message, { code = 'GATHER_SYNC_ERROR', details = null } = {}) {
    super(message);
    this.name = 'SyncRepositoryError';
    this.code = code;
    this.details = details;
  }
}

const fail = (message, code, details = null) => {
  throw new SyncRepositoryError(message, { code, details });
};

export const assertSyncOperationId = (value) => {
  if (typeof value !== 'string' || !OPERATION_ID_RE.test(value)) {
    fail('operationId must use only letters, digits, "_" or "-"', 'GATHER_SYNC_INVALID', {
      field: 'operationId',
    });
  }
  return value;
};

const assertErrorCode = (value) => {
  if (value == null) return null;
  if (typeof value !== 'string' || !ERROR_CODE_RE.test(value)) {
    fail('lastErrorCode must be an uppercase error code or null', 'GATHER_SYNC_INVALID', {
      field: 'lastErrorCode',
    });
  }
  return value;
};

export const rowToSyncOperation = (row) => {
  if (!row) return null;
  return {
    operationId: row.operation_id,
    projectKey: row.project_key,
    kind: row.kind,
    localInstanceId: row.local_instance_id,
    state: row.state,
    attemptCount: Number(row.attempt_count),
    lastAttemptAt: row.last_attempt_at ?? null,
    lastErrorCode: row.last_error_code ?? null,
    lastErrorSummary: row.last_error_summary ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const rowToDependency = (row) => ({
  operationId: row.operation_id,
  dependsOnOperationId: row.depends_on_operation_id,
});

const assertDb = (db) => {
  if (
    !db ||
    typeof db.getAllAsync !== 'function' ||
    typeof db.getFirstAsync !== 'function' ||
    typeof db.runAsync !== 'function'
  ) {
    fail('createSyncRepository requires a db adapter', 'GATHER_SYNC_NO_DB');
  }
};

const OPERATION_COLUMNS = `
  operation_id, project_key, kind, local_instance_id, state, attempt_count,
  last_attempt_at, last_error_code, last_error_summary, created_at, updated_at`;

const requireUpdatedOperation = async (get, operationId, expectedState) => {
  const operation = await get(operationId);
  if (!operation) {
    fail('Sync operation was not found', 'GATHER_SYNC_NOT_FOUND', { operationId });
  }
  if (expectedState != null && operation.state !== expectedState) {
    fail('Sync operation is not in the required state', 'GATHER_SYNC_INVALID_TRANSITION', {
      operationId,
      state: operation.state,
      expectedState,
    });
  }
  return operation;
};

/**
 * @param {{ getAllAsync: Function, getFirstAsync: Function, runAsync: Function }} db
 * Expo SQLite's async shape or a test seam.
 */
export const createSyncRepository = (db) => {
  assertDb(db);

  const getOperation = async (operationId) => {
    const row = await db.getFirstAsync(
      `SELECT ${OPERATION_COLUMNS}
         FROM sync_operations
        WHERE operation_id = ?
        LIMIT 1;`,
      [assertSyncOperationId(operationId)]
    );
    return rowToSyncOperation(row);
  };

  const getSubmissionOperation = async ({ projectKey, localInstanceId } = {}) => {
    const row = await db.getFirstAsync(
      `SELECT ${OPERATION_COLUMNS}
         FROM sync_operations
        WHERE project_key = ? AND kind = 'submission' AND local_instance_id = ?
        LIMIT 1;`,
      [assertProjectKey(projectKey), assertLocalInstanceId(localInstanceId)]
    );
    return rowToSyncOperation(row);
  };

  return {
    getOperation,
    getSubmissionOperation,

    async listOperations(projectKey) {
      const rows = await db.getAllAsync(
        `SELECT ${OPERATION_COLUMNS}
           FROM sync_operations
          WHERE project_key = ?
          ORDER BY created_at ASC, operation_id ASC;`,
        [assertProjectKey(projectKey)]
      );
      return (rows ?? []).map(rowToSyncOperation);
    },

    async listDependencies(projectKey) {
      const rows = await db.getAllAsync(
        `SELECT d.operation_id, d.depends_on_operation_id
           FROM sync_dependencies d
           JOIN sync_operations o ON o.operation_id = d.operation_id
          WHERE o.project_key = ?
          ORDER BY d.operation_id ASC, d.depends_on_operation_id ASC;`,
        [assertProjectKey(projectKey)]
      );
      return (rows ?? []).map(rowToDependency);
    },

    /**
     * Create the single submission operation for a ready/sent instance, or
     * return the existing one. The migration trigger verifies the instance
     * belongs to this project and remains syncable.
     */
    async ensureSubmissionOperation({
      operationId,
      projectKey,
      localInstanceId,
      initialState = SYNC_OPERATION_STATES.PENDING,
    } = {}) {
      const id = assertSyncOperationId(operationId);
      const key = assertProjectKey(projectKey);
      const instanceId = assertLocalInstanceId(localInstanceId);
      if (
        initialState !== SYNC_OPERATION_STATES.PENDING &&
        initialState !== SYNC_OPERATION_STATES.COMPLETE
      ) {
        fail('a submission operation must begin pending or complete', 'GATHER_SYNC_INVALID', {
          initialState,
        });
      }
      await db.runAsync(
        `INSERT INTO sync_operations (
           operation_id, project_key, kind, local_instance_id, state
         )
         SELECT ?, ?, 'submission', i.local_instance_id, ?
           FROM instances i
          WHERE i.local_instance_id = ?
            AND i.project_key = ?
            AND i.state IN ('ready', 'sent')
         ON CONFLICT(project_key, kind, local_instance_id) DO NOTHING;`,
        [id, key, initialState, instanceId, key]
      );
      const operation = await getSubmissionOperation({ projectKey: key, localInstanceId: instanceId });
      if (!operation) {
        fail('Only ready or sent instances can have a submission operation', 'GATHER_SYNC_INSTANCE_NOT_SYNCABLE', {
          localInstanceId: instanceId,
          projectKey: key,
        });
      }
      return operation;
    },

    async addDependency({ operationId, dependsOnOperationId } = {}) {
      const id = assertSyncOperationId(operationId);
      const dependencyId = assertSyncOperationId(dependsOnOperationId);
      if (id === dependencyId) {
        fail('a sync operation cannot depend on itself', 'GATHER_SYNC_INVALID_DEPENDENCY', {
          operationId: id,
        });
      }
      const [operation, dependency] = await Promise.all([getOperation(id), getOperation(dependencyId)]);
      if (!operation || !dependency) {
        fail('Both sync operations must exist before adding a dependency', 'GATHER_SYNC_INVALID_DEPENDENCY');
      }
      if (operation.projectKey !== dependency.projectKey) {
        fail('Sync dependencies cannot cross projects', 'GATHER_SYNC_INVALID_DEPENDENCY');
      }
      await db.runAsync(
        `INSERT OR IGNORE INTO sync_dependencies (operation_id, depends_on_operation_id)
         VALUES (?, ?);`,
        [id, dependencyId]
      );
    },

    async markAttempting(operationId) {
      const id = assertSyncOperationId(operationId);
      await db.runAsync(
        `UPDATE sync_operations
            SET state = 'attempting',
                attempt_count = attempt_count + 1,
                last_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                last_error_code = NULL,
                last_error_summary = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE operation_id = ? AND state IN ('pending', 'retryable');`,
        [id]
      );
      return requireUpdatedOperation(getOperation, id, SYNC_OPERATION_STATES.ATTEMPTING);
    },

    async markRetryable({ operationId, lastErrorCode, lastErrorSummary } = {}) {
      const id = assertSyncOperationId(operationId);
      const code = assertErrorCode(lastErrorCode);
      const summary = sanitizeErrorText(lastErrorSummary, 'Submission failed. Try again.');
      await db.runAsync(
        `UPDATE sync_operations
            SET state = 'retryable',
                last_error_code = ?,
                last_error_summary = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE operation_id = ? AND state = 'attempting';`,
        [code, summary, id]
      );
      return requireUpdatedOperation(getOperation, id, SYNC_OPERATION_STATES.RETRYABLE);
    },

    async markBlocked({ operationId, lastErrorCode, lastErrorSummary } = {}) {
      const id = assertSyncOperationId(operationId);
      const code = assertErrorCode(lastErrorCode);
      const summary = sanitizeErrorText(lastErrorSummary, 'Submission is blocked.');
      await db.runAsync(
        `UPDATE sync_operations
            SET state = 'blocked',
                last_error_code = ?,
                last_error_summary = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE operation_id = ? AND state IN ('pending', 'retryable');`,
        [code, summary, id]
      );
      return requireUpdatedOperation(getOperation, id, SYNC_OPERATION_STATES.BLOCKED);
    },

    async markComplete(operationId) {
      const id = assertSyncOperationId(operationId);
      await requireUpdatedOperation(getOperation, id);
      await db.runAsync(
        `UPDATE sync_operations
            SET state = 'complete',
                last_error_code = NULL,
                last_error_summary = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE operation_id = ? AND state <> 'complete';`,
        [id]
      );
      return requireUpdatedOperation(getOperation, id, SYNC_OPERATION_STATES.COMPLETE);
    },

    /**
     * A process death after an upload starts has no persisted response. Until
     * M6.4 characterizes Central's ambiguous-acceptance behavior, preserve the
     * operation as an explicit retryable foreground action rather than claiming
     * it completed.
     */
    async recoverAttempting(projectKey) {
      const key = assertProjectKey(projectKey);
      const result = await db.runAsync(
        `UPDATE sync_operations
            SET state = 'retryable',
                last_error_code = 'GATHER_SYNC_ATTEMPT_INTERRUPTED',
                last_error_summary = 'A previous foreground sync was interrupted before its result was saved. Try syncing again.',
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE project_key = ? AND state = 'attempting';`,
        [key]
      );
      return Number(result?.changes ?? 0);
    },
  };
};
