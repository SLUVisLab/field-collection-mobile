import test from 'node:test';
import assert from 'node:assert/strict';

import { SYNC_OPERATION_STATES } from 'gather-storage/repositories/sync';
import { createSyncService } from '../../src/sync/syncService.js';

const project = {
  projectKey: 'project-1',
  baseUrl: 'https://central.example',
  centralProjectId: 1,
};

const makeInstances = (initial) => {
  const rows = new Map(initial.map((instance) => [instance.localInstanceId, { ...instance }]));
  const clone = (row) => (row ? { ...row } : null);
  return {
    rows,
    async get(localInstanceId) {
      return clone(rows.get(localInstanceId));
    },
    async list(projectKey) {
      return [...rows.values()]
        .filter((instance) => instance.projectKey === projectKey)
        .map(clone);
    },
  };
};

const makeSync = () => {
  const operations = new Map();
  const dependencies = new Map();
  const calls = [];
  const clone = (operation) => (operation ? { ...operation } : null);
  return {
    operations,
    dependencies,
    calls,
    async getSubmissionOperation({ projectKey, localInstanceId }) {
      return (
        [...operations.values()].find(
          (operation) =>
            operation.projectKey === projectKey &&
            operation.kind === 'submission' &&
            operation.localInstanceId === localInstanceId
        ) ?? null
      );
    },
    async ensureSubmissionOperation({ operationId, projectKey, localInstanceId, initialState }) {
      const existing = await this.getSubmissionOperation({ projectKey, localInstanceId });
      if (existing) return clone(existing);
      const operation = {
        operationId,
        projectKey,
        kind: 'submission',
        localInstanceId,
        state: initialState,
        attemptCount: 0,
        createdAt: operationId,
        lastErrorCode: null,
        lastErrorSummary: null,
      };
      operations.set(operationId, operation);
      calls.push(['ensure', operationId]);
      return clone(operation);
    },
    async addDependency({ operationId, dependsOnOperationId }) {
      dependencies.set(`${operationId}:${dependsOnOperationId}`, {
        operationId,
        dependsOnOperationId,
      });
    },
    async listOperations(projectKey) {
      return [...operations.values()]
        .filter((operation) => operation.projectKey === projectKey)
        .map(clone);
    },
    async listDependencies() {
      return [...dependencies.values()].map((dependency) => ({ ...dependency }));
    },
    async markAttempting(operationId) {
      const operation = operations.get(operationId);
      operation.state = SYNC_OPERATION_STATES.ATTEMPTING;
      operation.attemptCount += 1;
      calls.push(['attempting', operationId]);
      return clone(operation);
    },
    async markRetryable({ operationId, lastErrorCode, lastErrorSummary }) {
      const operation = operations.get(operationId);
      operation.state = SYNC_OPERATION_STATES.RETRYABLE;
      operation.lastErrorCode = lastErrorCode;
      operation.lastErrorSummary = lastErrorSummary;
      calls.push(['retryable', operationId]);
      return clone(operation);
    },
    async markBlocked({ operationId, lastErrorCode, lastErrorSummary }) {
      const operation = operations.get(operationId);
      if (!operation || ![SYNC_OPERATION_STATES.PENDING, SYNC_OPERATION_STATES.RETRYABLE].includes(operation.state)) {
        throw new Error('invalid blocked transition');
      }
      operation.state = SYNC_OPERATION_STATES.BLOCKED;
      operation.lastErrorCode = lastErrorCode;
      operation.lastErrorSummary = lastErrorSummary;
      calls.push(['blocked', operationId]);
      return clone(operation);
    },
    async markComplete(operationId) {
      const operation = operations.get(operationId);
      operation.state = SYNC_OPERATION_STATES.COMPLETE;
      operation.lastErrorCode = operation.lastErrorSummary = null;
      calls.push(['complete', operationId]);
      return clone(operation);
    },
    async recoverAttempting(projectKey) {
      let recovered = 0;
      for (const operation of operations.values()) {
        if (operation.projectKey === projectKey && operation.state === SYNC_OPERATION_STATES.ATTEMPTING) {
          operation.state = SYNC_OPERATION_STATES.RETRYABLE;
          operation.lastErrorCode = 'GATHER_SYNC_ATTEMPT_INTERRUPTED';
          operation.lastErrorSummary =
            'A previous foreground sync was interrupted before its result was saved. Try syncing again.';
          recovered += 1;
        }
      }
      return recovered;
    },
  };
};

const makeEntities = (effectsByInstance = {}) => ({
  calls: [],
  async listEffectsForInstance(localInstanceId) {
    this.calls.push(localInstanceId);
    return (effectsByInstance[localInstanceId] ?? []).map((effect) => ({
      ...effect,
      properties: { ...(effect.properties ?? {}) },
    }));
  },
});

const ready = (localInstanceId) => ({
  localInstanceId,
  projectKey: 'project-1',
  state: 'ready',
  sendError: null,
});

test('reconciliation repairs a ready instance, completes a sent instance, and recovers interrupted attempts', async () => {
  const instances = makeInstances([
    ready('i-ready'),
    { ...ready('i-sent'), state: 'sent' },
    ready('i-interrupted'),
  ]);
  const sync = makeSync();
  sync.operations.set('s-interrupted', {
    operationId: 's-interrupted',
    projectKey: 'project-1',
    kind: 'submission',
    localInstanceId: 'i-interrupted',
    state: SYNC_OPERATION_STATES.ATTEMPTING,
    attemptCount: 1,
    createdAt: 's-interrupted',
  });
  let next = 0;
  const service = createSyncService({
    instances,
    sync,
    entities: makeEntities(),
    instanceLifecycle: { send: async () => assert.fail('reconciliation does not send') },
    newOperationId: () => `s-${++next}`,
  });

  const result = await service.reconcile(project);
  assert.equal(result.repairedReadyCount, 1);
  assert.equal(result.recoveredAttemptCount, 1);
  assert.equal(
    (await sync.getSubmissionOperation({ projectKey: 'project-1', localInstanceId: 'i-ready' })).state,
    SYNC_OPERATION_STATES.PENDING
  );
  assert.equal(
    (await sync.getSubmissionOperation({ projectKey: 'project-1', localInstanceId: 'i-sent' })).state,
    SYNC_OPERATION_STATES.COMPLETE
  );
  assert.equal(sync.operations.get('s-interrupted').state, SYNC_OPERATION_STATES.RETRYABLE);
});

test('an explicit individual send records durable attempt intent before the existing submit path', async () => {
  const instances = makeInstances([ready('i-1')]);
  const sync = makeSync();
  const sendCalls = [];
  const service = createSyncService({
    instances,
    sync,
    entities: makeEntities(),
    instanceLifecycle: {
      async send({ localInstanceId }) {
        sendCalls.push(localInstanceId);
        const instance = instances.rows.get(localInstanceId);
        instance.state = 'sent';
        return { ok: true, instance: { ...instance } };
      },
    },
    newOperationId: () => 's-1',
  });

  const result = await service.sendInstance({ localInstanceId: 'i-1', project });
  assert.equal(result.ok, true);
  assert.deepEqual(sendCalls, ['i-1']);
  assert.deepEqual(
    sync.calls.map(([state]) => state),
    ['ensure', 'attempting', 'complete']
  );
  assert.equal(result.operation.state, SYNC_OPERATION_STATES.COMPLETE);
});

test('sync all observes dependencies in submission order', async () => {
  const instances = makeInstances([ready('i-create'), ready('i-update')]);
  const sync = makeSync();
  const sent = [];
  let next = 0;
  const service = createSyncService({
    instances,
    sync,
    entities: makeEntities(),
    instanceLifecycle: {
      async send({ localInstanceId }) {
        sent.push(localInstanceId);
        const instance = instances.rows.get(localInstanceId);
        instance.state = 'sent';
        return { ok: true, instance: { ...instance } };
      },
    },
    newOperationId: () => `s-${++next}`,
  });

  await service.reconcile(project);
  const createOperation = await sync.getSubmissionOperation({
    projectKey: 'project-1',
    localInstanceId: 'i-create',
  });
  const updateOperation = await sync.getSubmissionOperation({
    projectKey: 'project-1',
    localInstanceId: 'i-update',
  });
  sync.dependencies.set('update:create', {
    operationId: updateOperation.operationId,
    dependsOnOperationId: createOperation.operationId,
  });

  const results = await service.syncAll(project);
  assert.deepEqual(sent, ['i-create', 'i-update']);
  assert.equal(results.every((result) => result.ok), true);
});

const entityEffect = ({ action, entityId, branchId, dataset = 'plants', baseVersion = null }) => ({
  projectKey: 'project-1',
  action,
  dataset,
  entityId,
  branchId,
  baseVersion,
  properties: {},
});

test('Entity update dependencies use every exact stored effect instead of FIFO submission order', async () => {
  const instances = makeInstances([
    ready('i-create-other'),
    ready('i-create-target'),
    ready('i-observation'),
  ]);
  const sync = makeSync();
  const entities = makeEntities({
    'i-create-other': [entityEffect({ action: 'create', entityId: 'other', branchId: 'branch-other' })],
    'i-create-target': [entityEffect({ action: 'create', entityId: 'target', branchId: 'branch-target' })],
    'i-observation': [
      entityEffect({ action: 'update', entityId: 'other', branchId: 'branch-other' }),
      entityEffect({ action: 'update', entityId: 'target', branchId: 'branch-target' }),
    ],
  });
  const sent = [];
  const operationIds = ['s-other', 's-target', 's-observation'];
  const service = createSyncService({
    instances,
    sync,
    entities,
    instanceLifecycle: {
      async send({ localInstanceId }) {
        sent.push(localInstanceId);
        const instance = instances.rows.get(localInstanceId);
        instance.state = 'sent';
        return { ok: true, instance: { ...instance } };
      },
    },
    newOperationId: () => operationIds.shift(),
  });

  await service.reconcile(project);
  const byInstance = async (localInstanceId) =>
    sync.getSubmissionOperation({ projectKey: project.projectKey, localInstanceId });
  const [otherCreate, targetCreate, observation] = await Promise.all([
    byInstance('i-create-other'),
    byInstance('i-create-target'),
    byInstance('i-observation'),
  ]);

  assert.deepEqual(await sync.listDependencies(project.projectKey), [
    { operationId: observation.operationId, dependsOnOperationId: otherCreate.operationId },
    { operationId: observation.operationId, dependsOnOperationId: targetCreate.operationId },
  ]);
  const results = await service.syncAll(project);
  assert.equal(results.every((result) => result.ok), true);
  assert.deepEqual(sent, ['i-create-other', 'i-create-target', 'i-observation']);
});

test('Entity version effects add exact update dependencies instead of relying on operation FIFO order', async () => {
  const instances = makeInstances([ready('i-create'), ready('i-update-second'), ready('i-update-first')]);
  const sync = makeSync();
  const entities = makeEntities({
    'i-create': [entityEffect({ action: 'create', entityId: 'target', branchId: 'branch-target' })],
    'i-update-first': [
      entityEffect({ action: 'update', entityId: 'target', branchId: 'branch-target', baseVersion: '1' }),
    ],
    'i-update-second': [
      entityEffect({ action: 'update', entityId: 'target', branchId: 'branch-target', baseVersion: '2' }),
    ],
  });
  const sent = [];
  const operationIds = ['s-create', 's-a-second', 's-z-first'];
  const service = createSyncService({
    instances,
    sync,
    entities,
    instanceLifecycle: {
      async send({ localInstanceId }) {
        sent.push(localInstanceId);
        const instance = instances.rows.get(localInstanceId);
        instance.state = 'sent';
        return { ok: true, instance: { ...instance } };
      },
    },
    newOperationId: () => operationIds.shift(),
  });

  const results = await service.syncAll(project);
  assert.equal(results.every((result) => result.ok), true);
  assert.deepEqual(
    sent,
    ['i-create', 'i-update-first', 'i-update-second'],
    'the later version waits for its exact version producer despite its earlier operation ID'
  );
});

test('syncAll continues independent work and reports an update waiting on a retryable local create', async () => {
  const instances = makeInstances([ready('i-create'), ready('i-observation'), ready('i-independent')]);
  const sync = makeSync();
  const entities = makeEntities({
    'i-create': [entityEffect({ action: 'create', entityId: 'target', branchId: 'branch-target' })],
    'i-observation': [entityEffect({ action: 'update', entityId: 'target', branchId: 'branch-target' })],
  });
  const sent = [];
  const operationIds = ['s-create', 's-observation', 's-independent'];
  const service = createSyncService({
    instances,
    sync,
    entities,
    instanceLifecycle: {
      async send({ localInstanceId }) {
        sent.push(localInstanceId);
        if (localInstanceId === 'i-create') {
          return { ok: false, instance: await instances.get(localInstanceId) };
        }
        const instance = instances.rows.get(localInstanceId);
        instance.state = 'sent';
        return { ok: true, instance: { ...instance } };
      },
    },
    newOperationId: () => operationIds.shift(),
  });

  const results = await service.syncAll(project);
  assert.deepEqual(sent, ['i-create', 'i-independent']);
  assert.equal(results.filter((result) => result.ok).length, 1);
  const waiting = results.find((result) => result.operation?.localInstanceId === 'i-observation');
  assert.equal(waiting?.outcome, 'waiting');
  assert.equal(
    (await sync.getSubmissionOperation({ projectKey: project.projectKey, localInstanceId: 'i-observation' })).state,
    SYNC_OPERATION_STATES.PENDING
  );
  assert.equal(
    (await sync.getSubmissionOperation({ projectKey: project.projectKey, localInstanceId: 'i-create' })).state,
    SYNC_OPERATION_STATES.RETRYABLE
  );
});

test('syncAll marks circular journal dependencies blocked instead of silently succeeding', async () => {
  const instances = makeInstances([ready('i-one'), ready('i-two')]);
  const sync = makeSync();
  const service = createSyncService({
    instances,
    sync,
    entities: makeEntities(),
    instanceLifecycle: { send: async () => assert.fail('a cyclic operation must not send') },
    newOperationId: (() => {
      let index = 0;
      return () => `s-${++index}`;
    })(),
  });

  await service.reconcile(project);
  const one = await sync.getSubmissionOperation({ projectKey: project.projectKey, localInstanceId: 'i-one' });
  const two = await sync.getSubmissionOperation({ projectKey: project.projectKey, localInstanceId: 'i-two' });
  sync.dependencies.set('one:two', {
    operationId: one.operationId,
    dependsOnOperationId: two.operationId,
  });
  sync.dependencies.set('two:one', {
    operationId: two.operationId,
    dependsOnOperationId: one.operationId,
  });

  const results = await service.syncAll(project);
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => [result.outcome, result.code]),
    [
      ['blocked', 'GATHER_SYNC_DEPENDENCY_CYCLE'],
      ['blocked', 'GATHER_SYNC_DEPENDENCY_CYCLE'],
    ]
  );
  assert.equal(
    (await sync.getSubmissionOperation({ projectKey: project.projectKey, localInstanceId: 'i-one' })).state,
    SYNC_OPERATION_STATES.BLOCKED
  );
  assert.equal((await service.getStatus(project)).blocked, 2);
});
