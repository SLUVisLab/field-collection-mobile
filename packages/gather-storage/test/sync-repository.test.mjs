import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSyncRepository,
  SYNC_OPERATION_STATES,
} from '../src/repositories/sync.js';

const operationRow = ({ operationId, projectKey, localInstanceId, state }) => ({
  operation_id: operationId,
  project_key: projectKey,
  kind: 'submission',
  local_instance_id: localInstanceId,
  state,
  attempt_count: 0,
  last_attempt_at: null,
  last_error_code: null,
  last_error_summary: null,
  created_at: 'created',
  updated_at: 'created',
});

const makeFakeDb = (instances = []) => {
  const instanceRows = new Map(instances.map((instance) => [instance.local_instance_id, { ...instance }]));
  const operations = new Map();
  const dependencies = new Map();
  const clone = (row) => (row ? { ...row } : null);

  return {
    operations,
    dependencies,
    async getFirstAsync(sql, params = []) {
      if (sql.includes('WHERE operation_id = ?')) return clone(operations.get(params[0]));
      if (sql.includes("kind = 'submission'")) {
        return (
          [...operations.values()]
            .find(
              (row) =>
                row.project_key === params[0] &&
                row.kind === 'submission' &&
                row.local_instance_id === params[1]
            ) ?? null
        );
      }
      throw new Error(`unexpected getFirstAsync SQL: ${sql}`);
    },
    async getAllAsync(sql, [projectKey]) {
      if (sql.includes('FROM sync_dependencies')) {
        return [...dependencies.values()]
          .filter((dependency) => operations.get(dependency.operation_id)?.project_key === projectKey)
          .map(clone);
      }
      if (sql.includes('FROM sync_operations')) {
        return [...operations.values()]
          .filter((operation) => operation.project_key === projectKey)
          .sort((left, right) => left.operation_id.localeCompare(right.operation_id))
          .map(clone);
      }
      throw new Error(`unexpected getAllAsync SQL: ${sql}`);
    },
    async runAsync(sql, params = []) {
      if (sql.includes('INSERT INTO sync_operations')) {
        const [operationId, projectKey, state, localInstanceId] = params;
        const instance = instanceRows.get(localInstanceId);
        const existing = [...operations.values()].find(
          (row) =>
            row.project_key === projectKey &&
            row.kind === 'submission' &&
            row.local_instance_id === localInstanceId
        );
        if (
          instance &&
          instance.project_key === projectKey &&
          ['ready', 'sent'].includes(instance.state) &&
          !existing
        ) {
          operations.set(
            operationId,
            operationRow({ operationId, projectKey, localInstanceId, state })
          );
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('INSERT OR IGNORE INTO sync_dependencies')) {
        const [operationId, dependsOnOperationId] = params;
        dependencies.set(`${operationId}:${dependsOnOperationId}`, {
          operation_id: operationId,
          depends_on_operation_id: dependsOnOperationId,
        });
        return { changes: 1 };
      }
      if (sql.includes("SET state = 'attempting'")) {
        const row = operations.get(params[0]);
        if (row && ['pending', 'retryable'].includes(row.state)) {
          row.state = 'attempting';
          row.attempt_count += 1;
          row.last_attempt_at = row.updated_at = 'attempting';
          row.last_error_code = row.last_error_summary = null;
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes("SET state = 'retryable'") && sql.includes('WHERE operation_id')) {
        const [code, summary, operationId] = params;
        const row = operations.get(operationId);
        if (row?.state === 'attempting') {
          row.state = 'retryable';
          row.last_error_code = code;
          row.last_error_summary = summary;
          row.updated_at = 'retryable';
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes("SET state = 'blocked'")) {
        const [code, summary, operationId] = params;
        const row = operations.get(operationId);
        if (row && ['pending', 'retryable'].includes(row.state)) {
          row.state = 'blocked';
          row.last_error_code = code;
          row.last_error_summary = summary;
          row.updated_at = 'blocked';
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes("SET state = 'complete'")) {
        const row = operations.get(params[0]);
        if (row && row.state !== 'complete') {
          row.state = 'complete';
          row.last_error_code = row.last_error_summary = null;
          row.updated_at = 'complete';
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes("SET state = 'retryable'") && sql.includes('project_key = ?')) {
        const row = [...operations.values()].find(
          (operation) => operation.project_key === params[0] && operation.state === 'attempting'
        );
        if (row) {
          row.state = 'retryable';
          row.last_error_code = 'GATHER_SYNC_ATTEMPT_INTERRUPTED';
          row.last_error_summary =
            'A previous foreground sync was interrupted before its result was saved. Try syncing again.';
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      throw new Error(`unexpected runAsync SQL: ${sql}`);
    },
  };
};

const readyInstances = [
  { local_instance_id: 'i-1', project_key: 'project-1', state: 'ready' },
  { local_instance_id: 'i-2', project_key: 'project-1', state: 'ready' },
];

test('ready instances get one durable pending submission operation across repeated enqueue and restart', async () => {
  const db = makeFakeDb(readyInstances);
  const repo = createSyncRepository(db);

  const first = await repo.ensureSubmissionOperation({
    operationId: 's-1',
    projectKey: 'project-1',
    localInstanceId: 'i-1',
  });
  const repeated = await repo.ensureSubmissionOperation({
    operationId: 's-ignored',
    projectKey: 'project-1',
    localInstanceId: 'i-1',
  });

  assert.equal(first.state, SYNC_OPERATION_STATES.PENDING);
  assert.equal(repeated.operationId, 's-1');
  assert.equal(db.operations.size, 1, 'the ready instance has exactly one operation');

  const afterRestart = createSyncRepository(db);
  assert.deepEqual(await afterRestart.listOperations('project-1'), [first]);
});

test('dependency rows survive restart and state metadata is credential-safe', async () => {
  const db = makeFakeDb(readyInstances);
  const repo = createSyncRepository(db);
  await repo.ensureSubmissionOperation({
    operationId: 's-create',
    projectKey: 'project-1',
    localInstanceId: 'i-1',
  });
  await repo.ensureSubmissionOperation({
    operationId: 's-update',
    projectKey: 'project-1',
    localInstanceId: 'i-2',
  });
  await repo.addDependency({ operationId: 's-update', dependsOnOperationId: 's-create' });

  await repo.markAttempting('s-create');
  const retryable = await repo.markRetryable({
    operationId: 's-create',
    lastErrorCode: 'GATHER_SYNC_SUBMISSION_FAILED',
    lastErrorSummary:
      'POST https://central.example/key/app-user-secret/submission?token=query-secret Authorization: Bearer bearer-secret',
  });

  const afterRestart = createSyncRepository(db);
  assert.deepEqual(await afterRestart.listDependencies('project-1'), [
    { operationId: 's-update', dependsOnOperationId: 's-create' },
  ]);
  assert.equal(retryable.state, SYNC_OPERATION_STATES.RETRYABLE);
  const sqliteText = JSON.stringify([...db.operations.values(), ...db.dependencies.values()]);
  assert.doesNotMatch(sqliteText, /app-user-secret|query-secret|bearer-secret/);
  assert.match(sqliteText, /<redacted>/);
});
