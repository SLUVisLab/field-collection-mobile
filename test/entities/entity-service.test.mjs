import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCsv } from 'gather-storage/csv';
import { createEntityService, EntityServiceError } from '../../src/entities/entityService.js';

const makeRepository = () => {
  const branches = new Map();
  const batches = new Map();
  const effects = [];
  let nextEffectId = 1;
  const keyFor = (projectKey, dataset, entityId) => `${projectKey}\u0000${dataset}\u0000${entityId}`;
  return {
    branches,
    batches,
    effects,
    async ensureBranches({ projectKey, dataset, branches: requested }) {
      const result = new Map();
      for (const { entityId, branchId } of requested) {
        const key = keyFor(projectKey, dataset, entityId);
        if (!branches.has(key)) branches.set(key, branchId);
        result.set(entityId, branches.get(key));
      }
      return result;
    },
    async listEffects({ projectKey, dataset }) {
      return effects
        .filter((effect) => effect.projectKey === projectKey && effect.dataset === dataset)
        .sort((left, right) => left.effectId - right.effectId)
        .map((effect) => ({ ...effect, properties: { ...effect.properties } }));
    },
    async recordFinalizedEffects({ projectKey, localInstanceId, effects: incoming }) {
      const canonical = JSON.stringify(incoming);
      const existing = batches.get(localInstanceId);
      if (existing) {
        if (existing !== canonical) throw new Error('conflicting finalized batch');
        return effects.filter((effect) => effect.localInstanceId === localInstanceId);
      }
      batches.set(localInstanceId, canonical);
      for (const effect of incoming) {
        effects.push({
          ...effect,
          effectId: nextEffectId++,
          projectKey,
          localInstanceId,
        });
      }
      return effects.filter((effect) => effect.localInstanceId === localInstanceId);
    },
  };
};

const effect = ({
  dataset = 'people',
  action,
  entityId,
  label,
  properties,
  baseVersion = null,
  trunkVersion = null,
  branchId = null,
}) => ({
  reference: `/data/meta/entity[${entityId}]`,
  dataset,
  action,
  entityId,
  label,
  properties,
  baseVersion,
  trunkVersion,
  branchId,
});

test('Entity overlay matches Collect create/update version, trunk, and branch evolution across restart', async () => {
  const repository = makeRepository();
  const branchIds = ['server-branch', 'created-branch'];
  const service = createEntityService({
    entities: repository,
    newBranchId: () => branchIds.shift() ?? 'unused-branch',
  });
  const source = 'name,label,__version,full_name,unmodeled_note\r\nS,Server-0,7,Server-0,"keep, this"\r\n';

  const initial = parseCsv(await service.materializeCsv({ projectKey: 'project-1', dataset: 'people', sourceCsv: source }));
  assert.deepEqual(initial, [
    ['name', 'label', '__version', '__trunkVersion', '__branchId', 'full_name', 'unmodeled_note'],
    ['S', 'Server-0', '7', '7', 'server-branch', 'Server-0', 'keep, this'],
  ]);

  await service.recordFinalizedEffects({
    projectKey: 'project-1',
    localInstanceId: 'i-create',
    effects: [effect({ action: 'create', entityId: 'C', label: 'Created-0', properties: { full_name: 'Created-0' } })],
  });
  await service.recordFinalizedEffects({
    projectKey: 'project-1',
    localInstanceId: 'i-update-created-1',
    effects: [
      effect({
        action: 'update',
        entityId: 'C',
        label: 'Created-1',
        properties: { full_name: 'Created-1' },
        baseVersion: '1',
        trunkVersion: '',
        branchId: 'created-branch',
      }),
    ],
  });
  await service.recordFinalizedEffects({
    projectKey: 'project-1',
    localInstanceId: 'i-update-server-1',
    effects: [
      effect({
        action: 'update',
        entityId: 'S',
        label: 'Server-1',
        properties: { full_name: 'Server-1' },
        baseVersion: '7',
        trunkVersion: '7',
        branchId: 'server-branch',
      }),
    ],
  });

  const afterFirstUpdates = parseCsv(
    await service.materializeCsv({ projectKey: 'project-1', dataset: 'people', sourceCsv: source })
  );
  assert.deepEqual(afterFirstUpdates, [
    ['name', 'label', '__version', '__trunkVersion', '__branchId', 'full_name', 'unmodeled_note'],
    ['S', 'Server-1', '8', '7', 'server-branch', 'Server-1', 'keep, this'],
    ['C', 'Created-1', '2', '', 'created-branch', 'Created-1', ''],
  ]);

  await service.recordFinalizedEffects({
    projectKey: 'project-1',
    localInstanceId: 'i-update-created-2',
    effects: [
      effect({
        action: 'update',
        entityId: 'C',
        label: 'Created-2',
        properties: { full_name: 'Created-2' },
        baseVersion: '2',
        trunkVersion: '',
        branchId: 'created-branch',
      }),
    ],
  });
  await service.recordFinalizedEffects({
    projectKey: 'project-1',
    localInstanceId: 'i-update-server-2',
    effects: [
      effect({
        action: 'update',
        entityId: 'S',
        label: 'Server-2',
        properties: { full_name: 'Server-2' },
        baseVersion: '8',
        trunkVersion: '7',
        branchId: 'server-branch',
      }),
    ],
  });

  const restarted = createEntityService({
    entities: repository,
    newBranchId: () => 'discarded-because-persisted-branch-wins',
  });
  const afterRestart = parseCsv(
    await restarted.materializeCsv({ projectKey: 'project-1', dataset: 'people', sourceCsv: source })
  );
  assert.deepEqual(afterRestart, [
    ['name', 'label', '__version', '__trunkVersion', '__branchId', 'full_name', 'unmodeled_note'],
    ['S', 'Server-2', '9', '7', 'server-branch', 'Server-2', 'keep, this'],
    ['C', 'Created-2', '3', '', 'created-branch', 'Created-2', ''],
  ]);
  assert.equal(source, 'name,label,__version,full_name,unmodeled_note\r\nS,Server-0,7,Server-0,"keep, this"\r\n');
});

test('Entity service rejects system-column effects and does not infer a property schema from XForms', async () => {
  const service = createEntityService({
    entities: makeRepository(),
    newBranchId: () => 'branch-1',
  });
  await assert.rejects(
    service.recordFinalizedEffects({
      projectKey: 'project-1',
      localInstanceId: 'i-1',
      effects: [effect({ action: 'create', entityId: 'C', label: 'Created', properties: { __version: '9' } })],
    }),
    (error) => error instanceof EntityServiceError && error.code === 'GATHER_ENTITIES_EFFECT'
  );
});

test('Entity datasets remain isolated even when their Entity IDs and property names match', async () => {
  const repository = makeRepository();
  let branchNumber = 0;
  const service = createEntityService({
    entities: repository,
    newBranchId: () => `branch-${++branchNumber}`,
  });
  await service.recordFinalizedEffects({
    projectKey: 'project-1',
    localInstanceId: 'i-alpha',
    effects: [effect({ dataset: 'alpha', action: 'create', entityId: 'same-id', label: 'Alpha', properties: { value: 'A' } })],
  });
  await service.recordFinalizedEffects({
    projectKey: 'project-1',
    localInstanceId: 'i-beta',
    effects: [effect({ dataset: 'beta', action: 'create', entityId: 'same-id', label: 'Beta', properties: { value: 'B' } })],
  });

  const alpha = parseCsv(
    await service.materializeCsv({ projectKey: 'project-1', dataset: 'alpha', sourceCsv: 'name,label,__version\n' })
  );
  const beta = parseCsv(
    await service.materializeCsv({ projectKey: 'project-1', dataset: 'beta', sourceCsv: 'name,label,__version\n' })
  );
  assert.equal(alpha[1][1], 'Alpha');
  assert.equal(alpha[1][4], 'branch-1');
  assert.equal(beta[1][1], 'Beta');
  assert.equal(beta[1][4], 'branch-2');
});

test('only manifest-mapped Entity List attachments are synthesized in memory', async () => {
  const service = createEntityService({
    entities: makeRepository(),
    newBranchId: () => 'server-branch',
  });
  const attachments = [
    { filename: 'people.csv', contentType: 'text/csv', text: 'name,label,__version\nS,Server,7\n' },
    { filename: 'photo.jpg', contentType: 'image/jpeg', base64: 'AAE=' },
  ];
  const synthesized = await service.synthesizeAttachments({
    projectKey: 'project-1',
    resources: [
      { filename: 'people.csv', isEntityList: true, entityDataset: 'people' },
      { filename: 'photo.jpg', isEntityList: false },
    ],
    attachments,
  });
  assert.match(synthesized[0].text, /__trunkVersion/);
  assert.deepEqual(synthesized[1], attachments[1]);
  assert.equal(attachments[0].text, 'name,label,__version\nS,Server,7\n');
});
