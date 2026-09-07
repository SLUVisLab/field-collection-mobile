import { parseCsv } from 'gather-storage/csv';
import { resolveTraversal } from './traversal.js';

const fail = (message) => {
  throw new Error(message);
};
const newSessionId = () => `fw-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;

const entitiesFromForm = (cached, dataset) => {
  const resource = cached.version.resources.find((entry) => entry.isEntityList && entry.entityDataset === dataset);
  const attachment = cached.attachments.find((entry) => entry.filename === resource?.filename);
  const [header = [], ...rows] = parseCsv(attachment?.text ?? '');
  const columns = Object.fromEntries(header.map((name, index) => [name, index]));
  if (!columns.name && columns.name !== 0) fail('The effective Entity List has no name column.');
  return rows.map((row) => ({
    entityId: row[columns.name] ?? '',
    label: row[columns.label] ?? '',
    properties: Object.fromEntries(header.filter((name) => !['name', 'label', '__version', '__trunkVersion', '__branchId'].includes(name)).map((name) => [name, row[columns[name]] ?? ''])),
  })).filter((entity) => entity.entityId);
};

export const createFieldworkService = ({ sessions, formCatalog, instances } = {}) => {
  if (!sessions || !formCatalog || !instances) fail('Fieldwork is not available yet.');
  const loadEntities = async (project, formId, dataset) =>
    entitiesFromForm(await formCatalog.loadCurrentForm(project.projectKey, formId), dataset);
  const resolve = async (project, session) => {
    const [entities, links, allInstances] = await Promise.all([
      loadEntities(project, session.formId, session.entityDataset),
      sessions.listInstances(session.sessionId),
      instances.list(project.projectKey),
    ]);
    const byLocalId = new Map(allInstances.map((instance) => [instance.localInstanceId, instance]));
    const instancesByEntity = new Map(links.map((link) => [link.entityId, byLocalId.get(link.localInstanceId)]).filter(([, instance]) => instance));
    return resolveTraversal({ ...session, entities, instancesByEntity });
  };
  return {
    async start({ project, formId, dataset, filters = {}, grouping = {}, sorting = [], viewMode = 'list' }) {
      const cached = await formCatalog.loadCurrentForm(project.projectKey, formId);
      const entities = entitiesFromForm(cached, dataset);
      return sessions.create({
        sessionId: newSessionId(), projectKey: project.projectKey, formId, formVersionId: cached.version.formVersionId,
        entityDataset: dataset, targetEntityIds: entities.map((entity) => entity.entityId), filters, grouping, sorting, viewMode,
      });
    },
    resolve,
    async get(project, sessionId) {
      const session = await sessions.get(sessionId);
      if (!session || session.projectKey !== project.projectKey) fail('This fieldwork session is unavailable.');
      return { session, traversal: await resolve(project, session) };
    },
    update(sessionId, patch) {
      return sessions.update(sessionId, patch);
    },
    associateInstance(input) {
      return sessions.associateInstance(input);
    },
  };
};
