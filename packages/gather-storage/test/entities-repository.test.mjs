import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEntitiesRepository,
  EntitiesRepositoryError,
} from '../src/repositories/entities.js';

const makeFakeDb = () => {
  const branches = new Map();
  const batches = new Map();
  const effects = [];
  let nextEffectId = 1;
  return {
    branches,
    batches,
    effects,
    async getFirstAsync(sql, params) {
      if (sql.includes('entity_effect_batches')) {
        const batch = batches.get(params[0]);
        return batch ? { ...batch } : null;
      }
      if (sql.includes('entity_branches')) {
        const row = branches.get(params.join('\u0000'));
        return row ? { ...row } : null;
      }
      throw new Error(`unexpected getFirst SQL: ${sql}`);
    },
    async getAllAsync(sql, params) {
      if (sql.includes('dataset_name = ?')) {
        return effects
          .filter((effect) => effect.project_key === params[0] && effect.dataset_name === params[1])
          .sort((left, right) => left.effect_id - right.effect_id)
          .map((effect) => ({ ...effect }));
      }
      if (sql.includes('local_instance_id = ?')) {
        return effects
          .filter((effect) => effect.local_instance_id === params[0])
          .sort((left, right) => left.effect_index - right.effect_index)
          .map((effect) => ({ ...effect }));
      }
      throw new Error(`unexpected getAll SQL: ${sql}`);
    },
    async runAsync(sql, params) {
      if (sql.includes('INSERT INTO entity_branches')) {
        const [projectKey, dataset, entityId, branchId] = params;
        const key = [projectKey, dataset, entityId].join('\u0000');
        if (!branches.has(key)) branches.set(key, { branch_id: branchId });
        return { changes: 1 };
      }
      if (sql.includes('INSERT INTO entity_effect_batches')) {
        const [localInstanceId, projectKey, effectsJson] = params;
        batches.set(localInstanceId, { project_key: projectKey, effects_json: effectsJson });
        return { changes: 1 };
      }
      if (sql.includes('INSERT INTO entity_effects')) {
        const [
          localInstanceId,
          projectKey,
          effectIndex,
          reference,
          dataset,
          action,
          entityId,
          label,
          propertiesJson,
          baseVersion,
          trunkVersion,
          branchId,
        ] = params;
        effects.push({
          effect_id: nextEffectId++,
          local_instance_id: localInstanceId,
          project_key: projectKey,
          effect_index: effectIndex,
          reference,
          dataset_name: dataset,
          action,
          entity_id: entityId,
          label,
          properties_json: propertiesJson,
          base_version: baseVersion,
          trunk_version: trunkVersion,
          branch_id: branchId,
          created_at: 'now',
        });
        return { changes: 1 };
      }
      throw new Error(`unexpected run SQL: ${sql}`);
    },
    async withTransactionAsync(fn) {
      await fn();
    },
  };
};

const create = {
  reference: '/data/entity',
  dataset: 'people',
  action: 'create',
  entityId: 'created-1',
  label: 'Created',
  properties: { full_name: 'Created Person' },
  baseVersion: null,
  trunkVersion: null,
  branchId: 'branch-created',
};

test('Entity repository retains stable branch IDs and immutable finalized effects', async () => {
  const db = makeFakeDb();
  const repository = createEntitiesRepository(db);
  const firstBranches = await repository.ensureBranches({
    projectKey: 'project-1',
    dataset: 'people',
    branches: [{ entityId: 'server-1', branchId: 'branch-server' }],
  });
  const secondBranches = await repository.ensureBranches({
    projectKey: 'project-1',
    dataset: 'people',
    branches: [{ entityId: 'server-1', branchId: 'new-branch-is-ignored' }],
  });
  assert.equal(firstBranches.get('server-1'), 'branch-server');
  assert.equal(secondBranches.get('server-1'), 'branch-server');

  const stored = await repository.recordFinalizedEffects({
    projectKey: 'project-1',
    localInstanceId: 'i-1',
    effects: [create],
  });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].properties.full_name, 'Created Person');
  assert.equal(stored[0].localInstanceId, 'i-1');
  assert.deepEqual(
    (await repository.listEffects({ projectKey: 'project-1', dataset: 'people' })).map(
      (effect) => effect.entityId
    ),
    ['created-1']
  );
  assert.deepEqual(
    (await repository.listEffectsForInstance('i-1')).map((effect) => effect.entityId),
    ['created-1']
  );

  const retried = await repository.recordFinalizedEffects({
    projectKey: 'project-1',
    localInstanceId: 'i-1',
    effects: [create],
  });
  assert.equal(retried.length, 1, 'identical finalization does not duplicate effects');
  await assert.rejects(
    repository.recordFinalizedEffects({
      projectKey: 'project-1',
      localInstanceId: 'i-1',
      effects: [{ ...create, label: 'Changed after finalization' }],
    }),
    (error) => error instanceof EntitiesRepositoryError && error.code === 'GATHER_ENTITIES_FINALIZATION_CONFLICT'
  );
});
