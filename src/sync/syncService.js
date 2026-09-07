import { SYNC_OPERATION_KINDS, SYNC_OPERATION_STATES } from 'gather-storage/repositories/sync';
import { sanitizeErrorText } from 'gather-storage/sanitize';

import { planRunnableSubmissionOperations } from './syncPlanner.js';

export const SYNC_SERVICE_ERROR_CODES = Object.freeze({
  UNAVAILABLE: 'GATHER_SYNC_UNAVAILABLE',
  INVALID: 'GATHER_SYNC_INVALID',
  NOT_FOUND: 'GATHER_SYNC_NOT_FOUND',
  INVALID_STATE: 'GATHER_SYNC_INVALID_STATE',
  ENTITY_EFFECTS_INVALID: 'GATHER_SYNC_ENTITY_EFFECTS_INVALID',
  ENTITY_CREATE_CONFLICT: 'GATHER_SYNC_ENTITY_CREATE_CONFLICT',
  ENTITY_BRANCH_CONFLICT: 'GATHER_SYNC_ENTITY_BRANCH_CONFLICT',
  ENTITY_VERSION_CONFLICT: 'GATHER_SYNC_ENTITY_VERSION_CONFLICT',
  DEPENDENCY_MISSING: 'GATHER_SYNC_DEPENDENCY_MISSING',
  DEPENDENCY_CYCLE: 'GATHER_SYNC_DEPENDENCY_CYCLE',
  DEPENDENCY_BLOCKED: 'GATHER_SYNC_DEPENDENCY_BLOCKED',
});

export class SyncServiceError extends Error {
  constructor(message, { code = SYNC_SERVICE_ERROR_CODES.INVALID, details = null } = {}) {
    super(message);
    this.name = 'SyncServiceError';
    this.code = code;
    this.details = details;
  }
}

const fail = (message, code, details = null) => {
  throw new SyncServiceError(message, { code, details });
};

const nonEmpty = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${field} must be a non-empty string`, SYNC_SERVICE_ERROR_CODES.INVALID, { field });
  }
  return value;
};

const assertProject = (project) => {
  nonEmpty(project?.projectKey, 'projectKey');
  return project;
};

const defaultNewOperationId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid === 'string') {
    return `s-${uuid.replace(/[^A-Za-z0-9_-]/g, '')}`;
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const isQueued = (operation) =>
  operation?.state === SYNC_OPERATION_STATES.PENDING ||
  operation?.state === SYNC_OPERATION_STATES.RETRYABLE;

const isSubmission = (operation) => operation?.kind === SYNC_OPERATION_KINDS.SUBMISSION;

const entityIdentity = (effect) => JSON.stringify([effect.dataset, effect.entityId, effect.branchId]);
const entityName = (effect) => JSON.stringify([effect.dataset, effect.entityId]);
const entityVersion = (effect, version) =>
  JSON.stringify([effect.dataset, effect.entityId, effect.branchId, version]);

const nextEntityVersion = (version) => {
  if (typeof version !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(version)) return null;
  return (BigInt(version) + 1n).toString();
};

const normalizedEffectIdentity = (effect) => {
  if (
    !effect ||
    (effect.action !== 'create' && effect.action !== 'update') ||
    typeof effect.dataset !== 'string' ||
    effect.dataset.length === 0 ||
    typeof effect.entityId !== 'string' ||
    effect.entityId.length === 0 ||
    typeof effect.branchId !== 'string' ||
    effect.branchId.length === 0
  ) {
    return null;
  }
  return { exact: entityIdentity(effect), name: entityName(effect) };
};

const dependenciesByOperation = (dependencies = []) => {
  const result = new Map();
  for (const dependency of dependencies) {
    const existing = result.get(dependency.operationId) ?? [];
    existing.push(dependency.dependsOnOperationId);
    result.set(dependency.operationId, existing);
  }
  return result;
};

/**
 * Return the queued members of each directed cycle. Complete operations cannot
 * block work, so they intentionally do not participate in cycle detection.
 */
export const findQueuedDependencyCycleOperationIds = (operations = [], dependencies = []) => {
  const queuedIds = new Set(operations.filter(isQueued).map((operation) => operation.operationId));
  const byOperation = dependenciesByOperation(dependencies);
  const colors = new Map();
  const stack = [];
  const cycleIds = new Set();

  const visit = (operationId) => {
    colors.set(operationId, 'visiting');
    stack.push(operationId);
    for (const dependencyId of byOperation.get(operationId) ?? []) {
      if (!queuedIds.has(dependencyId)) continue;
      if (colors.get(dependencyId) === 'visiting') {
        const cycleStart = stack.lastIndexOf(dependencyId);
        for (const id of stack.slice(cycleStart)) cycleIds.add(id);
      } else if (colors.get(dependencyId) == null) {
        visit(dependencyId);
      }
    }
    stack.pop();
    colors.set(operationId, 'done');
  };

  for (const operationId of queuedIds) {
    if (colors.get(operationId) == null) visit(operationId);
  }
  return cycleIds;
};

const assertDependencies = ({ instances, sync, entities, instanceLifecycle, newOperationId }) => {
  if (
    !instances ||
    typeof instances.get !== 'function' ||
    typeof instances.list !== 'function' ||
    !sync ||
    typeof sync.getSubmissionOperation !== 'function' ||
    typeof sync.ensureSubmissionOperation !== 'function' ||
    typeof sync.listOperations !== 'function' ||
    typeof sync.listDependencies !== 'function' ||
    typeof sync.addDependency !== 'function' ||
    typeof sync.markAttempting !== 'function' ||
    typeof sync.markRetryable !== 'function' ||
    typeof sync.markBlocked !== 'function' ||
    typeof sync.markComplete !== 'function' ||
    typeof sync.recoverAttempting !== 'function' ||
    !entities ||
    typeof entities.listEffectsForInstance !== 'function' ||
    !instanceLifecycle ||
    typeof instanceLifecycle.send !== 'function' ||
    typeof newOperationId !== 'function'
  ) {
    fail('Submission sync is not available yet.', SYNC_SERVICE_ERROR_CODES.UNAVAILABLE);
  }
};

/**
 * Coordinates durable operation state around the pre-existing low-level
 * foreground OpenRosa submit. It never starts network work except from an
 * explicit send request.
 */
export const createSyncService = ({
  instances,
  sync,
  entities,
  instanceLifecycle,
  newOperationId = defaultNewOperationId,
} = {}) => {
  assertDependencies({ instances, sync, entities, instanceLifecycle, newOperationId });

  const getOwnedInstance = async (localInstanceId, project) => {
    const instance = await instances.get(nonEmpty(localInstanceId, 'localInstanceId'));
    if (!instance || instance.projectKey !== project.projectKey) {
      fail('This saved instance no longer exists.', SYNC_SERVICE_ERROR_CODES.NOT_FOUND, {
        localInstanceId,
      });
    }
    return instance;
  };

  const ensureForInstance = async (instance, project) => {
    if (instance.state !== 'ready' && instance.state !== 'sent') {
      fail('Only ready or sent instances have submission sync operations.', SYNC_SERVICE_ERROR_CODES.INVALID_STATE, {
        localInstanceId: instance.localInstanceId,
        state: instance.state,
      });
    }
    return sync.ensureSubmissionOperation({
      operationId: nonEmpty(newOperationId(), 'operationId'),
      projectKey: project.projectKey,
      localInstanceId: instance.localInstanceId,
      initialState:
        instance.state === 'sent'
          ? SYNC_OPERATION_STATES.COMPLETE
          : SYNC_OPERATION_STATES.PENDING,
    });
  };

  const readPlan = async (project) =>
    planRunnableSubmissionOperations(
      await sync.listOperations(project.projectKey),
      await sync.listDependencies(project.projectKey)
    );

  const unresolvedResult = async ({ operation, project }) => {
    const instance = await instances.get(operation.localInstanceId);
    const blocked = operation.state === SYNC_OPERATION_STATES.BLOCKED;
    const waitingOn = (await sync.listDependencies(project.projectKey))
      .filter((dependency) => dependency.operationId === operation.operationId)
      .map((dependency) => dependency.dependsOnOperationId);
    return {
      ok: false,
      outcome: blocked ? 'blocked' : 'waiting',
      code: operation.lastErrorCode ?? null,
      instance: instance ?? null,
      operation,
      message: blocked
        ? operation.lastErrorSummary ?? 'This submission is blocked and needs attention.'
        : waitingOn.length > 0
          ? 'This submission is waiting for its Entity dependency to complete.'
          : 'This submission is not ready to synchronize.',
    };
  };

  /**
   * Derive only positive, exact Entity dependency matches. In particular, an
   * update is never ordered behind an older or earlier-created operation unless
   * its persisted dataset/entity/branch identity matches a persisted local
   * create effect.
   */
  const reconcileEntityDependencies = async (project) => {
    let operations = await sync.listOperations(project.projectKey);
    const issues = [];
    const issueKeys = new Set();
    const block = async (operation, code, summary) => {
      const key = `${operation.operationId}\u0000${code}`;
      if (!issueKeys.has(key)) {
        issueKeys.add(key);
        issues.push({ operationId: operation.operationId, code, summary });
      }
      if (!isQueued(operation)) return operation;
      const blocked = await sync.markBlocked({
        operationId: operation.operationId,
        lastErrorCode: code,
        lastErrorSummary: summary,
      });
      operations = operations.map((candidate) =>
        candidate.operationId === blocked.operationId ? blocked : candidate
      );
      return blocked;
    };

    const effectsByOperation = new Map();
    for (const operation of operations.filter(isSubmission)) {
      try {
        const stored = await entities.listEffectsForInstance(operation.localInstanceId);
        if (!Array.isArray(stored)) throw new Error('Stored Entity effects are not an array.');
        const effects = [];
        for (const effect of stored) {
          if (effect?.projectKey != null && effect.projectKey !== project.projectKey) {
            throw new Error('Stored Entity effects belong to another project.');
          }
          const identity = normalizedEffectIdentity(effect);
          if (!identity) throw new Error('Stored Entity effect identity is invalid.');
          effects.push({ effect, ...identity });
        }
        effectsByOperation.set(operation.operationId, effects);
      } catch (error) {
        await block(
          operation,
          SYNC_SERVICE_ERROR_CODES.ENTITY_EFFECTS_INVALID,
          sanitizeErrorText(error, 'Stored Entity effects are invalid.')
        );
      }
    }

    const createsByIdentity = new Map();
    const createsByName = new Map();
    for (const operation of operations.filter(isSubmission)) {
      for (const entry of effectsByOperation.get(operation.operationId) ?? []) {
        if (entry.effect.action !== 'create') continue;
        const exact = createsByIdentity.get(entry.exact) ?? [];
        exact.push({ operation, entry });
        createsByIdentity.set(entry.exact, exact);
        const byName = createsByName.get(entry.name) ?? [];
        byName.push({ operation, entry });
        createsByName.set(entry.name, byName);
      }
    }

    const invalidCreateNames = new Set();
    for (const [name, creates] of createsByName) {
      const operationIds = new Set(creates.map(({ operation }) => operation.operationId));
      if (creates.length <= 1 && operationIds.size <= 1) continue;
      invalidCreateNames.add(name);
      for (const { operation } of creates) {
        await block(
          operation,
          SYNC_SERVICE_ERROR_CODES.ENTITY_CREATE_CONFLICT,
          'More than one local submission creates the same Entity identity.'
        );
      }
    }

    const producersByVersion = new Map();
    for (const operation of operations.filter(isSubmission)) {
      for (const entry of effectsByOperation.get(operation.operationId) ?? []) {
        const producedVersion =
          entry.effect.action === 'create' ? '1' : nextEntityVersion(entry.effect.baseVersion);
        if (producedVersion == null) continue;
        const key = entityVersion(entry.effect, producedVersion);
        const producers = producersByVersion.get(key) ?? [];
        producers.push({ operation, entry });
        producersByVersion.set(key, producers);
      }
    }

    const invalidProducerVersions = new Set();
    for (const [version, producers] of producersByVersion) {
      if (producers.length <= 1) continue;
      invalidProducerVersions.add(version);
      for (const { operation } of producers) {
        await block(
          operation,
          SYNC_SERVICE_ERROR_CODES.ENTITY_VERSION_CONFLICT,
          'More than one local submission produces the same Entity version.'
        );
      }
    }

    const existingDependencyKeys = new Set(
      (await sync.listDependencies(project.projectKey)).map(
        ({ operationId, dependsOnOperationId }) => `${operationId}\u0000${dependsOnOperationId}`
      )
    );
    let addedDependencyCount = 0;
    for (const operation of operations.filter(isSubmission)) {
      if (!isQueued(operation)) continue;
      for (const entry of effectsByOperation.get(operation.operationId) ?? []) {
        if (entry.effect.action !== 'update') continue;
        const exactCreates = createsByIdentity.get(entry.exact) ?? [];
        const sameNamedCreates = createsByName.get(entry.name) ?? [];
        if (invalidCreateNames.has(entry.name)) {
          await block(
            operation,
            SYNC_SERVICE_ERROR_CODES.ENTITY_CREATE_CONFLICT,
            'This submission updates an Entity with conflicting local creates.'
          );
          break;
        }
        const parentOperations = new Map();
        if (exactCreates.length === 0 && sameNamedCreates.length > 0) {
          await block(
            operation,
            SYNC_SERVICE_ERROR_CODES.ENTITY_BRANCH_CONFLICT,
            'This submission updates a local Entity with a different branch identity.'
          );
          break;
        }
        if (exactCreates.length === 1) {
          parentOperations.set(exactCreates[0].operation.operationId, exactCreates[0].operation);
        }

        const expectedVersion = entry.effect.baseVersion;
        if (typeof expectedVersion === 'string') {
          const producerVersion = entityVersion(entry.effect, expectedVersion);
          if (invalidProducerVersions.has(producerVersion)) {
            await block(
              operation,
              SYNC_SERVICE_ERROR_CODES.ENTITY_VERSION_CONFLICT,
              'This submission depends on conflicting local Entity versions.'
            );
            break;
          }
          const producers = producersByVersion.get(producerVersion) ?? [];
          if (producers.length === 1) {
            parentOperations.set(producers[0].operation.operationId, producers[0].operation);
          }
        }

        for (const parentOperation of parentOperations.values()) {
          if (parentOperation.operationId === operation.operationId) continue;
          const dependencyKey = `${operation.operationId}\u0000${parentOperation.operationId}`;
          if (existingDependencyKeys.has(dependencyKey)) continue;
          await sync.addDependency({
            operationId: operation.operationId,
            dependsOnOperationId: parentOperation.operationId,
          });
          existingDependencyKeys.add(dependencyKey);
          addedDependencyCount += 1;
        }
      }
    }

    // A sync repository makes addDependency idempotent. Reading after mutation
    // also covers pre-existing journal rows from a prior app run.
    let dependencies = await sync.listDependencies(project.projectKey);
    while (true) {
      let blockedAny = false;
      const byId = new Map(operations.map((operation) => [operation.operationId, operation]));
      const cycleIds = findQueuedDependencyCycleOperationIds(operations, dependencies);
      for (const operation of operations.filter(isQueued)) {
        const dependencyIds = dependenciesByOperation(dependencies).get(operation.operationId) ?? [];
        const hasMissingDependency = dependencyIds.some((dependencyId) => !byId.has(dependencyId));
        const hasBlockedDependency = dependencyIds.some(
          (dependencyId) => byId.get(dependencyId)?.state === SYNC_OPERATION_STATES.BLOCKED
        );
        if (cycleIds.has(operation.operationId)) {
          await block(
            operation,
            SYNC_SERVICE_ERROR_CODES.DEPENDENCY_CYCLE,
            'This submission has an impossible circular sync dependency.'
          );
          blockedAny = true;
        } else if (hasMissingDependency) {
          await block(
            operation,
            SYNC_SERVICE_ERROR_CODES.DEPENDENCY_MISSING,
            'This submission depends on missing sync work.'
          );
          blockedAny = true;
        } else if (hasBlockedDependency) {
          await block(
            operation,
            SYNC_SERVICE_ERROR_CODES.DEPENDENCY_BLOCKED,
            'This submission depends on sync work that is permanently blocked.'
          );
          blockedAny = true;
        }
      }
      if (!blockedAny) break;
      operations = await sync.listOperations(project.projectKey);
      dependencies = await sync.listDependencies(project.projectKey);
    }

    return { addedDependencyCount, issues };
  };

  const sendOperation = async ({ operation, project }) => {
    const instance = await getOwnedInstance(operation.localInstanceId, project);
    if (instance.state === 'sent') {
      return {
        ok: true,
        instance,
        operation: await sync.markComplete(operation.operationId),
      };
    }
    if (instance.state !== 'ready') {
      fail('Only ready instances can be synchronized.', SYNC_SERVICE_ERROR_CODES.INVALID_STATE, {
        localInstanceId: instance.localInstanceId,
        state: instance.state,
      });
    }

    const attempting = await sync.markAttempting(operation.operationId);
    try {
      const result = await instanceLifecycle.send({
        localInstanceId: instance.localInstanceId,
        project,
      });
      if (result.ok) {
        return {
          ...result,
          operation: await sync.markComplete(attempting.operationId),
        };
      }
      return {
        ...result,
        operation: await sync.markRetryable({
          operationId: attempting.operationId,
          lastErrorCode: 'GATHER_SYNC_SUBMISSION_FAILED',
          lastErrorSummary: result.instance?.sendError,
        }),
      };
    } catch (error) {
      const summary = sanitizeErrorText(error, 'Submission failed. Try again.');
      const operationAfterFailure = await sync.markRetryable({
        operationId: attempting.operationId,
        lastErrorCode: 'GATHER_SYNC_SUBMISSION_FAILED',
        lastErrorSummary: summary,
      });
      const currentInstance = await instances.get(instance.localInstanceId);
      return {
        ok: false,
        instance: currentInstance ?? instance,
        operation: operationAfterFailure,
      };
    }
  };

  const reconcile = async (projectInput) => {
    const project = assertProject(projectInput);
    const recoveredAttemptCount = await sync.recoverAttempting(project.projectKey);
    const instancesForProject = await instances.list(project.projectKey);
    let repairedReadyCount = 0;
    let reconciledSentCount = 0;

    for (const instance of instancesForProject) {
      if (instance.state !== 'ready' && instance.state !== 'sent') continue;
      const existing = await sync.getSubmissionOperation({
        projectKey: project.projectKey,
        localInstanceId: instance.localInstanceId,
      });
      const operation = existing ?? (await ensureForInstance(instance, project));
      if (!existing && instance.state === 'ready') repairedReadyCount += 1;
      if (
        instance.state === 'sent' &&
        (!existing || operation.state !== SYNC_OPERATION_STATES.COMPLETE)
      ) {
        if (operation.state !== SYNC_OPERATION_STATES.COMPLETE) {
          await sync.markComplete(operation.operationId);
        }
        reconciledSentCount += 1;
      }
    }

    const entityDependencies = await reconcileEntityDependencies(project);
    return {
      recoveredAttemptCount,
      repairedReadyCount,
      reconciledSentCount,
      ...entityDependencies,
    };
  };

  const sendInstance = async ({ localInstanceId, project: projectInput } = {}) => {
    const project = assertProject(projectInput);
    await reconcile(project);
    const instance = await getOwnedInstance(localInstanceId, project);
    if (instance.state === 'sent') {
      const operation = await sync.getSubmissionOperation({
        projectKey: project.projectKey,
        localInstanceId: instance.localInstanceId,
      });
      return { ok: true, instance, operation };
    }
    if (instance.state !== 'ready') {
      fail('Only ready instances can be synchronized.', SYNC_SERVICE_ERROR_CODES.INVALID_STATE, {
        localInstanceId: instance.localInstanceId,
        state: instance.state,
      });
    }
    const operation = await sync.getSubmissionOperation({
      projectKey: project.projectKey,
      localInstanceId: instance.localInstanceId,
    });
    const planned = await readPlan(project);
    if (!operation || !planned.some((candidate) => candidate.operationId === operation.operationId)) {
      return unresolvedResult({
        operation:
          operation ?? {
            operationId: null,
            localInstanceId: instance.localInstanceId,
            state: SYNC_OPERATION_STATES.BLOCKED,
            lastErrorCode: SYNC_SERVICE_ERROR_CODES.DEPENDENCY_MISSING,
            lastErrorSummary: 'This submission has no durable sync operation.',
          },
        project,
      });
    }
    return sendOperation({ operation, project });
  };

  const syncAll = async (projectInput) => {
    const project = assertProject(projectInput);
    await reconcile(project);
    const attempted = new Set();
    const results = [];

    while (true) {
      const planned = (await readPlan(project)).filter(
        (operation) => !attempted.has(operation.operationId)
      );
      if (planned.length === 0) {
        const unresolved = (await sync.listOperations(project.projectKey)).filter(
          (operation) =>
            isSubmission(operation) &&
            !attempted.has(operation.operationId) &&
            (isQueued(operation) || operation.state === SYNC_OPERATION_STATES.BLOCKED)
        );
        results.push(
          ...(await Promise.all(
            unresolved.map((operation) => unresolvedResult({ operation, project }))
          ))
        );
        return results;
      }

      for (const operation of planned) {
        attempted.add(operation.operationId);
        results.push(await sendOperation({ operation, project }));
      }
    }
  };

  return {
    /**
     * Close independent FileSystem/SQLite crash windows. Sent instances prove
     * their operation completed; interrupted attempts remain visible retryable
     * work so their exact persisted XML can be resubmitted.
     */
    reconcile,

    async enqueueReadyInstance({ localInstanceId, project: projectInput } = {}) {
      const project = assertProject(projectInput);
      const instance = await getOwnedInstance(localInstanceId, project);
      if (instance.state !== 'ready') {
        fail('Only ready instances can be enqueued.', SYNC_SERVICE_ERROR_CODES.INVALID_STATE, {
          localInstanceId: instance.localInstanceId,
          state: instance.state,
        });
      }
      return ensureForInstance(instance, project);
    },

    sendInstance,
    syncAll,

    async getStatus(projectInput) {
      const project = assertProject(projectInput);
      const reconciliation = await reconcile(project);
      const operations = (await sync.listOperations(project.projectKey)).filter(isSubmission);
      const counts = Object.fromEntries(
        Object.values(SYNC_OPERATION_STATES).map((state) => [
          state,
          operations.filter((operation) => operation.state === state).length,
        ])
      );
      return { ...counts, total: operations.length, reconciliation };
    },
  };
};
