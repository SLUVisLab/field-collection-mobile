export const FIELDWORK_STATES = Object.freeze({
  PENDING: 'pending',
  DRAFT: 'draft',
  COMPLETE: 'complete',
  SENT: 'sent',
});

const value = (entity, property) =>
  property === 'label' ? entity.label ?? '' : entity.properties?.[property] ?? '';

export const pointGeometryFor = (entity) => {
  const parts = String(entity?.properties?.geometry ?? '').trim().split(/\s+/);
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { type: 'Point', coordinates: [longitude, latitude] }
    : null;
};

export const stateForEntity = (entityId, instancesByEntity) => {
  const instance = instancesByEntity.get(entityId);
  if (instance?.state === 'sent') return FIELDWORK_STATES.SENT;
  if (instance?.state === 'ready') return FIELDWORK_STATES.COMPLETE;
  if (instance?.state === 'draft') return FIELDWORK_STATES.DRAFT;
  return FIELDWORK_STATES.PENDING;
};

export const resolveTraversal = ({ entities, targetEntityIds, filters = {}, sorting = [], grouping = {}, instancesByEntity = new Map() }) => {
  const byId = new Map((entities ?? []).map((entity) => [entity.entityId, entity]));
  const filtered = (targetEntityIds ?? [])
    .map((entityId) => byId.get(entityId))
    .filter(Boolean)
    .filter((entity) =>
      Object.entries(filters).every(([property, expected]) =>
        expected == null || expected === '' ? true : String(value(entity, property)).toLowerCase().includes(String(expected).toLowerCase())
      )
    )
    .map((entity) => ({ ...entity, instance: instancesByEntity.get(entity.entityId) ?? null, state: stateForEntity(entity.entityId, instancesByEntity), geometry: pointGeometryFor(entity) }));
  const ordered = [...filtered].sort((left, right) => {
    for (const rule of sorting) {
      const direction = rule.direction === 'desc' ? -1 : 1;
      const result = String(value(left, rule.property)).localeCompare(String(value(right, rule.property)), undefined, { numeric: true, sensitivity: 'base' });
      if (result !== 0) return result * direction;
    }
    return left.entityId.localeCompare(right.entityId);
  });
  const property = grouping?.property;
  const groups = property
    ? ordered.reduce((result, entity) => {
        const name = String(value(entity, property) || 'Ungrouped');
        (result.get(name) ?? result.set(name, []).get(name)).push(entity);
        return result;
      }, new Map())
    : new Map([['All entities', ordered]]);
  const counts = ordered.reduce(
    (result, entity) => ({ ...result, [entity.state]: result[entity.state] + 1 }),
    { pending: 0, draft: 0, complete: 0, sent: 0 }
  );
  return { entities: ordered, groups: [...groups.entries()].map(([name, members]) => ({ name, entities: members })), counts };
};

export const nextUnresolvedEntityId = (entities, currentEntityId) => {
  const start = Math.max(0, entities.findIndex((entity) => entity.entityId === currentEntityId) + 1);
  return entities.slice(start).find((entity) => entity.state === FIELDWORK_STATES.PENDING)?.entityId ?? null;
};
