const ENTITY_NAMESPACE_URI = 'http://www.opendatakit.org/xforms/entities';
const ENTITY_ACTION_VALUES = new Set(['1', 'true']);

const nodeName = (node) => node?.definition?.qualifiedName?.localName ?? null;

const nodeReference = (node) => {
  const reference = node?.currentState?.reference;
  return typeof reference === 'string' ? reference : null;
};

const nodeValue = (node) => {
  const value = node?.currentState?.instanceValue;
  if (typeof value === 'string') {
    return value;
  }

  const fallback = node?.currentState?.value;
  if (fallback == null) {
    return null;
  }

  return String(fallback);
};

const nodeChildren = (node) => {
  if (typeof node?.getChildren !== 'function') {
    return [];
  }
  return node.getChildren() ?? [];
};

const isEntityContainer = (node) =>
  node?.nodeType === 'root' || node?.nodeType === 'group' || node?.nodeType === 'repeat-instance';

const isEntityInContainer = (entity, container) =>
  nodeName(entity) === 'entity' &&
  nodeName(entity.parent) === 'meta' &&
  entity.parent?.parent === container;

const findEntityInContainer = (container) => {
  const meta = nodeChildren(container).find((child) => nodeName(child) === 'meta');
  if (meta == null) {
    return null;
  }

  const entities = nodeChildren(meta).filter((child) => isEntityInContainer(child, container));
  if (entities.length > 1) {
    throw new Error(`Entity container ${nodeReference(container) ?? '<unknown>'} has multiple declarations`);
  }

  return entities[0] ?? null;
};

const nearestEntityContainer = (node) => {
  let candidate = node;
  let isInsideRepeatWithoutDeclaration = false;
  while (candidate != null) {
    if (isEntityContainer(candidate) && findEntityInContainer(candidate) != null) {
      if (isInsideRepeatWithoutDeclaration && candidate?.nodeType !== 'repeat-instance') {
        throw new Error(
          `entities:saveto node ${nodeReference(node) ?? '<unknown>'} is inside a repeat without an Entity declaration`
        );
      }
      return candidate;
    }
    if (candidate?.nodeType === 'repeat-instance') {
      isInsideRepeatWithoutDeclaration = true;
    }
    candidate = candidate.parent;
  }
  return null;
};

const saveToProperty = (node) => {
  const bindElement = node?.definition?.bind?.bindElement;
  if (bindElement == null || typeof bindElement.getAttributeNS !== 'function') {
    return null;
  }

  const property = bindElement.getAttributeNS(ENTITY_NAMESPACE_URI, 'saveto');
  return typeof property === 'string' && property.length > 0 ? property : null;
};

const flattenNodes = (root) => {
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    for (const child of nodeChildren(node)) {
      visit(child);
    }
  };
  visit(root);
  return nodes;
};

const readEntityAttribute = (entity, name) => {
  if (typeof entity?.getAttributes !== 'function') {
    return null;
  }

  const attribute = entity
    .getAttributes()
    .find((candidate) => candidate?.definition?.qualifiedName?.localName === name);
  return nodeValue(attribute);
};

const isActiveAction = (value) =>
  typeof value === 'string' && ENTITY_ACTION_VALUES.has(value.trim().toLowerCase());

const resolveAction = (entity) => {
  const creates = isActiveAction(readEntityAttribute(entity, 'create'));
  const updates = isActiveAction(readEntityAttribute(entity, 'update'));

  if (creates && updates) {
    throw new Error(
      `Entity declaration ${nodeReference(entity) ?? '<unknown>'} resolves both create and update actions`
    );
  }
  if (creates) {
    return 'create';
  }
  if (updates) {
    return 'update';
  }
  return null;
};

const readLabel = (entity) => {
  const label = nodeChildren(entity).find((child) => nodeName(child) === 'label');
  return nodeValue(label);
};

/**
 * Resolves the Entity effects declared by an XForm from the engine's current
 * live node tree. It reads the engine-evaluated instance values and relevance
 * state; it does not parse or evaluate XForms expressions outside the engine.
 *
 * @param {object} root an engine RootNode
 * @returns {EntityEffect[]}
 */
export const resolveEntityEffects = (root) => {
  const nodes = flattenNodes(root);
  const effects = [];

  for (const entity of nodes) {
    if (nodeName(entity) !== 'entity' || nodeName(entity.parent) !== 'meta') {
      continue;
    }

    const container = entity.parent?.parent;
    if (!isEntityContainer(container) || !isEntityInContainer(entity, container)) {
      continue;
    }
    if (entity?.currentState?.relevant !== true) {
      continue;
    }

    const action = resolveAction(entity);
    if (action == null) {
      continue;
    }

    const properties = {};
    for (const node of nodes) {
      const property = saveToProperty(node);
      if (property == null || nearestEntityContainer(node) !== container) {
        continue;
      }
      if (node?.currentState?.relevant !== true) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(properties, property)) {
        throw new Error(
          `Entity declaration ${nodeReference(entity) ?? '<unknown>'} resolves multiple values for "${property}"`
        );
      }
      properties[property] = nodeValue(node);
    }

    effects.push({
      reference: nodeReference(entity),
      dataset: readEntityAttribute(entity, 'dataset'),
      action,
      entityId: readEntityAttribute(entity, 'id'),
      label: readLabel(entity),
      properties,
      baseVersion: readEntityAttribute(entity, 'baseVersion'),
      trunkVersion: readEntityAttribute(entity, 'trunkVersion'),
      branchId: readEntityAttribute(entity, 'branchId'),
    });
  }

  return effects;
};
