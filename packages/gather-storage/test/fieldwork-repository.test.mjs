import test from 'node:test';
import assert from 'node:assert/strict';
import { createFieldworkRepository } from '../src/repositories/fieldwork.js';

const db = () => {
  const sessions = new Map();
  const links = new Map();
  return {
    async getFirstAsync(_sql, [id]) { return sessions.get(id) ?? null; },
    async getAllAsync(sql, [value]) {
      if (sql.includes('fieldwork_session_instances')) {
        return [...links.values()].filter((link) => link.sessionId === value).map(({ entityId, localInstanceId }) => ({ entityId, localInstanceId }));
      }
      return [...sessions.values()].filter((session) => session.project_key === value);
    },
    async runAsync(sql, params) {
      if (sql.includes('INSERT INTO fieldwork_sessions')) {
        const [session_id, project_key, form_id, form_version_id, entity_dataset, target_entity_ids_json, current_entity_id, filters_json, grouping_json, sorting_json, view_mode] = params;
        sessions.set(session_id, { session_id, project_key, form_id, form_version_id, entity_dataset, target_entity_ids_json, current_entity_id, filters_json, grouping_json, sorting_json, view_mode, started_at: 'now', completed_at: null });
      } else if (sql.includes('UPDATE fieldwork_sessions')) {
        const [current_entity_id, filters_json, grouping_json, sorting_json, view_mode, completed_at, sessionId] = params;
        Object.assign(sessions.get(sessionId), { current_entity_id, filters_json, grouping_json, sorting_json, view_mode, completed_at });
      } else {
        const [sessionId, entityId, localInstanceId] = params;
        links.set(`${sessionId}:${entityId}`, { sessionId, entityId, localInstanceId });
      }
    },
  };
};

test('fieldwork repository retains only session intent and instance associations', async () => {
  const repository = createFieldworkRepository(db());
  const session = await repository.create({
    sessionId: 'fw-1', projectKey: 'project-1', formId: 'survey', formVersionId: 'version-1',
    entityDataset: 'plants', targetEntityIds: ['plant-2', 'plant-1', 'plant-1'],
    filters: { site: 'A' }, grouping: { property: 'site' }, sorting: [{ property: 'label', direction: 'asc' }],
  });
  assert.deepEqual(session.targetEntityIds, ['plant-2', 'plant-1']);
  await repository.associateInstance({ sessionId: 'fw-1', entityId: 'plant-2', localInstanceId: 'i-1' });
  assert.deepEqual(await repository.listInstances('fw-1'), [{ entityId: 'plant-2', localInstanceId: 'i-1' }]);
  const updated = await repository.update('fw-1', { currentEntityId: 'plant-2', viewMode: 'map' });
  assert.equal(updated.currentEntityId, 'plant-2');
  assert.equal(updated.viewMode, 'map');
  assert.equal((await repository.list('other-project')).length, 0);
  await assert.rejects(repository.update('fw-1', { currentEntityId: 'not-a-target' }));
});
