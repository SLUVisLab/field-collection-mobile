import { CsvError, parseCsv, serializeCsv } from 'gather-storage/csv';
import { EntitiesRepositoryError, normalizeEntityEffect } from 'gather-storage/repositories/entities';

export const ENTITY_SERVICE_ERROR_CODES = Object.freeze({
  UNAVAILABLE: 'GATHER_ENTITIES_UNAVAILABLE',
  INVALID: 'GATHER_ENTITIES_INVALID',
  CSV: 'GATHER_ENTITIES_CSV',
  EFFECT: 'GATHER_ENTITIES_EFFECT',
  CONFLICT: 'GATHER_ENTITIES_CONFLICT',
});

export class EntityServiceError extends Error {
  constructor(message, { code = ENTITY_SERVICE_ERROR_CODES.INVALID, details = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'EntityServiceError';
    this.code = code;
    this.details = details;
  }
}

const fail = (message, code = ENTITY_SERVICE_ERROR_CODES.INVALID, details = null, cause) => {
  throw new EntityServiceError(message, { code, details, cause });
};

const SYSTEM_COLUMNS = Object.freeze(['name', 'label', '__version', '__trunkVersion', '__branchId']);
const SYSTEM_COLUMN_SET = new Set(SYSTEM_COLUMNS);

const nonEmpty = (value, field) => {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${field} must be a non-empty string`, ENTITY_SERVICE_ERROR_CODES.INVALID, { field });
  }
  return value;
};

const assertProjectKey = (projectKey) => nonEmpty(projectKey, 'projectKey');

const defaultNewBranchId = () => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (typeof randomUuid === 'string' && randomUuid.length > 0) return randomUuid;
  const bytes = globalThis.crypto?.getRandomValues?.(new Uint8Array(16));
  const value = bytes ?? Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  value[6] = (value[6] & 0x0f) | 0x40;
  value[8] = (value[8] & 0x3f) | 0x80;
  const hex = [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const assertDependencies = ({ entities, newBranchId }) => {
  if (
    !entities ||
    typeof entities.ensureBranches !== 'function' ||
    typeof entities.listEffects !== 'function' ||
    typeof entities.recordFinalizedEffects !== 'function' ||
    typeof newBranchId !== 'function'
  ) {
    fail('Entity overlay is not available yet.', ENTITY_SERVICE_ERROR_CODES.UNAVAILABLE);
  }
};

const decodeCsv = (sourceCsv) => {
  let records;
  try {
    records = parseCsv(sourceCsv);
  } catch (error) {
    if (error instanceof CsvError) {
      fail('The Entity List CSV is invalid.', ENTITY_SERVICE_ERROR_CODES.CSV, { offset: error.offset }, error);
    }
    throw error;
  }
  if (records.length === 0) {
    fail('The Entity List CSV has no header.', ENTITY_SERVICE_ERROR_CODES.CSV);
  }
  const header = [...records[0]];
  if (header[0]?.charCodeAt(0) === 0xfeff) header[0] = header[0].slice(1);
  if (header.length === 0 || header.some((column) => typeof column !== 'string' || column.length === 0)) {
    fail('The Entity List CSV has an invalid header.', ENTITY_SERVICE_ERROR_CODES.CSV);
  }
  if (new Set(header).size !== header.length) {
    fail('The Entity List CSV repeats a column name.', ENTITY_SERVICE_ERROR_CODES.CSV);
  }
  for (const required of ['name', 'label', '__version']) {
    if (!header.includes(required)) {
      fail(`The Entity List CSV is missing "${required}".`, ENTITY_SERVICE_ERROR_CODES.CSV, { required });
    }
  }
  const rows = records.slice(1).map((row, index) => {
    if (row.length > header.length) {
      fail('The Entity List CSV has a row with too many fields.', ENTITY_SERVICE_ERROR_CODES.CSV, {
        row: index + 2,
      });
    }
    return [...row, ...Array(Math.max(0, header.length - row.length)).fill('')];
  });
  return { header, rows };
};

const stringValue = (value) => (value == null ? '' : String(value));

const incrementVersion = (value) => {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) {
    fail('Entity version is not a non-negative integer.', ENTITY_SERVICE_ERROR_CODES.CONFLICT, { version: value });
  }
  return (BigInt(value) + 1n).toString();
};

const effectProperties = (effect) => {
  for (const property of Object.keys(effect.properties)) {
    if (SYSTEM_COLUMN_SET.has(property)) {
      fail('An Entity effect cannot write a system CSV column.', ENTITY_SERVICE_ERROR_CODES.EFFECT, {
        property,
      });
    }
  }
  return effect.properties;
};

const entityRecordsFromSource = ({ header, rows }) => {
  const columns = Object.fromEntries(header.map((name, index) => [name, index]));
  const properties = header.filter((column) => !SYSTEM_COLUMN_SET.has(column));
  const records = new Map();
  for (const row of rows) {
    const entityId = row[columns.name];
    if (entityId.length === 0) {
      fail('The Entity List CSV contains an empty Entity name.', ENTITY_SERVICE_ERROR_CODES.CSV);
    }
    if (records.has(entityId)) {
      fail('The Entity List CSV repeats an Entity name.', ENTITY_SERVICE_ERROR_CODES.CSV, { entityId });
    }
    records.set(entityId, {
      entityId,
      label: row[columns.label],
      version: row[columns.__version],
      trunkVersion: columns.__trunkVersion == null ? row[columns.__version] : row[columns.__trunkVersion] || row[columns.__version],
      branchId: columns.__branchId == null ? '' : row[columns.__branchId],
      properties: Object.fromEntries(properties.map((property) => [property, row[columns[property]]])),
    });
  }
  return { records, properties };
};

const normalizedEffectList = (effects) => {
  if (!Array.isArray(effects)) {
    fail('The XForms host returned invalid Entity effects.', ENTITY_SERVICE_ERROR_CODES.EFFECT);
  }
  try {
    return effects.map((effect, index) => {
      const normalized = normalizeEntityEffect(effect, index);
      effectProperties(normalized);
      return normalized;
    });
  } catch (error) {
    if (error instanceof EntitiesRepositoryError) {
      fail('The XForms host returned invalid Entity effects.', ENTITY_SERVICE_ERROR_CODES.EFFECT, null, error);
    }
    throw error;
  }
};

/**
 * Applies only generic, engine-resolved effects. It neither reads XForm XML nor
 * knows a form's property schema; the source CSV contributes all unknown fields.
 */
export const createEntityService = ({ entities, newBranchId = defaultNewBranchId } = {}) => {
  assertDependencies({ entities, newBranchId });

  const normalizeFinalizedEffects = async ({ projectKey, effects }) => {
    const normalized = normalizedEffectList(effects);
    const requestedBranches = new Map();
    for (const effect of normalized) {
      const entityKey = `${effect.dataset}\u0000${effect.entityId}`;
      const declaredBranch = effect.branchId || null;
      const prior = requestedBranches.get(entityKey);
      if (prior && declaredBranch && prior !== declaredBranch) {
        fail('One finalized Entity has conflicting branch IDs.', ENTITY_SERVICE_ERROR_CODES.EFFECT, {
          entityId: effect.entityId,
        });
      }
      if (declaredBranch) requestedBranches.set(entityKey, declaredBranch);
      else if (!requestedBranches.has(entityKey)) requestedBranches.set(entityKey, null);
    }
    for (const [entityKey, branchId] of requestedBranches) {
      if (branchId == null) requestedBranches.set(entityKey, newBranchId());
    }

    const branchesByDataset = new Map();
    for (const effect of normalized) {
      const entries = branchesByDataset.get(effect.dataset) ?? [];
      entries.push({
        entityId: effect.entityId,
        branchId: requestedBranches.get(`${effect.dataset}\u0000${effect.entityId}`),
      });
      branchesByDataset.set(effect.dataset, entries);
    }
    const resolved = new Map();
    for (const [dataset, branches] of branchesByDataset) {
      const values = await entities.ensureBranches({ projectKey, dataset, branches });
      for (const [entityId, branchId] of values) resolved.set(`${dataset}\u0000${entityId}`, branchId);
    }
    return normalized.map((effect) => ({
      ...effect,
      branchId: resolved.get(`${effect.dataset}\u0000${effect.entityId}`),
    }));
  };

  const materializeCsv = async ({ projectKey, dataset, sourceCsv }) => {
    const key = assertProjectKey(projectKey);
    const datasetName = nonEmpty(dataset, 'dataset');
    const { header, rows } = decodeCsv(sourceCsv);
    const { records, properties } = entityRecordsFromSource({ header, rows });

    const branches = await entities.ensureBranches({
      projectKey: key,
      dataset: datasetName,
      branches: [...records.values()].map((record) => ({
        entityId: record.entityId,
        branchId: record.branchId || newBranchId(),
      })),
    });
    for (const record of records.values()) {
      record.branchId = branches.get(record.entityId);
    }

    const effects = await entities.listEffects({ projectKey: key, dataset: datasetName });
    for (const effect of effects) {
      const current = records.get(effect.entityId);
      if (effect.action === 'create') {
        if (current) {
          fail('A local Entity create conflicts with the source snapshot.', ENTITY_SERVICE_ERROR_CODES.CONFLICT, {
            entityId: effect.entityId,
          });
        }
        records.set(effect.entityId, {
          entityId: effect.entityId,
          label: stringValue(effect.label),
          version: '1',
          trunkVersion: '',
          branchId: effect.branchId,
          properties: { ...effectProperties(effect) },
        });
      } else {
        if (!current) {
          fail('A local Entity update has no source Entity.', ENTITY_SERVICE_ERROR_CODES.CONFLICT, {
            entityId: effect.entityId,
          });
        }
        current.label = stringValue(effect.label);
        Object.assign(current.properties, effectProperties(effect));
        current.version = incrementVersion(current.version);
      }
      for (const property of Object.keys(effect.properties)) {
        if (!properties.includes(property)) properties.push(property);
      }
    }

    const output = [
      [...SYSTEM_COLUMNS, ...properties],
      ...[...records.values()].map((record) => [
        record.entityId,
        stringValue(record.label),
        record.version,
        record.trunkVersion,
        record.branchId,
        ...properties.map((property) => stringValue(record.properties[property])),
      ]),
    ];
    try {
      return serializeCsv(output);
    } catch (error) {
      if (error instanceof CsvError) {
        fail('Could not synthesize the Entity List CSV.', ENTITY_SERVICE_ERROR_CODES.CSV, null, error);
      }
      throw error;
    }
  };

  return {
    /**
     * Finalization runs after final XML is persisted. The batch is tied to its
     * local instance, which is the stable future join point for sync operations.
     */
    async recordFinalizedEffects({ projectKey, localInstanceId, effects } = {}) {
      const key = assertProjectKey(projectKey);
      const normalized = await normalizeFinalizedEffects({ projectKey: key, effects });
      return entities.recordFinalizedEffects({
        projectKey: key,
        localInstanceId: nonEmpty(localInstanceId, 'localInstanceId'),
        effects: normalized,
      });
    },

    materializeCsv,

    /**
     * Replaces only mapped Entity List attachments in memory. Form cache files
     * are never modified; non-Entity resources retain their original descriptors.
     */
    async synthesizeAttachments({ projectKey, resources, attachments } = {}) {
      const key = assertProjectKey(projectKey);
      const entityResources = new Map(
        (Array.isArray(resources) ? resources : [])
          .filter((resource) => resource?.isEntityList && typeof resource.entityDataset === 'string')
          .map((resource) => [resource.filename, resource])
      );
      return Promise.all(
        (Array.isArray(attachments) ? attachments : []).map(async (attachment) => {
          const resource = entityResources.get(attachment?.filename);
          if (!resource) return attachment;
          if (typeof attachment.text !== 'string') {
            fail('The Entity List attachment is not text CSV.', ENTITY_SERVICE_ERROR_CODES.CSV, {
              filename: resource.filename,
            });
          }
          return {
            ...attachment,
            text: await materializeCsv({
              projectKey: key,
              dataset: resource.entityDataset,
              sourceCsv: attachment.text,
            }),
          };
        })
      );
    },
  };
};

export { SYSTEM_COLUMNS };
