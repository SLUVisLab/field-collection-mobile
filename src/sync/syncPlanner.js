import { SYNC_OPERATION_KINDS, SYNC_OPERATION_STATES } from 'gather-storage/repositories/sync';

/**
 * Return submission operations that can run now: they are pending/retryable and
 * every explicit dependency has completed. Unknown dependency IDs are retained
 * as non-runnable rather than being silently ignored.
 */
export const planRunnableSubmissionOperations = (operations = [], dependencies = []) => {
  const allOperations = Array.isArray(operations) ? operations : [];
  const byId = new Map(allOperations.map((operation) => [operation.operationId, operation]));
  const dependenciesByOperation = new Map();

  for (const dependency of Array.isArray(dependencies) ? dependencies : []) {
    if (!dependenciesByOperation.has(dependency.operationId)) {
      dependenciesByOperation.set(dependency.operationId, []);
    }
    dependenciesByOperation.get(dependency.operationId).push(dependency.dependsOnOperationId);
  }

  return allOperations
    .filter(
      (operation) =>
        operation.kind === SYNC_OPERATION_KINDS.SUBMISSION &&
        (operation.state === SYNC_OPERATION_STATES.PENDING ||
          operation.state === SYNC_OPERATION_STATES.RETRYABLE) &&
        (dependenciesByOperation.get(operation.operationId) ?? []).every(
          (dependencyId) => byId.get(dependencyId)?.state === SYNC_OPERATION_STATES.COMPLETE
        )
    )
    .sort(
      (left, right) =>
        String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')) ||
        left.operationId.localeCompare(right.operationId)
    );
};
