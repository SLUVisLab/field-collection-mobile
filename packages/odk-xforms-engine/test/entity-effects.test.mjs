import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveEntityEffects } from '../dist/entity-effects.js';

const ENTITIES_NAMESPACE_URI = 'http://www.opendatakit.org/xforms/entities';

const bindElement = (saveTo) => ({
  getAttributeNS(namespace, localName) {
    return namespace === ENTITIES_NAMESPACE_URI && localName === 'saveto' ? saveTo ?? null : null;
  },
});

const node = ({
  nodeType = 'model-value',
  nodeset,
  localName,
  reference,
  value = null,
  relevant = true,
  saveTo,
  attributes = {},
  children = [],
} = {}) => {
  const valueNode = {
    nodeType,
    definition: {
      nodeset,
      qualifiedName: { localName },
      bind: { bindElement: bindElement(saveTo) },
    },
    currentState: {
      reference,
      instanceValue: value,
      relevant,
    },
    parent: null,
    getChildren() {
      return children;
    },
    getAttributes() {
      return Object.entries(attributes).map(([name, attributeValue]) => ({
        definition: { qualifiedName: { localName: name } },
        currentState: { instanceValue: attributeValue },
      }));
    },
  };
  for (const child of children) {
    child.parent = valueNode;
  }
  return valueNode;
};

const entity = ({ reference, attributes, label, relevant = true }) =>
  node({
    nodeset: '/data/meta/entity',
    localName: 'entity',
    reference,
    relevant,
    attributes,
    children: [
      node({
        nodeset: '/data/meta/entity/label',
        localName: 'label',
        reference: `${reference}/label`,
        value: label,
        relevant,
      }),
    ],
  });

const container = ({ nodeType = 'root', nodeset = '/data', reference = '/data', children }) =>
  node({ nodeType, nodeset, localName: nodeType === 'root' ? 'data' : 'container', reference, children });

const withEntityMeta = (entityNode) =>
  node({
    nodeType: 'group',
    nodeset: '/data/meta',
    localName: 'meta',
    reference: entityNode.currentState.reference.slice(0, -'/entity'.length),
    children: [entityNode],
  });

test('resolves only active, relevant Entity effects from engine node state', () => {
  const declaration = entity({
    reference: '/data/meta/entity',
    attributes: {
      dataset: 'trees',
      id: 'tree-1',
      create: 'true',
      baseVersion: '',
      trunkVersion: '',
      branchId: 'local-branch',
    },
    label: 'Oak',
  });
  const root = container({
    children: [
      node({
        nodeset: '/data/species',
        localName: 'species',
        reference: '/data/species',
        value: 'Oak',
        saveTo: 'species',
      }),
      node({
        nodeset: '/data/hidden',
        localName: 'hidden',
        reference: '/data/hidden',
        value: 'do not save',
        relevant: false,
        saveTo: 'secret',
      }),
      withEntityMeta(declaration),
    ],
  });

  assert.deepEqual(resolveEntityEffects(root), [
    {
      reference: '/data/meta/entity',
      dataset: 'trees',
      action: 'create',
      entityId: 'tree-1',
      label: 'Oak',
      properties: { species: 'Oak' },
      baseVersion: '',
      trunkVersion: '',
      branchId: 'local-branch',
    },
  ]);
});

test('resolves one update per repeat instance without crossing repeat context', () => {
  const repeatOneEntity = entity({
    reference: '/data/trees[1]/meta/entity',
    attributes: {
      dataset: 'trees',
      id: 'tree-1',
      update: '1',
      baseVersion: '4',
      trunkVersion: '4',
      branchId: 'branch-1',
    },
    label: 'Oak 12cm',
  });
  const repeatTwoEntity = entity({
    reference: '/data/trees[2]/meta/entity',
    attributes: {
      dataset: 'trees',
      id: 'tree-2',
      update: 'true',
      baseVersion: '8',
      trunkVersion: '7',
      branchId: 'branch-2',
    },
    label: 'Pine 20cm',
  });
  const repeatOne = container({
    nodeType: 'repeat-instance',
    nodeset: '/data/trees',
    reference: '/data/trees[1]',
    children: [
      node({
        nodeset: '/data/trees/circumference',
        localName: 'circumference',
        reference: '/data/trees[1]/circumference',
        value: '12',
        saveTo: 'circumference_cm',
      }),
      withEntityMeta(repeatOneEntity),
    ],
  });
  const repeatTwo = container({
    nodeType: 'repeat-instance',
    nodeset: '/data/trees',
    reference: '/data/trees[2]',
    children: [
      node({
        nodeset: '/data/trees/circumference',
        localName: 'circumference',
        reference: '/data/trees[2]/circumference',
        value: '20',
        saveTo: 'circumference_cm',
      }),
      withEntityMeta(repeatTwoEntity),
    ],
  });
  const repeatRange = node({
    nodeType: 'repeat-range:uncontrolled',
    nodeset: '/data/trees',
    localName: 'trees',
    reference: '/data/trees',
    children: [repeatOne, repeatTwo],
  });
  const root = container({ children: [repeatRange] });

  assert.deepEqual(resolveEntityEffects(root), [
    {
      reference: '/data/trees[1]/meta/entity',
      dataset: 'trees',
      action: 'update',
      entityId: 'tree-1',
      label: 'Oak 12cm',
      properties: { circumference_cm: '12' },
      baseVersion: '4',
      trunkVersion: '4',
      branchId: 'branch-1',
    },
    {
      reference: '/data/trees[2]/meta/entity',
      dataset: 'trees',
      action: 'update',
      entityId: 'tree-2',
      label: 'Pine 20cm',
      properties: { circumference_cm: '20' },
      baseVersion: '8',
      trunkVersion: '7',
      branchId: 'branch-2',
    },
  ]);
});

test('omits non-relevant entity declarations and rejects conflicting actions', () => {
  const inactive = entity({
    reference: '/data/meta/entity',
    attributes: { dataset: 'trees', id: 'tree-1', create: '1' },
    label: 'Inactive',
    relevant: false,
  });
  assert.deepEqual(resolveEntityEffects(container({ children: [withEntityMeta(inactive)] })), []);

  const conflicting = entity({
    reference: '/data/meta/entity',
    attributes: { dataset: 'trees', id: 'tree-1', create: '1', update: '1' },
    label: 'Conflict',
  });
  assert.throws(
    () => resolveEntityEffects(container({ children: [withEntityMeta(conflicting)] })),
    /both create and update/
  );
});

test('rejects a saveto inside a repeat whose nearest Entity is outside the repeat', () => {
  const declaration = entity({
    reference: '/data/meta/entity',
    attributes: { dataset: 'trees', id: 'tree-1', create: '1' },
    label: 'Root entity',
  });
  const repeatInstance = container({
    nodeType: 'repeat-instance',
    nodeset: '/data/trees',
    reference: '/data/trees[1]',
    children: [
      node({
        nodeset: '/data/trees/species',
        localName: 'species',
        reference: '/data/trees[1]/species',
        value: 'Oak',
        saveTo: 'species',
      }),
    ],
  });
  const repeatRange = node({
    nodeType: 'repeat-range:uncontrolled',
    nodeset: '/data/trees',
    localName: 'trees',
    reference: '/data/trees',
    children: [repeatInstance],
  });
  const root = container({ children: [repeatRange, withEntityMeta(declaration)] });

  assert.throws(() => resolveEntityEffects(root), /inside a repeat without an Entity declaration/);
});
