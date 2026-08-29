import test from 'node:test';
import assert from 'node:assert/strict';
import { createFieldworkService } from '../../src/fieldwork/fieldworkService.js';

const project = { projectKey: 'project-1' };
const effectiveCsv = [
  'name,label,__version,site,geometry',
  'plant-1,Plant one,1,A,38.5 -90.5',
  'plant-2,Plant two,1,B,',
].join('\n');

test('fieldwork snapshots M6 effective Entity IDs and derives instance progress', async () => {
  const created = [];
  const sessions = {
    async create(input) { created.push(input); return { ...input, sessionId: input.sessionId }; },
    async get() {
      return {
        ...created[0],
        sessionId: created[0].sessionId,
        currentEntityId: null,
        filters: {}, grouping: {}, sorting: [{ property: 'label', direction: 'asc' }], viewMode: 'list',
      };
    },
    async listInstances() { return [{ entityId: 'plant-1', localInstanceId: 'i-1' }]; },
    async update() {},
    async associateInstance() {},
  };
  const service = createFieldworkService({
    sessions,
    formCatalog: {
      async loadCurrentForm() {
        return {
          version: {
            formVersionId: 'v-1',
            resources: [{ filename: 'plants.csv', isEntityList: true, entityDataset: 'plants' }],
          },
          attachments: [{ filename: 'plants.csv', text: effectiveCsv }],
        };
      },
    },
    instances: { async list() { return [{ localInstanceId: 'i-1', state: 'ready' }]; } },
  });
  const session = await service.start({ project, formId: 'survey', dataset: 'plants' });
  assert.deepEqual(session.targetEntityIds, ['plant-1', 'plant-2']);
  const resolved = await service.get(project, session.sessionId);
  assert.deepEqual(resolved.traversal.entities.map((entity) => [entity.entityId, entity.state]), [
    ['plant-1', 'complete'],
    ['plant-2', 'pending'],
  ]);
});
