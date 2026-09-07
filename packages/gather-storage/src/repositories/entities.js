/**
 * Durable, engine-agnostic Entity overlay repository.
 *
 * The downloaded Entity List CSV is deliberately not copied here. This stores
 * only branch identities plus finalized effects, which are replayed over the
 * immutable cached CSV when a form is opened.
 */

import { assertProjectKey } from '../paths.js';
import { assertLocalInstanceId } from './instances.js';

const MAX_TEXT_LENGTH = 4_000;
const MAX_PROPERTY_COUNT = 500;

export class EntitiesRepositoryError extends Error {
  constructor(message, { code = 'GATHER_ENTITIES_ERROR', details = null } = {}) {
    super(message);
    this.name = 'EntitiesRepositoryError';
    this.code = code;
    this.details = details;
  }
}

const fail = (message, code = 'GATHER_ENTITIES_INVALID', details = null) => {
  throw new EntitiesRepositoryError(message, { code, details });
};

const nonEmptyText = (value, field) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TEXT_LENGTH) {
    fail(`${field} must be a non-empty string no longer than ${MAX_TEXT_LENGTH} characters`, undefined, { field });
  }
  return value;
};

const nullableText = (value, field) => {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
    fail(`${field} must be a string or null no longer than ${MAX_TEXT_LENGTH} characters`, undefined, { field });
  }
  return value;
};

const plainObject = (value, field) => {
  if (value == null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(`${field} must be a plain object`, undefined, { field });
  }
  return value;
};

const normalizedProperties = (properties) => {
  const input = plainObject(properties, 'properties');
  const entries = Object.entries(input);
  if (entries.length > MAX_PROPERTY_COUNT) {
    fail(`properties cannot contain more than ${MAX_PROPERTY_COUNT} entries`, undefined, { field: 'properties' });
  }
  const normalized = {};
  for (const [key, value] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    const property = nonEmptyText(key, 'property name');
    normalized[property] = nullableText(value, `property "${property}"`);
  }
  return normalized;
};

export const normalizeEntityEffect = (effect, effectIndex = 0) => {
  if (!Number.isInteger(effectIndex) || effectIndex < 0) {
    fail('effectIndex must be a non-negative integer', undefined, { field: 'effectIndex' });
  }
  if (effect == null || typeof effect !== 'object' || Array.isArray(effect)) {
    fail('effect must be an object', undefined, { field: 'effect' });
  }
  if (effect.action !== 'create' && effect.action !== 'update') {
    fail('Entity effect action must be create or update', undefined, { field: 'action' });
  }
  return {
    reference: nullableText(effect.reference, 'reference'),
    dataset: nonEmptyText(effect.dataset, 'dataset'),
    action: effect.action,
    entityId: nonEmptyText(effect.entityId, 'entityId'),
    label: nullableText(effect.label, 'label'),
    properties: normalizedProperties(effect.properties ?? {}),
    baseVersion: nullableText(effect.baseVersion, 'baseVersion'),
    trunkVersion: nullableText(effect.trunkVersion, 'trunkVersion'),
    branchId: nullableText(effect.branchId, 'branchId'),
    effectIndex,
  };
};

const assertBranchInput = (input = {}) => ({
  entityId: nonEmptyText(input.entityId, 'entityId'),
  branchId: nonEmptyText(input.branchId, 'branchId'),
});

const rowToEffect = (row) => {
  let properties;
  try {
    properties = normalizedProperties(JSON.parse(row.properties_json));
  } catch {
    fail('Stored Entity effect properties are invalid', 'GATHER_ENTITIES_CORRUPT');
  }
  return {
    effectId: Number(row.effect_id),
    localInstanceId: row.local_instance_id,
    projectKey: row.project_key,
    effectIndex: Number(row.effect_index),
    reference: row.reference ?? null,
    dataset: row.dataset_name,
    action: row.action,
    entityId: row.entity_id,
    label: row.label ?? null,
    properties,
    baseVersion: row.base_version ?? null,
    trunkVersion: row.trunk_version ?? null,
    branchId: row.branch_id,
    createdAt: row.created_at,
  };
};

const EFFECT_COLUMNS = `
  effect_id, local_instance_id, project_key, effect_index, reference, dataset_name,
  action, entity_id, label, properties_json, base_version, trunk_version, branch_id,
  created_at`;

const assertDb = (db) => {
  if (
    !db ||
    typeof db.getAllAsync !== 'function' ||
    typeof db.getFirstAsync !== 'function' ||
    typeof db.runAsync !== 'function' ||
    typeof db.withTransactionAsync !== 'function'
  ) {
    fail('createEntitiesRepository requires a db adapter', 'GATHER_ENTITIES_NO_DB');
  }
};

const normalizeEffects = (effects) => {
  if (!Array.isArray(effects)) {
    fail('effects must be an array', undefined, { field: 'effects' });
  }
  return effects.map((effect, index) => normalizeEntityEffect(effect, index));
};

/**
 * @param {{ getAllAsync: Function, getFirstAsync: Function, runAsync: Function,
 *   withTransactionAsync: Function }} db Expo SQLite's async shape or a test seam.
 */
export const createEntitiesRepository = (db) => {
  assertDb(db);

  const listEffects = async ({ projectKey, dataset } = {}) => {
    const rows = await db.getAllAsync(
      `SELECT ${EFFECT_COLUMNS}
         FROM entity_effects
        WHERE project_key = ? AND dataset_name = ?
        ORDER BY effect_id ASC;`,
      [assertProjectKey(projectKey), nonEmptyText(dataset, 'dataset')]
    );
    return (rows ?? []).map(rowToEffect);
  };

  const listEffectsForInstance = async (localInstanceId) => {
    const rows = await db.getAllAsync(
      `SELECT ${EFFECT_COLUMNS}
         FROM entity_effects
        WHERE local_instance_id = ?
        ORDER BY effect_index ASC;`,
      [assertLocalInstanceId(localInstanceId)]
    );
    return (rows ?? []).map(rowToEffect);
  };

  return {
    listEffects,
    listEffectsForInstance,

    /**
     * Establishes a stable branch identity for every source or local Entity. A
     * prior value always wins, so opening a later form cannot change a branch.
     */
    async ensureBranches({ projectKey, dataset, branches } = {}) {
      const key = assertProjectKey(projectKey);
      const datasetName = nonEmptyText(dataset, 'dataset');
      if (!Array.isArray(branches)) {
        fail('branches must be an array', undefined, { field: 'branches' });
      }
      const requested = new Map();
      for (const branch of branches) {
        const value = assertBranchInput(branch);
        const prior = requested.get(value.entityId);
        if (prior && prior !== value.branchId) {
          fail('An Entity cannot have two branch IDs in one request', undefined, {
            entityId: value.entityId,
          });
        }
        requested.set(value.entityId, value.branchId);
      }
      if (requested.size === 0) return new Map();

      await db.withTransactionAsync(async () => {
        for (const [entityId, branchId] of requested) {
          await db.runAsync(
            `INSERT INTO entity_branches (project_key, dataset_name, entity_id, branch_id)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(project_key, dataset_name, entity_id) DO NOTHING;`,
            [key, datasetName, entityId, branchId]
          );
        }
      });

      const resolved = new Map();
      for (const entityId of requested.keys()) {
        const row = await db.getFirstAsync(
          `SELECT branch_id FROM entity_branches
            WHERE project_key = ? AND dataset_name = ? AND entity_id = ?
            LIMIT 1;`,
          [key, datasetName, entityId]
        );
        if (!row?.branch_id) fail('Could not establish Entity branch identity', 'GATHER_ENTITIES_CORRUPT');
        resolved.set(entityId, row.branch_id);
      }
      return resolved;
    },

    /**
     * Writes one immutable batch for the finalized local instance. Retrying a
     * finalization is idempotent only when engine output is exactly unchanged.
     */
    async recordFinalizedEffects({ projectKey, localInstanceId, effects } = {}) {
      const key = assertProjectKey(projectKey);
      const instanceId = assertLocalInstanceId(localInstanceId);
      const normalized = normalizeEffects(effects);
      const batchJson = JSON.stringify(normalized);
      const existing = await db.getFirstAsync(
        `SELECT project_key, effects_json FROM entity_effect_batches WHERE local_instance_id = ? LIMIT 1;`,
        [instanceId]
      );
      if (existing) {
        if (existing.project_key !== key) {
          fail('Finalized Entity effects belong to another project', 'GATHER_ENTITIES_FINALIZATION_CONFLICT', {
            localInstanceId: instanceId,
          });
        }
        if (existing.effects_json !== batchJson) {
          fail('Finalized Entity effects cannot be changed', 'GATHER_ENTITIES_FINALIZATION_CONFLICT', {
            localInstanceId: instanceId,
          });
        }
        return listEffectsForInstance(instanceId);
      }

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO entity_effect_batches (local_instance_id, project_key, effects_json)
           VALUES (?, ?, ?);`,
          [instanceId, key, batchJson]
        );
        for (const effect of normalized) {
          await db.runAsync(
            `INSERT INTO entity_effects (
               local_instance_id, project_key, effect_index, reference, dataset_name,
               action, entity_id, label, properties_json, base_version, trunk_version, branch_id
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              instanceId,
              key,
              effect.effectIndex,
              effect.reference,
              effect.dataset,
              effect.action,
              effect.entityId,
              effect.label,
              JSON.stringify(effect.properties),
              effect.baseVersion,
              effect.trunkVersion,
              nonEmptyText(effect.branchId, 'branchId'),
            ]
          );
        }
      });
      return listEffectsForInstance(instanceId);
    },
  };
};
