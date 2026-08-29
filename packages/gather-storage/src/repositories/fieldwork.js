import { assertLocalInstanceId } from './instances.js';
import { assertProjectKey } from '../paths.js';

export class FieldworkRepositoryError extends Error {
  constructor(message, { code = 'GATHER_FIELDWORK_ERROR', details = null } = {}) {
    super(message);
    this.name = 'FieldworkRepositoryError';
    this.code = code;
    this.details = details;
  }
}

const fail = (message, code = 'GATHER_FIELDWORK_INVALID', details = null) => {
  throw new FieldworkRepositoryError(message, { code, details });
};
const nonEmpty = (value, field) => {
  if (typeof value !== 'string' || value.length === 0) fail(`${field} must be a non-empty string`, undefined, { field });
  return value;
};
const json = (value, fallback) => JSON.stringify(value ?? fallback);
const parse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const rowToSession = (row) =>
  row && {
    sessionId: row.session_id,
    projectKey: row.project_key,
    formId: row.form_id,
    formVersionId: row.form_version_id,
    entityDataset: row.entity_dataset,
    targetEntityIds: parse(row.target_entity_ids_json, []),
    currentEntityId: row.current_entity_id,
    filters: parse(row.filters_json, {}),
    grouping: parse(row.grouping_json, {}),
    sorting: parse(row.sorting_json, []),
    viewMode: row.view_mode,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };

export const createFieldworkRepository = (db) => {
  if (!db || ['getAllAsync', 'getFirstAsync', 'runAsync'].some((key) => typeof db[key] !== 'function')) {
    fail('createFieldworkRepository requires a db adapter', 'GATHER_FIELDWORK_NO_DB');
  }
  const get = async (sessionId) =>
    rowToSession(
      await db.getFirstAsync('SELECT * FROM fieldwork_sessions WHERE session_id = ? LIMIT 1;', [
        nonEmpty(sessionId, 'sessionId'),
      ])
    );
  return {
    get,
    async list(projectKey) {
      return (await db.getAllAsync('SELECT * FROM fieldwork_sessions WHERE project_key = ? ORDER BY started_at DESC;', [
        assertProjectKey(projectKey),
      ])).map(rowToSession);
    },
    async create(input = {}) {
      const targetEntityIds = Array.isArray(input.targetEntityIds) ? [...new Set(input.targetEntityIds.map((id) => nonEmpty(id, 'targetEntityId')))] : null;
      if (!targetEntityIds) fail('targetEntityIds must be an array');
      const sessionId = nonEmpty(input.sessionId, 'sessionId');
      await db.runAsync(
        `INSERT INTO fieldwork_sessions (
           session_id, project_key, form_id, form_version_id, entity_dataset,
           target_entity_ids_json, current_entity_id, filters_json, grouping_json, sorting_json, view_mode
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          sessionId, assertProjectKey(input.projectKey), nonEmpty(input.formId, 'formId'),
          nonEmpty(input.formVersionId, 'formVersionId'), nonEmpty(input.entityDataset, 'entityDataset'),
          json(targetEntityIds, []), input.currentEntityId == null ? null : nonEmpty(input.currentEntityId, 'currentEntityId'),
          json(input.filters, {}), json(input.grouping, {}), json(input.sorting, []),
          ['list', 'groups', 'map'].includes(input.viewMode) ? input.viewMode : 'list',
        ]
      );
      return get(sessionId);
    },
    async update(sessionId, patch = {}) {
      const existing = await get(sessionId);
      if (!existing) fail('Fieldwork session was not found', 'GATHER_FIELDWORK_NOT_FOUND');
      const next = { ...existing, ...patch };
      if (next.currentEntityId != null && !existing.targetEntityIds.includes(next.currentEntityId)) {
        fail('currentEntityId is not in this fieldwork session', undefined, { currentEntityId: next.currentEntityId });
      }
      await db.runAsync(
        `UPDATE fieldwork_sessions SET current_entity_id = ?, filters_json = ?, grouping_json = ?,
          sorting_json = ?, view_mode = ?, completed_at = ? WHERE session_id = ?;`,
        [
          next.currentEntityId == null ? null : nonEmpty(next.currentEntityId, 'currentEntityId'),
          json(next.filters, {}), json(next.grouping, {}), json(next.sorting, []),
          ['list', 'groups', 'map'].includes(next.viewMode) ? next.viewMode : 'list',
          next.completedAt ?? null, existing.sessionId,
        ]
      );
      return get(existing.sessionId);
    },
    async associateInstance({ sessionId, entityId, localInstanceId } = {}) {
      await db.runAsync(
        `INSERT INTO fieldwork_session_instances (session_id, entity_id, local_instance_id)
         VALUES (?, ?, ?) ON CONFLICT(session_id, entity_id) DO UPDATE SET local_instance_id = excluded.local_instance_id;`,
        [nonEmpty(sessionId, 'sessionId'), nonEmpty(entityId, 'entityId'), assertLocalInstanceId(localInstanceId)]
      );
    },
    async listInstances(sessionId) {
      return await db.getAllAsync(
        `SELECT entity_id AS entityId, local_instance_id AS localInstanceId
           FROM fieldwork_session_instances WHERE session_id = ? ORDER BY entity_id ASC;`,
        [nonEmpty(sessionId, 'sessionId')]
      );
    },
  };
};
